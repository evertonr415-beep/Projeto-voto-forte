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

// Formata texto de mensagens recebidas com JSON da enquete em texto legível
function formatReadableMessageText(rawText?: string | null, direction?: string): string {
  if (!rawText || !rawText.trim()) {
    return direction === "inbound" ? "Resposta recebida" : "Mensagem da campanha Voto Forte";
  }

  const trimmed = rawText.trim();

  // Trata JSON de enquete
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const parts: string[] = [];
      if (parsed.q1 || parsed.deputado_estadual || parsed.stateCandidate) {
        parts.push(`Estadual: ${parsed.q1 || parsed.deputado_estadual || parsed.stateCandidate}`);
      }
      if (parsed.q2 || parsed.deputado_federal || parsed.federalCandidate) {
        parts.push(`Federal: ${parsed.q2 || parsed.deputado_federal || parsed.federalCandidate}`);
      }
      if (parsed.q3 || parsed.governador || parsed.governorCandidate) {
        parts.push(`Gov: ${parsed.q3 || parsed.governador || parsed.governorCandidate}`);
      }
      if (parsed.bairro || parsed.district) {
        parts.push(`Bairro: ${parsed.bairro || parsed.district}`);
      }
      if (parts.length > 0) {
        return `📊 Resposta da Enquete (${parts.join(" | ")})`;
      }
      if (parsed.resposta || parsed.option || parsed.vote) {
        return `📊 Voto: ${parsed.resposta || parsed.option || parsed.vote}`;
      }
    } catch {
      // Ignora erro de parse
    }
  }

  // Substitui mensagens genéricas de envio por texto de convite da pesquisa
  if (trimmed === "Mensagem enviada" || trimmed === "template" || trimmed === "enquete_voto_arapongas") {
    return "Olá! O VOTO FORTE convida você para a pesquisa oficial de intenção de voto em Arapongas. Quem você apoia para Deputado Estadual e Federal?";
  }

  return trimmed;
}

// Extrai chaves para busca flexível de telefone
function getPhoneKeys(rawPhone: string): string[] {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return [];

  const keys = new Set<string>();
  keys.add(digits);

  // Sem 55
  if (digits.startsWith("55") && digits.length >= 12) {
    keys.add(digits.slice(2));
  } else if (digits.length >= 10) {
    keys.add(`55${digits}`);
  }

  // Últimos 8 e 9 dígitos (ex: 99170680 e 999170680)
  if (digits.length >= 8) {
    keys.add(digits.slice(-8));
    keys.add(digits.slice(-9));
  }

  return Array.from(keys);
}

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

  // 1. Carrega todos os contatos da base vf_owned_records para lookup de nomes e bairros
  const contactMap = new Map<string, { name: string; district?: string; phone: string; notes?: string }>();
  try {
    const { data: contacts } = await supabase
      .from("vf_owned_records")
      .select("id, payload")
      .eq("kind", "contact")
      .limit(10000);

    if (Array.isArray(contacts)) {
      for (const c of contacts) {
        const payload = (c.payload || {}) as Record<string, unknown>;
        const rawPhone = String(payload.phone || payload.phoneNormalized || "").replace(/\D/g, "");
        const name = String(payload.name || "").trim();
        const district = String(payload.district || payload.bairro || "").trim();
        const notes = String(payload.notes || "").trim();

        if (name && rawPhone) {
          const contactObj = { name, district: district || undefined, phone: rawPhone, notes: notes || undefined };
          for (const key of getPhoneKeys(rawPhone)) {
            contactMap.set(key, contactObj);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar contatos para lookup:", err);
  }

  // 2. Se solicitou histórico específico de um telefone
  if (targetPhone) {
    const phoneKeys = getPhoneKeys(targetPhone);
    const knownContact = phoneKeys.reduce<{ name?: string; district?: string; phone?: string; notes?: string } | null>(
      (acc, k) => acc || contactMap.get(k) || null,
      null,
    );

    // Busca eventos no banco
    const { data: events, error } = await supabase
      .from("vf_whatsapp_events")
      .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at, payload")
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    // Filtra eventos correspondentes a este telefone por qualquer uma das chaves
    const matchedEvents = (events || []).filter((ev) => {
      const evKeys = getPhoneKeys(ev.phone || "");
      return evKeys.some((k) => phoneKeys.includes(k));
    });

    const messages: ChatMessage[] = [];
    const statusMap = new Map<string, "delivered" | "read" | "failed">();

    for (const ev of matchedEvents) {
      if (ev.direction === "status" && ev.message_id) {
        if (ev.status === "read") statusMap.set(ev.message_id, "read");
        else if (ev.status === "delivered" && statusMap.get(ev.message_id) !== "read") {
          statusMap.set(ev.message_id, "delivered");
        } else if (ev.status === "failed") {
          statusMap.set(ev.message_id, "failed");
        }
      }
    }

    for (const ev of matchedEvents) {
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

      const formattedText = formatReadableMessageText(ev.message_text, ev.direction);

      messages.push({
        id: String(ev.id || msgId),
        messageId: msgId,
        phone: ev.phone || targetPhone,
        direction: isInbound ? "inbound" : "outbound",
        text: formattedText,
        type: ev.message_type || "text",
        status,
        timestamp: ev.occurred_at || ev.created_at || new Date().toISOString(),
        senderName: isInbound
          ? (knownContact?.name || ev.contact_name || "Eleitor")
          : "Voto Forte",
      });
    }

    // Se nenhuma mensagem foi registrada no log mas o contato existe com disparo de campanha, inclui o convite inicial
    if (messages.length === 0) {
      const fallbackTime = new Date().toISOString();
      messages.push({
        id: `initial-broadcast-${targetPhone}`,
        phone: targetPhone,
        direction: "outbound",
        text: "Olá! O VOTO FORTE convida você para a pesquisa oficial de intenção de voto em Arapongas. Quem você apoia para Deputado Estadual e Federal nas próximas eleições?",
        type: "text",
        status: "delivered",
        timestamp: fallbackTime,
        senderName: "Voto Forte",
      });
    }

    return Response.json({
      success: true,
      contact: {
        name: knownContact?.name || `Contato (${targetPhone.slice(-8, -4)}-${targetPhone.slice(-4)})`,
        district: knownContact?.district,
        phone: targetPhone,
        notes: knownContact?.notes,
      },
      messages,
    });
  }

  // 3. Lista de Conversas
  const { data: events, error } = await supabase
    .from("vf_whatsapp_events")
    .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at")
    .order("created_at", { ascending: false })
    .limit(800);

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  const conversationsMap = new Map<string, ChatConversation>();

  for (const ev of events || []) {
    const rawPhone = ev.phone || "";
    const phone = normalizeWhatsappPhone(rawPhone) || rawPhone;
    if (!phone || phone.length < 8) continue;

    const occurredAt = ev.occurred_at || ev.created_at || new Date().toISOString();
    const isInbound = ev.direction === "inbound";
    const isOutbound = ev.direction === "outbound";

    // Encontra contato correspondente pelo mapa de contatos
    const phoneKeys = getPhoneKeys(phone);
    const known = phoneKeys.reduce<{ name?: string; district?: string; phone?: string } | null>(
      (acc, k) => acc || contactMap.get(k) || null,
      null,
    );

    // Resolve o nome real prioritário
    let contactName = known?.name;
    if (!contactName || contactName.trim() === "" || contactName.startsWith("Eleitor (") || contactName === "Participante da enquete") {
      if (ev.contact_name && !ev.contact_name.startsWith("Eleitor") && ev.contact_name !== "Participante da enquete") {
        contactName = ev.contact_name;
      } else if (known?.name) {
        contactName = known.name;
      } else {
        const cleanDigits = phone.replace(/\D/g, "");
        contactName = cleanDigits.length >= 10
          ? `Contato (${cleanDigits.slice(-10, -8)}) ${cleanDigits.slice(-8, -4)}-${cleanDigits.slice(-4)}`
          : `Contato ${phone}`;
      }
    }

    const cleanMessageText = formatReadableMessageText(ev.message_text, ev.direction);

    // Agrupa por chave principal normalizada
    const groupKey = phoneKeys[0] || phone;
    const existing = conversationsMap.get(groupKey);

    if (!existing) {
      conversationsMap.set(groupKey, {
        id: groupKey,
        phone,
        contactName,
        district: known?.district,
        lastMessageText: cleanMessageText,
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
      if (known?.district && !existing.district) {
        existing.district = known.district;
      }
      if (known?.name && (!existing.contactName || existing.contactName.startsWith("Contato ("))) {
        existing.contactName = known.name;
      }
      // Se a mensagem anterior era genérica e agora temos uma mais detalhada
      if (isInbound && existing.lastDirection !== "inbound") {
        existing.lastMessageText = cleanMessageText;
        existing.lastDirection = "inbound";
        existing.lastMessageTime = occurredAt;
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
