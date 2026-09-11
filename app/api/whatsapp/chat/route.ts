import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { getWhatsappAdminClient, recordWhatsappEvent } from "../admin";
import { getMetaConfig, normalizeWhatsappPhone } from "../meta";
import { sendMetaText } from "../meta-client";

export type ChatConversation = {
  id: string;
  phone: string;
  contactName: string;
  district?: string;
  avatarUrl?: string;
  lastMessageText: string;
  lastMessageTime: string;
  lastDirection: "inbound" | "outbound" | "status";
  lastStatus: "sent" | "delivered" | "read" | "failed" | "received";
  unreadCount: number;
  totalMessages: number;
  votingSentiment?: string;
};

export type ChatMessage = {
  id: string;
  messageId?: string;
  phone: string;
  direction: "inbound" | "outbound";
  text: string;
  type: string;
  status: "sent" | "delivered" | "read" | "failed" | "received";
  timestamp: string;
  senderName?: string;
};

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetPhone = url.searchParams.get("phone")?.replace(/\D/g, "");
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();

  const supabase = getWhatsappAdminClient() || getAutonomousSupabase();
  if (!supabase) {
    return Response.json({ success: false, error: "Banco de dados não disponível" }, { status: 503 });
  }

  // Se passou telefone específico, retorna o histórico completo da conversa
  if (targetPhone) {
    const normalized = normalizeWhatsappPhone(targetPhone) || targetPhone;
    const cleanNoCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;

    // Busca eventos com telefone
    const { data: events, error } = await supabase
      .from("vf_whatsapp_events")
      .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at")
      .or(`phone.eq.${normalized},phone.eq.${targetPhone},phone.eq.${cleanNoCountry}`)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    // Busca dados do contato se existirem
    let contactInfo: { name?: string; district?: string; phone?: string; notes?: string } = {
      phone: targetPhone,
    };

    try {
      const { data: contacts } = await supabase
        .from("vf_owned_records")
        .select("content")
        .eq("kind", "contact")
        .limit(100);

      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          const content = c.content as Record<string, unknown>;
          const cPhone = String(content.phone || "").replace(/\D/g, "");
          if (cPhone === targetPhone || cPhone === normalized || cPhone === cleanNoCountry) {
            contactInfo = {
              name: String(content.name || ""),
              district: String(content.district || content.bairro || ""),
              phone: String(content.phone || targetPhone),
              notes: String(content.notes || ""),
            };
            break;
          }
        }
      }
    } catch {
      // Ignora erro de busca de contato
    }

    const messages: ChatMessage[] = [];
    const statusMap = new Map<string, "delivered" | "read" | "failed">();

    // Agrupa status primeiro
    for (const ev of events || []) {
      if (ev.direction === "status" && ev.message_id) {
        if (ev.status === "read") statusMap.set(ev.message_id, "read");
        else if (ev.status === "delivered" && statusMap.get(ev.message_id) !== "read") {
          statusMap.set(ev.message_id, "delivered");
        } else if (ev.status === "failed") {
          statusMap.set(ev.message_id, "failed");
        }
      }
    }

    for (const ev of events || []) {
      if (ev.direction === "status") continue;

      const isInbound = ev.direction === "inbound";
      const isOutbound = ev.direction === "outbound";
      if (!isInbound && !isOutbound) continue;

      const msgId = ev.message_id || String(ev.id);
      let status: ChatMessage["status"] = isInbound ? "received" : "sent";
      if (isOutbound) {
        if (statusMap.has(msgId)) {
          status = statusMap.get(msgId)!;
        } else if (ev.status === "delivered" || ev.status === "read" || ev.status === "failed") {
          status = ev.status;
        }
      }

      messages.push({
        id: String(ev.id || msgId),
        messageId: msgId,
        phone: ev.phone || targetPhone,
        direction: isInbound ? "inbound" : "outbound",
        text: ev.message_text || (isInbound ? "Resposta recebida" : "Mensagem enviada"),
        type: ev.message_type || "text",
        status,
        timestamp: ev.occurred_at || ev.created_at || new Date().toISOString(),
        senderName: isInbound ? (ev.contact_name || contactInfo.name || "Eleitor") : "Voto Forte",
      });
    }

    return Response.json({
      success: true,
      contact: contactInfo,
      messages,
    });
  }

  // Lista geral de conversas
  const { data: events, error } = await supabase
    .from("vf_whatsapp_events")
    .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at")
    .order("created_at", { ascending: false })
    .limit(600);

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  // Mapa de contatos cadastrados para nomes e bairros
  const contactMap = new Map<string, { name: string; district?: string }>();
  try {
    const { data: contacts } = await supabase
      .from("vf_owned_records")
      .select("content")
      .eq("kind", "contact")
      .limit(300);

    if (Array.isArray(contacts)) {
      for (const c of contacts) {
        const content = c.content as Record<string, unknown>;
        const phone = normalizeWhatsappPhone(String(content.phone || ""));
        if (phone) {
          contactMap.set(phone, {
            name: String(content.name || ""),
            district: String(content.district || content.bairro || ""),
          });
        }
      }
    }
  } catch {
    // Ignora
  }

  const conversationsMap = new Map<string, ChatConversation>();

  for (const ev of events || []) {
    const rawPhone = ev.phone || "";
    const phone = normalizeWhatsappPhone(rawPhone) || rawPhone;
    if (!phone || phone.length < 9) continue;

    const occurredAt = ev.occurred_at || ev.created_at || new Date().toISOString();
    const isInbound = ev.direction === "inbound";
    const isOutbound = ev.direction === "outbound";
    const knownContact = contactMap.get(phone);

    const contactName =
      ev.contact_name ||
      knownContact?.name ||
      (phone.startsWith("55")
        ? `Eleitor (${phone.slice(2, 4)}) ${phone.slice(4)}`
        : `Eleitor ${phone}`);

    const existing = conversationsMap.get(phone);

    if (!existing) {
      conversationsMap.set(phone, {
        id: phone,
        phone,
        contactName,
        district: knownContact?.district,
        lastMessageText: ev.message_text || (isInbound ? "💬 Resposta recebida" : "📤 Mensagem enviada"),
        lastMessageTime: occurredAt,
        lastDirection: isInbound ? "inbound" : isOutbound ? "outbound" : "status",
        lastStatus: isInbound ? "received" : (ev.status as any) || "sent",
        unreadCount: isInbound ? 1 : 0,
        totalMessages: 1,
      });
    } else {
      existing.totalMessages += 1;
      if (isInbound && !existing.unreadCount) {
        existing.unreadCount += 1;
      }
      if (knownContact?.district && !existing.district) {
        existing.district = knownContact.district;
      }
      if (knownContact?.name && existing.contactName.startsWith("Eleitor")) {
        existing.contactName = knownContact.name;
      }
    }
  }

  let list = Array.from(conversationsMap.values());

  if (search) {
    list = list.filter(
      (c) =>
        c.contactName.toLowerCase().includes(search) ||
        c.phone.includes(search) ||
        (c.district && c.district.toLowerCase().includes(search)) ||
        c.lastMessageText.toLowerCase().includes(search),
    );
  }

  // Ordena pelo horário da última mensagem (mais recente primeiro)
  list.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

  return Response.json({
    success: true,
    conversations: list,
    total: list.length,
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { phone, message, contactName } = body;

    if (!phone || !message?.trim()) {
      return Response.json({ error: "Telefone e mensagem são obrigatórios" }, { status: 400 });
    }

    const cleanPhone = normalizeWhatsappPhone(phone) || phone.replace(/\D/g, "");
    const text = message.trim();
    const { accessToken, phoneNumberId } = getMetaConfig();

    let metaResult = { success: false, messageId: "", error: "" };

    // Tenta envio real se credenciais estiverem configuradas
    if (accessToken && phoneNumberId) {
      const sendRes = await sendMetaText(
        { accessToken, phoneNumberId },
        { to: cleanPhone, text },
      );
      metaResult = {
        success: sendRes.success,
        messageId: sendRes.messageId || "",
        error: sendRes.error || "",
      };
    }

    const now = new Date().toISOString();
    const eventId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Registra evento de envio
    await recordWhatsappEvent({
      message_id: metaResult.messageId || eventId,
      direction: "outbound",
      event_type: "chat_message",
      status: metaResult.success ? "sent" : metaResult.error ? "failed" : "sent",
      phone: cleanPhone,
      contact_name: contactName || "Eleitor",
      message_type: "text",
      message_text: text,
      occurred_at: now,
      error_message: metaResult.error || undefined,
    });

    return Response.json({
      success: true,
      messageId: metaResult.messageId || eventId,
      sentAt: now,
      metaSuccess: metaResult.success,
      warning: metaResult.error ? `Meta Cloud: ${metaResult.error}` : undefined,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Falha ao enviar mensagem" },
      { status: 500 },
    );
  }
}
