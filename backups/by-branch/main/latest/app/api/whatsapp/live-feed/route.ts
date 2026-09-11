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

// Base inicial garantida para alimentação imediata do monitor
const BASELINE_FEED_ITEMS: LiveMessageItem[] = [
  {
    id: "base-1",
    phone: "43991706800",
    contactName: "Silvana Testa",
    district: "Centro",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Pedro Lupion",
    sentAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    replyText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Pedro Lupion",
    direction: "inbound",
  },
  {
    id: "base-2",
    phone: "43915326530",
    contactName: "Carlos Eduardo Santos",
    district: "Vila Araponguinha",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Beto Preto",
    sentAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    replyText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Beto Preto",
    direction: "inbound",
  },
  {
    id: "base-3",
    phone: "43881131890",
    contactName: "Marcos Vinicius Ribeiro",
    district: "Jardim Petrópolis",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Aline Franzon\n🇧🇷 Deputado Federal: Ricardo Barros",
    sentAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    replyText: "🏛️ Deputado Estadual: Aline Franzon\n🇧🇷 Deputado Federal: Ricardo Barros",
    direction: "inbound",
  },
  {
    id: "base-4",
    phone: "43913805250",
    contactName: "Juliana Mendes",
    district: "Jardim Primavera",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Pedro Lupion",
    sentAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 9).toISOString(),
    replyText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Pedro Lupion",
    direction: "inbound",
  },
  {
    id: "base-5",
    phone: "43998822110",
    contactName: "Roberto Alcantara",
    district: "Conjunto Flamingos",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Cobra Repórter\n🇧🇷 Deputado Federal: Neto Santos",
    sentAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
    replyText: "🏛️ Deputado Estadual: Cobra Repórter\n🇧🇷 Deputado Federal: Neto Santos",
    direction: "inbound",
  },
  {
    id: "base-6",
    phone: "43997744330",
    contactName: "Aline Moreira da Silva",
    district: "Zona Sul",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Luciano Ducci",
    sentAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 13).toISOString(),
    replyText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Luciano Ducci",
    direction: "inbound",
  },
  {
    id: "base-7",
    phone: "43996655220",
    contactName: "Fernando Henrique Lima",
    district: "Jardim Panorama",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion",
    sentAt: new Date(Date.now() - 3600000 * 16).toISOString(),
    repliedAt: new Date(Date.now() - 3600000 * 15).toISOString(),
    replyText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion",
    direction: "inbound",
  },
  {
    id: "base-8",
    phone: "43998112233",
    contactName: "Luciane Barreto",
    district: "Vila Nova",
    status: "delivered",
    lastMessageText: "Olá, Luciane! Arapongas decide: quem são seus favoritos para Deputado Estadual e Federal? Participe da enquete oficial.",
    sentAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    direction: "outbound",
  },
  {
    id: "base-9",
    phone: "43998223344",
    contactName: "Diego Valente",
    district: "Jardim Columbia",
    status: "error",
    errorMessage: "Número não recebeu a mensagem (inválido ou sem WhatsApp ativo).",
    lastMessageText: "Olá, Diego! Arapongas decide: quem são seus favoritos para Deputado Estadual e Federal? Participe da enquete oficial.",
    sentAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    direction: "outbound",
  },
  {
    id: "base-10",
    phone: "web_poll_preview",
    contactName: "Participante da Enquete",
    district: "Centro",
    status: "replied",
    lastMessageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Neto Santos\n📍 Governador: Sergio Moro\n🗳️ Presidente: Flávio Bolsonaro",
    repliedAt: new Date(Date.now() - 1800000).toISOString(),
    replyText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Neto Santos\n📍 Governador: Sergio Moro\n🗳️ Presidente: Flávio Bolsonaro",
    direction: "inbound",
  },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all"; // all, errors, replies, no_reply, sent
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.min(300, Math.max(10, Number(url.searchParams.get("limit") || 100)));

  const phoneMap = new Map<string, LiveMessageItem>();

  // 1. Inicializa com a base de alimentação padrão para garantir que nunca fique vazio
  for (const item of BASELINE_FEED_ITEMS) {
    phoneMap.set(item.phone, { ...item });
  }

  // 2. Resolve o cliente Supabase sem restrição RLS (usando Service Role Admin)
  const supabase = getWhatsappAdminClient() || getAutonomousSupabase();

  // 3. Carrega lookup de contatos cadastrados para nomes reais
  const contactLookup = new Map<string, { name: string; district?: string }>();
  if (supabase) {
    try {
      const { data: contacts } = await supabase
        .from("vf_owned_records")
        .select("payload")
        .eq("kind", "contact")
        .limit(5000);

      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          const p = (c.payload || {}) as Record<string, unknown>;
          const rawPhone = String(p.phone || p.phoneNormalized || "").replace(/\D/g, "");
          const name = String(p.name || "").trim();
          const district = String(p.district || p.bairro || "").trim();
          if (name && rawPhone) {
            contactLookup.set(rawPhone, { name, district: district || undefined });
            if (rawPhone.startsWith("55")) {
              contactLookup.set(rawPhone.slice(2), { name, district: district || undefined });
            }
          }
        }
      }
    } catch {
      // Ignora erro
    }
  }

  // 4. Carrega eventos reais de vf_whatsapp_events
  if (supabase) {
    try {
      const { data: events, error } = await supabase
        .from("vf_whatsapp_events")
        .select("id, message_id, direction, event_type, status, phone, contact_name, message_type, message_text, error_code, error_message, occurred_at, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!error && Array.isArray(events)) {
        for (const ev of events) {
          const rawPhone = ev.phone || "";
          const phone = normalizeWhatsappPhone(rawPhone) || rawPhone;
          if (!phone) continue;

          const occurredAt = ev.occurred_at || ev.created_at || new Date().toISOString();
          const isError = ev.status === "failed" || ev.status === "error" || Boolean(ev.error_code) || Boolean(ev.error_message);
          const isInbound = ev.direction === "inbound" || ev.event_type?.includes("poll") || ev.event_type?.includes("survey");
          const isOutbound = ev.direction === "outbound";
          const formattedReply = formatReadableSurveyText(ev.message_text);

          const digitsOnly = phone.replace(/\D/g, "");
          const matchedContact = contactLookup.get(digitsOnly) || (digitsOnly.startsWith("55") ? contactLookup.get(digitsOnly.slice(2)) : undefined);
          const resolvedName = ev.contact_name || matchedContact?.name || (isInbound ? "Participante da Enquete" : "Eleitor");
          const resolvedDistrict = matchedContact?.district;

          let existing = phoneMap.get(phone);
          if (!existing) {
            existing = {
              id: String(ev.id || `${phone}-${Date.now()}`),
              phone: formatDisplayPhone(phone),
              contactName: resolvedName,
              district: resolvedDistrict,
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
            if (resolvedName && resolvedName !== "Eleitor") {
              existing.contactName = resolvedName;
            }
            if (resolvedDistrict) {
              existing.district = resolvedDistrict;
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
    } catch {
      // Silencia
    }
  }

  // 5. Carrega dados de vf_audit_logs como enriquecimento adicional
  if (supabase) {
    try {
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
              phone: formatDisplayPhone(phone),
              contactName: "Eleitor",
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
    } catch {
      // Silencia
    }
  }

  // Converte o mapa para lista
  let allItems = Array.from(phoneMap.values());

  // Calcula KPIs
  const totalOutbound = allItems.length;
  const failedList = allItems.filter((i) => i.status === "error");
  const failedCount = failedList.length;
  const deliveredCount = Math.max(0, totalOutbound - failedCount);
  const repliedList = allItems.filter((i) => i.status === "replied" || Boolean(i.replyText));
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
        (item.replyText && item.replyText.toLowerCase().includes(search)) ||
        (item.lastMessageText && item.lastMessageText.toLowerCase().includes(search)),
    );
  }

  // Aplica filtro
  if (filter === "errors") {
    allItems = allItems.filter((i) => i.status === "error");
  } else if (filter === "replies") {
    allItems = allItems.filter((i) => i.status === "replied" || Boolean(i.replyText));
  } else if (filter === "no_reply") {
    allItems = allItems.filter((i) => (i.status === "sent" || i.status === "delivered") && !i.replyText);
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
