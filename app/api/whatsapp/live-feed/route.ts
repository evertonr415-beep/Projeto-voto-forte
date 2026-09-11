import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { getWhatsappAdminClient, isWhatsappEventStorageConfigured } from "../admin";
import { normalizeWhatsappPhone } from "../meta";
import { formatDisplayPhone, formatReadableSurveyText } from "../survey-formatter";

export type LiveMessageItem = {
  id: string;
  phone: string;
  contactName: string;
  district?: string;
  status: "sent" | "delivered" | "read" | "error" | "replied";
  errorMessage?: string;
  lastMessageText?: string;
  sentAt?: string;
  repliedAt?: string;
  replyText?: string;
  direction: "outbound" | "inbound";
};

export type LiveFeedKpis = {
  totalOutbound: number;
  deliveredCount: number;
  failedCount: number;
  deliveryRate: number;
  repliedCount: number;
  responseRate: number;
  activeContacts: number;
};

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all"; // all, errors, replies, no_reply, sent
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.min(300, Math.max(10, Number(url.searchParams.get("limit") || 100)));

  const phoneMap = new Map<string, LiveMessageItem>();

  // 1. Carrega eventos de vf_whatsapp_events
  try {
    const supabase = account.supabase || getWhatsappAdminClient() || getAutonomousSupabase();
    if (supabase) {
      const { data: events, error } = await supabase
        .from("vf_whatsapp_events")
        .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && Array.isArray(events)) {
        for (const ev of events) {
          const rawPhone = ev.phone || "";
          const phone = normalizeWhatsappPhone(rawPhone) || rawPhone;
          if (!phone) continue;

          const occurredAt = ev.occurred_at || ev.created_at || new Date().toISOString();
          const isError = ev.status === "failed" || ev.status === "error" || Boolean(ev.error_code) || Boolean(ev.error_message);
          const isInbound = ev.direction === "inbound" || ev.event_type?.includes("poll");
          const isOutbound = ev.direction === "outbound";
          const formattedReply = formatReadableSurveyText(ev.message_text);

          let existing = phoneMap.get(phone);
          if (!existing) {
            existing = {
              id: String(ev.id || `${phone}-${Date.now()}`),
              phone: formatDisplayPhone(phone),
              contactName: ev.contact_name || (isInbound ? "Participante da Enquete" : "Eleitor"),
              status: isError ? "error" : isInbound ? "replied" : "sent",
              errorMessage: isError ? (ev.error_message || `Erro código ${ev.error_code || "desconhecido"}`) : undefined,
              lastMessageText: formattedReply || ev.message_text || undefined,
              sentAt: isOutbound ? occurredAt : undefined,
              repliedAt: isInbound ? occurredAt : undefined,
              replyText: isInbound ? formattedReply || ev.message_text || undefined : undefined,
              direction: isInbound ? "inbound" : "outbound",
            };
            phoneMap.set(phone, existing);
          } else {
            // Atualiza com dados mais recentes ou de resposta
            if (ev.contact_name && existing.contactName === "Eleitor") {
              existing.contactName = ev.contact_name;
            }

            if (isInbound) {
              existing.status = "replied";
              existing.replyText = formattedReply || ev.message_text || existing.replyText;
              existing.repliedAt = occurredAt;
            } else if (isError && existing.status !== "replied") {
              existing.status = "error";
              existing.errorMessage = ev.error_message || `Erro código ${ev.error_code || "desconhecido"}`;
            } else if (!existing.sentAt && isOutbound) {
              existing.sentAt = occurredAt;
              if (existing.status !== "replied" && existing.status !== "error") {
                existing.status = ev.status === "delivered" || ev.status === "read" ? "delivered" : "sent";
              }
            }

            if (ev.message_text && !existing.lastMessageText) {
              existing.lastMessageText = formattedReply || ev.message_text;
            }
          }
        }
      }
    }
  } catch {
    // Continua
  }

  // 2. Carrega dados de vf_audit_logs como fallback ou enriquecimento
  try {
    const supabase = getAutonomousSupabase();
    if (supabase) {
      const { data: auditRows } = await supabase
        .from("vf_audit_logs")
        .select("id, actor_email, action, detail, created_at")
        .ilike("action", "%WhatsApp%")
        .order("created_at", { ascending: false })
        .limit(200);

      if (Array.isArray(auditRows)) {
        for (const row of auditRows) {
          const rawActor = row.actor_email || "";
          const phoneMatch = rawActor.match(/\d{10,15}/) || (row.detail || "").match(/\d{10,15}/);
          const phone = phoneMatch ? normalizeWhatsappPhone(phoneMatch[0]) : "";
          if (!phone) continue;

          const action = String(row.action || "");
          const detail = String(row.detail || "");
          const createdAt = row.created_at || new Date().toISOString();
          const isInbound = action.includes("Recebida") || action.includes("Inbound");
          const isError = action.includes("Erro") || action.includes("Falha") || detail.includes("Erro");

          let existing = phoneMap.get(phone);
          if (!existing) {
            existing = {
              id: `audit-${row.id}`,
              phone,
              contactName: "Contato",
              status: isError ? "error" : isInbound ? "replied" : "sent",
              errorMessage: isError ? detail : undefined,
              sentAt: !isInbound ? createdAt : undefined,
              repliedAt: isInbound ? createdAt : undefined,
              replyText: isInbound ? detail : undefined,
              direction: isInbound ? "inbound" : "outbound",
            };
            phoneMap.set(phone, existing);
          } else {
            if (isInbound && existing.status !== "replied") {
              existing.status = "replied";
              existing.replyText = existing.replyText || detail;
              existing.repliedAt = existing.repliedAt || createdAt;
            }
          }
        }
      }
    }
  } catch {
    // Silencia
  }

  // Converte o mapa para lista
  let allItems = Array.from(phoneMap.values());

  // Calcula KPIs
  const totalOutbound = allItems.filter((i) => i.direction === "outbound" || Boolean(i.sentAt) || i.status === "error").length;
  const failedList = allItems.filter((i) => i.status === "error");
  const failedCount = failedList.length;
  const deliveredCount = Math.max(0, totalOutbound - failedCount);
  const repliedList = allItems.filter((i) => i.status === "replied");
  const repliedCount = repliedList.length;

  const deliveryRate = totalOutbound > 0 ? Math.round((deliveredCount / totalOutbound) * 1000) / 10 : 0;
  const responseRate = deliveredCount > 0 ? Math.round((repliedCount / deliveredCount) * 1000) / 10 : 0;

  const kpis: LiveFeedKpis = {
    totalOutbound,
    deliveredCount,
    failedCount,
    deliveryRate,
    repliedCount,
    responseRate,
    activeContacts: allItems.length,
  };

  // Aplica busca
  if (search) {
    allItems = allItems.filter(
      (item) =>
        item.phone.includes(search) ||
        item.contactName.toLowerCase().includes(search) ||
        (item.errorMessage && item.errorMessage.toLowerCase().includes(search)) ||
        (item.replyText && item.replyText.toLowerCase().includes(search)),
    );
  }

  // Aplica filtro
  if (filter === "errors") {
    allItems = allItems.filter((i) => i.status === "error");
  } else if (filter === "replies") {
    allItems = allItems.filter((i) => i.status === "replied");
  } else if (filter === "no_reply") {
    allItems = allItems.filter((i) => i.status === "sent" || i.status === "delivered");
  } else if (filter === "sent") {
    allItems = allItems.filter((i) => i.status === "sent" || i.status === "delivered" || i.status === "read");
  }

  // Ordena por atividade mais recente
  allItems.sort((a, b) => {
    const timeA = new Date(a.repliedAt || a.sentAt || 0).getTime();
    const timeB = new Date(b.repliedAt || b.sentAt || 0).getTime();
    return timeB - timeA;
  });

  return Response.json({
    success: true,
    kpis,
    items: allItems.slice(0, limit),
    failedNumbers: failedList.map((item) => ({
      phone: item.phone,
      name: item.contactName,
      error: item.errorMessage || "Falha no envio",
    })),
    timestamp: new Date().toISOString(),
  });
}
