import { getAccount, isAuthorizedForWhatsappBroadcast } from "../../../../server-identity";
import { getWhatsappAdminClient } from "../../admin";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthorizedAccount();
  if (!auth.account) return auth.response!;

  const { id } = await context.params;
  const admin = getWhatsappAdminClient();
  if (!admin) {
    return Response.json({ error: "Banco administrativo indisponível." }, { status: 503 });
  }

  try {
    await admin.rpc("vf_whatsapp_queue_recover_stale");

    const { searchParams } = new URL(request.url);
    const itemLimit = Math.max(10, Math.min(1000, Number(searchParams.get("itemsLimit") || 500)));

    const [{ data: campaign, error: campaignError }, { data: items, error: itemsError }] =
      await Promise.all([
        admin.from("vf_whatsapp_campaigns").select("*").eq("id", id).single(),
        admin
          .from("vf_whatsapp_campaign_items")
          .select(
            "id,sequence,contact_name,phone,status,attempt_count,message_id,error_code,error_message,sent_at,failed_at,uncertain_at,updated_at",
          )
          .eq("campaign_id", id)
          .order("sequence", { ascending: true })
          .limit(itemLimit),
      ]);

    if (campaignError) {
      return Response.json({ error: "Campanha não encontrada." }, { status: 404 });
    }
    if (itemsError) throw itemsError;

    return Response.json({ success: true, campaign, items: items || [] });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar a campanha." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuthorizedAccount();
  if (!auth.account) return auth.response!;

  const { id } = await context.params;
  const admin = getWhatsappAdminClient();
  if (!admin) {
    return Response.json({ error: "Banco administrativo indisponível." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { action?: string };
    const action = String(body.action || "").trim().toLowerCase();
    if (!["pause", "resume", "cancel"].includes(action)) {
      return Response.json({ error: "Ação inválida." }, { status: 400 });
    }

    const { data: changed, error } = await admin.rpc(
      "vf_whatsapp_queue_campaign_action",
      {
        p_campaign_id: id,
        p_action: action,
      },
    );
    if (error) throw error;
    if (!changed) {
      return Response.json(
        { error: "A campanha não está em um estado compatível com essa ação." },
        { status: 409 },
      );
    }

    const { data: campaign, error: readError } = await admin
      .from("vf_whatsapp_campaigns")
      .select("*")
      .eq("id", id)
      .single();
    if (readError) throw readError;

    try {
      await auth.account.supabase.from("vf_audit_logs").insert({
        actor_email: auth.account.email,
        action: `Campanha WhatsApp: ${action}`,
        detail: `Campanha ${id} alterada para ${campaign.status}`,
      });
    } catch {}

    return Response.json({ success: true, campaign });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao alterar a campanha." },
      { status: 500 },
    );
  }
}
