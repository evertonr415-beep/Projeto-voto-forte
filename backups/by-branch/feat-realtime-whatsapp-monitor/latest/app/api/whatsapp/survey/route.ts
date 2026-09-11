import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { analyzeSurveyResponse, type SurveyAnalysisResult } from "./analyzer";

// Armazenamento em memória / cache rápido para respostas
let memorySurveyResponses: SurveyAnalysisResult[] = [];

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterDistrict = searchParams.get("district") || "all";

  const responsesMap = new Map<string, SurveyAnalysisResult>();

  // 1. Carrega dados de vf_whatsapp_events (mensagens recebidas via Webhook Oficial)
  try {
    const supabase = getAutonomousSupabase();
    const { data: waEvents } = await supabase
      .from("vf_whatsapp_events")
      .select("phone, contact_name, message_text, occurred_at")
      .eq("direction", "inbound")
      .not("message_text", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(300);

    if (waEvents && waEvents.length > 0) {
      for (const ev of waEvents) {
        const phone = ev.phone || "";
        const text = (ev.message_text || "").trim();
        const key = `${phone}-${text}`;

        if (text && phone && !responsesMap.has(key)) {
          const parsed = await analyzeSurveyResponse(phone, text);
          if (ev.contact_name && parsed.contactName === "Eleitor") {
            parsed.contactName = ev.contact_name;
          }
          parsed.timestamp = ev.occurred_at || new Date().toISOString();
          responsesMap.set(key, parsed);
        }
      }
    }
  } catch {
    // Continua com outros fallbacks
  }

  // 2. Carrega dados de vf_audit_logs se houver
  try {
    const supabase = getAutonomousSupabase();
    const { data } = await supabase
      .from("vf_audit_logs")
      .select("*")
      .ilike("action", "%WhatsApp Mensagem Recebida%")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      for (const row of data) {
        const phone = (row.actor_email || "").replace(/^wa:/, "");
        const detail = row.detail || "";
        const msgMatch = detail.match(/Msg:\s*([^|]+)/i);
        const text = msgMatch ? msgMatch[1].trim() : "";
        const key = `${phone}-${text}`;

        if (text && phone && !responsesMap.has(key)) {
          const parsed = await analyzeSurveyResponse(phone, text);
          parsed.timestamp = row.created_at || new Date().toISOString();
          responsesMap.set(key, parsed);
        }
      }
    }
  } catch {
    // Silencia se indisponível
  }

  // 3. Inclui respostas salvas em memória
  for (const m of memorySurveyResponses) {
    const key = `${m.phone}-${m.messageText}`;
    if (!responsesMap.has(key)) {
      responsesMap.set(key, m);
    }
  }

  let responses = Array.from(responsesMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  // Filtro por Bairro
  if (filterDistrict !== "all") {
    responses = responses.filter(
      (r) => r.district.toLowerCase() === filterDistrict.toLowerCase(),
    );
  }

  // Agregação de Votos para Deputado Estadual
  const stateCounts: Record<string, number> = {};
  // Agregação de Votos para Deputado Federal
  const federalCounts: Record<string, number> = {};
  // Agregação por Bairro
  const districtCounts: Record<string, number> = {};

  for (const r of responses) {
    if (r.stateCandidate && r.stateCandidate !== "Não especificado / Em aberto") {
      stateCounts[r.stateCandidate] = (stateCounts[r.stateCandidate] || 0) + 1;
    }
    if (r.federalCandidate && r.federalCandidate !== "Não especificado / Em aberto") {
      federalCounts[r.federalCandidate] = (federalCounts[r.federalCandidate] || 0) + 1;
    }
    if (r.district && r.district !== "Não informado") {
      districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
    }
  }

  const totalStateVotes = Object.values(stateCounts).reduce((a, b) => a + b, 0);
  const totalFederalVotes = Object.values(federalCounts).reduce((a, b) => a + b, 0);

  const stateRanking = Object.entries(stateCounts)
    .map(([candidate, votes]) => ({
      candidate,
      votes,
      percentage: totalStateVotes > 0 ? Math.round((votes / totalStateVotes) * 100) : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const federalRanking = Object.entries(federalCounts)
    .map(([candidate, votes]) => ({
      candidate,
      votes,
      percentage: totalFederalVotes > 0 ? Math.round((votes / totalFederalVotes) * 100) : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const districtRanking = Object.entries(districtCounts)
    .map(([district, total]) => ({ district, total }))
    .sort((a, b) => b.total - a.total);

  return Response.json({
    success: true,
    totalResponses: responses.length,
    kpis: {
      totalResponses: responses.length,
      topStateCandidate: stateRanking[0]?.candidate || "-",
      topFederalCandidate: federalRanking[0]?.candidate || "-",
      activeDistrictsCount: districtRanking.length,
    },
    stateRanking,
    federalRanking,
    districtRanking,
    responses,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone || "").trim();
    const message = String(body.message || "").trim();

    if (!phone || !message) {
      return Response.json({ error: "Telefone e mensagem são obrigatórios" }, { status: 400 });
    }

    const analyzed = await analyzeSurveyResponse(phone, message);
    memorySurveyResponses.unshift(analyzed);

    // Persiste também no Supabase caso disponível
    try {
      const supabase = getAutonomousSupabase();
      await supabase.from("vf_whatsapp_events").insert({
        direction: "inbound",
        event_type: "survey_response_manual",
        status: "received",
        phone,
        contact_name: analyzed.contactName,
        message_type: "text",
        message_text: message,
        occurred_at: new Date().toISOString(),
      });
    } catch {
      // Silencia se indisponível
    }

    return Response.json({ success: true, result: analyzed });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao processar resposta" },
      { status: 500 },
    );
  }
}
