import { getAccount, isAuthorizedForWhatsappBroadcast } from "../../../server-identity";
import { getWhatsappAdminClient } from "../admin";
import { normalizeWhatsappPhone } from "../meta";

type CampaignContact = {
  id?: number | string;
  name?: string;
  phone?: string;
  district?: string;
  leader?: string;
  parameters?: string[];
  metadata?: Record<string, unknown>;
};

type CampaignCreatePayload = {
  contacts?: CampaignContact[];
  templateName?: string;
  templateLanguage?: string;
  delaySeconds?: number;
  metadata?: Record<string, unknown>;
};

async function requireAuthorizedAccount() {
  const account = await getAccount();
  if (!account) {
    return { account: null, response: Response.json({ error: "Não autenticado" }, { status: 401 }) };
  }
  if (!isAuthorizedForWhatsappBroadcast(account)) {
    return {
      account: null,
      response: Response.json({ error: "Usuário não autorizado para disparos oficiais." }, { status: 403 }),
    };
  }
  return { account, response: null };
}

export async function GET(request: Request) {
  const auth = await requireAuthorizedAccount();
  if (!auth.account) return auth.response!;

  const admin = getWhatsappAdminClient();
  if (!admin) {
    return Response.json({ error: "Banco administrativo indisponível." }, { status: 503 });
  }

  try {
    await admin.rpc("vf_whatsapp_queue_recover_stale");

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));
    const activeOnly = searchParams.get("active") === "true";

    let query = admin
      .from("vf_whatsapp_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (activeOnly) {
      query = query.in("status", ["queued", "running", "paused"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Response.json({ success: true, campaigns: data || [] });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar campanhas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthorizedAccount();
  if (!auth.account) return auth.response!;

  const admin = getWhatsappAdminClient();
  if (!admin) {
    return Response.json({ error: "Banco administrativo indisponível." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as CampaignCreatePayload;
    const templateName = String(body.templateName || "").trim();
    const templateLanguage = String(body.templateLanguage || "pt_BR").trim() || "pt_BR";
    const delaySeconds = Math.max(1, Math.min(120, Number(body.delaySeconds || 3)));
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];

    if (!templateName) {
      return Response.json({ error: "Selecione um modelo aprovado pela Meta." }, { status: 400 });
    }
    if (!contacts.length) {
      return Response.json({ error: "Nenhum contato foi informado para a campanha." }, { status: 400 });
    }
    if (contacts.length > 5000) {
      return Response.json({ error: "Uma campanha pode ter no máximo 5.000 destinatários." }, { status: 400 });
    }

    const seen = new Set<string>();
    const items: Array<Record<string, unknown>> = [];

    for (const contact of contacts) {
      const phone = normalizeWhatsappPhone(String(contact.phone || ""));
      if (!phone || phone.length < 12 || phone.length > 15 || seen.has(phone)) continue;
      seen.add(phone);

      items.push({
        contactId: contact.id == null ? "" : String(contact.id),
        name: String(contact.name || "Contato").trim() || "Contato",
        phone,
        parameters: Array.isArray(contact.parameters)
          ? contact.parameters.map((value) => String(value ?? ""))
          : [],
        metadata: {
          district: String(contact.district || ""),
          leader: String(contact.leader || ""),
          ...(contact.metadata || {}),
        },
      });
    }

    if (!items.length) {
      return Response.json({ error: "Nenhum número válido permaneceu após a validação." }, { status: 400 });
    }

    const { data: campaignId, error: createError } = await admin.rpc(
      "vf_whatsapp_queue_create_campaign",
      {
        p_actor_user_id: Number(auth.account.id),
        p_actor_email: String(auth.account.email || ""),
        p_template_name: templateName,
        p_template_language: templateLanguage,
        p_delay_seconds: delaySeconds,
        p_items: items,
        p_metadata: {
          source: "voto-forte-server-queue",
          ...(body.metadata || {}),
        },
      },
    );

    if (createError) throw createError;

    const { data: campaign, error: readError } = await admin
      .from("vf_whatsapp_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    if (readError) throw readError;

    try {
      await auth.account.supabase.from("vf_audit_logs").insert({
        actor_email: auth.account.email,
        action: "Campanha WhatsApp criada no servidor",
        detail: `Campanha ${campaignId} | Template: ${templateName} | Destinatários: ${items.length} | Intervalo: ${delaySeconds}s`,
      });
    } catch {}

    return Response.json(
      {
        success: true,
        campaign,
        message:
          "Campanha entregue ao servidor. O envio continuará mesmo que o navegador ou o computador sejam fechados.",
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao criar campanha no servidor." },
      { status: 500 },
    );
  }
}
