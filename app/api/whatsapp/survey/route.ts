import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { analyzeSurveyResponse, type SurveyAnalysisResult } from "./analyzer";

const CANDIDATE_DISPLAY_NAMES: Record<string, string> = {
  pedro_paulo_bazana: "Pedro Paulo Bazana",
  sergio_onofre: "Sérgio Onofre",
  aline_franzon: "Aline Franzon",
  delegado_jacovos: "Delegado Jacovos",
  cobra_reporter: "Cobra Repórter",
  neto_santos: "Neto Santos",
  ricardo_barros: "Ricardo Barros",
  pedro_lupion: "Pedro Lupion",
  beto_preto: "Beto Preto",
  luciano_ducci: "Luciano Ducci",
  bonin: "Bonin",
  marco_brasil: "Marco Brasil",
  santin_roveda: "Santin Roveda",
  sergio_moro_pl: "Sergio Moro",
  requiao_filho_pdt: "Requião Filho",
  sandro_alex_psd: "Sandro Alex",
  luiz_franca_missao: "Luiz França",
  lula_pt: "Lula",
  flavio_bolsonaro_pl: "Flávio Bolsonaro",
  augusto_cury_avante: "Augusto Cury",
  renan_santos_missao: "Renan Santos",
  ronaldo_caiado_psd: "Ronaldo Caiado",
  romeu_zema_novo: "Romeu Zema",
  outro: "Outro",
  branco_nulo: "Branco / Nulo",
  ainda_nao_sei: "Indeciso / Não sabe",
};

function formatCandidateLabel(raw: string): string {
  if (!raw) return "Não especificado";
  const lower = raw.toLowerCase().trim();
  if (CANDIDATE_DISPLAY_NAMES[lower]) return CANDIDATE_DISPLAY_NAMES[lower];
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

let memorySurveyResponses: SurveyAnalysisResult[] = [];

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterDistrict = searchParams.get("district") || "all";

  const responsesMap = new Map<string, SurveyAnalysisResult>();

  // 1. Busca eventos do WhatsApp e Enquete no Supabase
  try {
    const supabase = getAutonomousSupabase();
    if (supabase) {
      // 1.1 Inbound WhatsApp Messages
      const { data: waEvents } = await supabase
        .from("vf_whatsapp_events")
        .select("id, phone, contact_name, message_text, occurred_at, created_at, event_type, direction")
        .or("direction.eq.inbound,event_type.ilike.%poll%,event_type.ilike.%survey%")
        .order("created_at", { ascending: false })
        .limit(600);

      if (Array.isArray(waEvents)) {
        for (const ev of waEvents) {
          const rawText = (ev.message_text || "").trim();
          if (!rawText) continue;

          // Se for voto da enquete web em formato JSON
          if (ev.event_type?.includes("poll") || (rawText.startsWith("{") && rawText.includes("poll"))) {
            try {
              const vote = JSON.parse(rawText);
              const stateCode = vote.q9 || vote.q1 || vote.stateCandidate;
              const fedCode = vote.q8 || vote.q2 || vote.federalCandidate;
              const dist = vote.bairro || vote.district || "Arapongas";

              const stateName = stateCode ? formatCandidateLabel(stateCode) : "Não especificado / Em aberto";
              const fedName = fedCode ? formatCandidateLabel(fedCode) : "Não especificado / Em aberto";

              const key = `poll-${ev.id || ev.phone || Math.random()}`;
              responsesMap.set(key, {
                phone: ev.phone?.startsWith("phone:") ? ev.phone.replace("phone:", "") : (ev.phone || "Enquete Online"),
                contactName: ev.contact_name || "Participante da Enquete",
                district: dist,
                city: "Arapongas",
                messageText: `Estadual: ${stateName} | Federal: ${fedName}`,
                stateCandidate: stateName,
                federalCandidate: fedName,
                sentiment: "declarado",
                timestamp: ev.occurred_at || ev.created_at || new Date().toISOString(),
              });
              continue;
            } catch {
              // Cai no analisador geral
            }
          }

          const phone = ev.phone || "";
          const key = `${phone}-${rawText}`;

          if (phone && !responsesMap.has(key)) {
            const parsed = await analyzeSurveyResponse(phone, rawText);
            if (ev.contact_name && parsed.contactName === "Eleitor") {
              parsed.contactName = ev.contact_name;
            }
            parsed.timestamp = ev.occurred_at || ev.created_at || new Date().toISOString();
            responsesMap.set(key, parsed);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar dados da enquete no Supabase:", err);
  }

  // 2. Inclui respostas em memória
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

  // Agregações e Rankings
  const stateCounts: Record<string, number> = {};
  const federalCounts: Record<string, number> = {};
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
      percentage: totalStateVotes > 0 ? Math.round((votes / totalStateVotes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const federalRanking = Object.entries(federalCounts)
    .map(([candidate, votes]) => ({
      candidate,
      votes,
      percentage: totalFederalVotes > 0 ? Math.round((votes / totalFederalVotes) * 1000) / 10 : 0,
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
      topStateCandidate: stateRanking[0] ? `${stateRanking[0].candidate} (${stateRanking[0].percentage}%)` : "-",
      topFederalCandidate: federalRanking[0] ? `${federalRanking[0].candidate} (${federalRanking[0].percentage}%)` : "-",
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

    // Persiste no Supabase caso disponível
    try {
      const supabase = getAutonomousSupabase();
      if (supabase) {
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
      }
    } catch {
      // Silencia
    }

    return Response.json({ success: true, result: analyzed });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao processar resposta" },
      { status: 500 },
    );
  }
}
