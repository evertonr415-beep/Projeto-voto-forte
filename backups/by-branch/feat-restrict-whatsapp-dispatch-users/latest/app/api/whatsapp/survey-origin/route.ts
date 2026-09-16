import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { getWhatsappAdminClient } from "../admin";
import { normalizeWhatsappPhone } from "../meta";
import { formatReadableSurveyText } from "../survey-formatter";

export const dynamic = "force-dynamic";

type IdentifiedResponse = {
  phone: string;
  contactName: string;
  district?: string;
  messageText: string;
  timestamp: string;
};

function normalize(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function digits(value = "") {
  return value.replace(/\D/g, "");
}

function isRealPhone(value = "") {
  const only = digits(value);
  return only.length >= 10 && only.length <= 15;
}

function phoneKeys(value = "") {
  const normalized = normalizeWhatsappPhone(value);
  const only = digits(normalized || value);
  const keys = new Set<string>();
  if (only) keys.add(only);
  if (only.startsWith("55") && only.length > 11) keys.add(only.slice(2));
  if ((only.length === 10 || only.length === 11) && !only.startsWith("55")) keys.add(`55${only}`);
  return keys;
}

function isGenericName(value = "") {
  const name = normalize(value);
  return (
    !name ||
    name === "eleitor" ||
    name === "eleitor arapongas" ||
    name.includes("participante da enquete")
  );
}

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const supabase = getWhatsappAdminClient() || getAutonomousSupabase();
    if (!supabase) {
      return Response.json({ success: true, total: 0, responses: [] as IdentifiedResponse[] });
    }

    const [contactsResult, inboundResult] = await Promise.all([
      supabase.from("vf_owned_records").select("payload").eq("kind", "contact").limit(5000),
      supabase
        .from("vf_whatsapp_events")
        .select("id, phone, contact_name, message_text, direction, event_type, status, occurred_at, created_at")
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(10000),
    ]);

    if (inboundResult.error) throw inboundResult.error;

    const contactLookup = new Map<string, { name: string; district?: string }>();
    for (const row of contactsResult.data || []) {
      const payload = (row.payload || {}) as Record<string, unknown>;
      const rawPhone = String(payload.phone || payload.phoneNormalized || "");
      const name = String(payload.name || "").trim();
      const district = String(payload.district || payload.bairro || "").trim();
      if (!name || !rawPhone) continue;
      for (const key of phoneKeys(rawPhone)) {
        contactLookup.set(key, { name, district: district || undefined });
      }
    }

    const grouped = new Map<
      string,
      { phone: string; contactName: string; district?: string; timestamp: string; messages: string[] }
    >();

    for (const row of inboundResult.data || []) {
      const rawPhone = String(row.phone || "");
      if (!isRealPhone(rawPhone)) continue;

      const keys = phoneKeys(rawPhone);
      const lookup = [...keys].map((key) => contactLookup.get(key)).find(Boolean);
      const eventName = String(row.contact_name || "").trim();
      const contactName = !isGenericName(eventName) ? eventName : lookup?.name || "";
      if (isGenericName(contactName)) continue;

      const rawText = String(row.message_text || "").trim();
      const readable = rawText ? formatReadableSurveyText(rawText) || rawText : "Resposta recebida pelo WhatsApp";
      const phone = normalizeWhatsappPhone(rawPhone) || rawPhone;
      const district = lookup?.district;
      const timestamp = String(row.occurred_at || row.created_at || new Date().toISOString());
      const groupKey = digits(phone);
      const existing = grouped.get(groupKey);

      if (!existing) {
        grouped.set(groupKey, {
          phone,
          contactName,
          district,
          timestamp,
          messages: [readable],
        });
      } else {
        if (contactName) existing.contactName = contactName;
        if (district) existing.district = district;
        if (!existing.messages.includes(readable)) existing.messages.push(readable);
        if (new Date(timestamp).getTime() > new Date(existing.timestamp).getTime()) {
          existing.timestamp = timestamp;
        }
      }
    }

    const responses: IdentifiedResponse[] = Array.from(grouped.values())
      .map((item) => ({
        phone: item.phone,
        contactName: item.contactName,
        district: item.district,
        messageText: item.messages.join("\n\n"),
        timestamp: item.timestamp,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return Response.json(
      { success: true, total: responses.length, responses },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("[whatsapp-survey-origin] failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar respostas identificadas" },
      { status: 500 },
    );
  }
}
