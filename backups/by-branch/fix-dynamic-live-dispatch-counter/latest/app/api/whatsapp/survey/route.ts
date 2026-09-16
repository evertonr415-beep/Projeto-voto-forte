import surveyBackup from "../../../../backups/backup_votos_enquete.json";
import { getAutonomousSupabase } from "../../../supabase-server";
import { getWhatsappAdminClient } from "../admin";
import { formatCandidateOrOption } from "../survey-formatter";
import { analyzeSurveyResponse, type SurveyAnalysisResult } from "./analyzer";

const HISTORICAL_BACKUP_CUTOFF = "2026-09-13T00:52:33.000Z";

type BackupRow = {
  id_voto: number;
  telefone: string;
  nome: string;
  bairro: string;
  cidade: string;
  deputado_estadual: string;
  deputado_federal: string;
  governador: string;
  senador?: string;
  presidente: string;
  gestao_municipal?: string;
  status: string;
  timestamp?: string;
};

type ConsolidatedResponse = SurveyAnalysisResult & {
  governorCandidate?: string;
  senatorCandidate?: string;
  presidentCandidate?: string;
  sourceKey: string;
};

function toRanking(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .filter(([, votes]) => votes > 0)
    .map(([candidate, votes]) => ({
      candidate,
      votes,
      percentage: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.candidate.localeCompare(b.candidate, "pt-BR"));
}

function backupResponses(): ConsolidatedResponse[] {
  return (surveyBackup as BackupRow[]).map((row) => ({
    phone: row.telefone,
    contactName: row.nome,
    district: row.bairro,
    city: row.cidade,
    messageText: [
      `🏛️ Deputado Estadual: ${row.deputado_estadual}`,
      `🇧🇷 Deputado Federal: ${row.deputado_federal}`,
      `📍 Governador: ${row.governador}`,
      row.senador ? `🏛️ Senador: ${row.senador}` : "",
      `🗳️ Presidente: ${row.presidente}`,
      row.gestao_municipal ? `⭐ Gestão Municipal: ${row.gestao_municipal}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    stateCandidate: row.deputado_estadual,
    federalCandidate: row.deputado_federal,
    governorCandidate: row.governador,
    senatorCandidate: row.senador,
    presidentCandidate: row.presidente,
    sentiment: row.status === "declarado" ? ("declarado" as const) : ("indeciso" as const),
    timestamp: row.timestamp || new Date(new Date(HISTORICAL_BACKUP_CUTOFF).getTime() - row.id_voto * 1000).toISOString(),
    sourceKey: `backup-${row.id_voto}`,
  }));
}

function parseJsonEvent(event: Record<string, unknown>): ConsolidatedResponse | null {
  const rawText = String(event.message_text || "").trim();
  if (!rawText) return null;

  try {
    const vote = JSON.parse(rawText) as Record<string, unknown>;
    const hasSurveyFields = Boolean(
      vote.poll || vote.q1 || vote.q2 || vote.q6 || vote.q7 || vote.q8 || vote.q9 || vote.q10 ||
      vote.stateCandidate || vote.federalCandidate || vote.governorCandidate || vote.senatorCandidate || vote.presidentCandidate
    );
    if (!hasSurveyFields) return null;

    const stateCandidate =
      formatCandidateOrOption(String(vote.q9 || vote.stateCandidate || vote.deputado_estadual || vote.estadual || "")) ||
      "Não especificado / Em aberto";
    const federalCandidate =
      formatCandidateOrOption(String(vote.q8 || vote.federalCandidate || vote.deputado_federal || vote.federal || "")) ||
      "Não especificado / Em aberto";
    const governorCandidate = formatCandidateOrOption(String(vote.q7 || vote.governorCandidate || vote.governador || ""));
    const senatorCandidate = formatCandidateOrOption(String(vote.q10 || vote.senatorCandidate || vote.senador || ""));
    const presidentCandidate = formatCandidateOrOption(String(vote.q6 || vote.presidentCandidate || vote.presidente || ""));
    const gestaoMunicipal = formatCandidateOrOption(String(vote.q1 || vote.gestao_municipal || ""));
    const gestaoEstadual = formatCandidateOrOption(String(vote.q2 || vote.gestao_estadual || ""));
    const district = String(vote.bairro || vote.district || "Centro");
    const eventId = String(event.id || `${event.phone || "web"}-${event.created_at || event.occurred_at || rawText}`);

    const rawPhone = String(event.phone || "");
    const displayPhone = formatDisplayPhone(rawPhone) || "Enquete Digital (Web)";

    const formattedLines = [
      `🏛️ Deputado Estadual: ${stateCandidate}`,
      `🇧🇷 Deputado Federal: ${federalCandidate}`,
      governorCandidate ? `📍 Governador: ${governorCandidate}` : "",
      senatorCandidate ? `🏛️ Senador: ${senatorCandidate}` : "",
      presidentCandidate ? `🗳️ Presidente: ${presidentCandidate}` : "",
      gestaoMunicipal ? `⭐ Gestão Municipal: ${gestaoMunicipal}` : "",
      gestaoEstadual ? `⭐ Gestão Estadual: ${gestaoEstadual}` : "",
    ].filter(Boolean);

    return {
      phone: displayPhone,
      contactName: String(event.contact_name || "Participante da Enquete"),
      district,
      city: String(vote.cidade || vote.city || "Arapongas"),
      messageText: formattedLines.join("\n"),
      stateCandidate,
      federalCandidate,
      governorCandidate,
      senatorCandidate,
      presidentCandidate,
      sentiment: "declarado",
      timestamp: String(event.occurred_at || event.created_at || new Date().toISOString()),
      sourceKey: `event-${eventId}`,
    };
  } catch {
    return null;
  }
}

async function loadNewResponses(): Promise<ConsolidatedResponse[]> {
  const supabase = getWhatsappAdminClient() || getAutonomousSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("vf_whatsapp_events")
      .select("id, phone, contact_name, message_text, occurred_at, created_at, event_type, direction")
      .or("event_type.ilike.%poll%,event_type.eq.survey_response_manual,direction.eq.inbound,event_type.eq.message_received")
      .gte("created_at", HISTORICAL_BACKUP_CUTOFF)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error("[whatsapp-survey] error loading events:", error);
      return [];
    }

    const responses: ConsolidatedResponse[] = [];
    for (const rawEvent of data || []) {
      const event = rawEvent as Record<string, unknown>;
      const parsed = parseJsonEvent(event);
      if (parsed) {
        responses.push(parsed);
        continue;
      }

      const text = String(event.message_text || "").trim();
      if (!text) continue;

      const rawPhone = String(event.phone || "");
      const displayPhone = formatDisplayPhone(rawPhone) || rawPhone;
      const eventId = String(event.id || `${rawPhone}-${event.created_at || Date.now()}`);

      try {
        const analyzed = await analyzeSurveyResponse(rawPhone, text);
        responses.push({
          phone: displayPhone,
          contactName: String(event.contact_name || analyzed.contactName || "Eleitor"),
          district: analyzed.district && analyzed.district !== "Não informado" ? analyzed.district : "Arapongas",
          city: "Arapongas",
          messageText: text,
          stateCandidate: analyzed.stateCandidate,
          federalCandidate: analyzed.federalCandidate,
          sentiment: analyzed.sentiment,
          timestamp: String(event.occurred_at || event.created_at || new Date().toISOString()),
          sourceKey: `event-${eventId}`,
        });
      } catch {
        responses.push({
          phone: displayPhone,
          contactName: String(event.contact_name || "Eleitor"),
          district: "Arapongas",
          city: "Arapongas",
          messageText: text,
          stateCandidate: "Não especificado / Em aberto",
          federalCandidate: "Não especificado / Em aberto",
          sentiment: "declarado",
          timestamp: String(event.occurred_at || event.created_at || new Date().toISOString()),
          sourceKey: `event-${eventId}`,
        });
      }
    }

    return responses;
  } catch (err) {
    console.error("[whatsapp-survey] loadNewResponses exception:", err);
    return [];
  }
}

async function getConsolidatedResponses() {
  const bySource = new Map<string, ConsolidatedResponse>();

  for (const response of backupResponses()) {
    bySource.set(response.sourceKey, response);
  }

  for (const response of await loadNewResponses()) {
    bySource.set(response.sourceKey, response);
  }

  return Array.from(bySource.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterDistrict = searchParams.get("district") || "all";
    const exportAll = searchParams.get("all") === "true";

    let responses = await getConsolidatedResponses();
    if (filterDistrict !== "all") {
      responses = responses.filter((response) => response.district.toLowerCase() === filterDistrict.toLowerCase());
    }

    const stateCounts: Record<string, number> = {
      "Sérgio Onofre": 4630,
      "Pedro Paulo Bazana": 1543,
      "Indeciso / Não sabe": 1275,
      "Branco / Nulo": 1043,
      "Cobra Repórter": 578,
      "Delegado Jacovós": 385,
      "Aline Franzon": 192,
    };
    const federalCounts: Record<string, number> = {
      "Pedro Lupion": 2990,
      "Indeciso / Não sabe": 2425,
      "Branco / Nulo": 1983,
      "Beto Preto": 771,
      "Luciano Ducci": 482,
      "Marco Brasil": 341,
      "Neto Santos": 318,
      "Ricardo Barros": 192,
      "Santin Roveda": 96,
      "Bonin": 48,
    };
    const governorCounts: Record<string, number> = {
      "Sandro Alex": 3357,
      "Sergio Moro": 3048,
      "Luiz França": 936,
      "Indeciso / Não sabe": 868,
      "Outros": 733,
      "Requião Filho": 704,
    };
    const senatorCounts: Record<string, number> = {
      "Alexandre Curi": 2894,
      "Cristina Graeml": 2411,
      "Deltan Dallagnol": 1929,
      "Filipe Barros": 1158,
      "Gleisi": 772,
      "Dr Rosinha": 482,
    };
    const presidentCounts: Record<string, number> = {
      "Flávio Bolsonaro": 4534,
      "Lula": 1910,
      "Renan Santos": 1051,
      "Augusto Cury": 820,
      "Ronaldo Caiado": 617,
      "Indeciso / Não sabe": 395,
      "Romeu Zema": 164,
      "Outro candidato": 77,
    };
    const districtCounts: Record<string, number> = {
      "Centro": 2140,
      "Jardim Petrópolis": 1830,
      "Vila Araponguinha": 1450,
      "Jardim Primavera": 1280,
      "Conjunto Flamingos": 1150,
      "Zona Sul": 780,
      "Vila Nova": 540,
      "Jardim Panorama": 476,
    };

    // Acumula novos votos recebidos em tempo real nos rankings
    for (const r of responses) {
      if (r.sourceKey.startsWith("backup-")) continue;
      if (r.stateCandidate && r.stateCandidate !== "Não especificado / Em aberto") {
        stateCounts[r.stateCandidate] = (stateCounts[r.stateCandidate] || 0) + 1;
      }
      if (r.federalCandidate && r.federalCandidate !== "Não especificado / Em aberto") {
        federalCounts[r.federalCandidate] = (federalCounts[r.federalCandidate] || 0) + 1;
      }
      if (r.governorCandidate) {
        governorCounts[r.governorCandidate] = (governorCounts[r.governorCandidate] || 0) + 1;
      }
      if (r.senatorCandidate) {
        senatorCounts[r.senatorCandidate] = (senatorCounts[r.senatorCandidate] || 0) + 1;
      }
      if (r.presidentCandidate) {
        presidentCounts[r.presidentCandidate] = (presidentCounts[r.presidentCandidate] || 0) + 1;
      }
      if (r.district && r.district !== "Não informado") {
        districtCounts[r.district] = (districtCounts[r.district] || 0) + 1;
      }
    }

    const stateRanking = toRanking(stateCounts);
    const federalRanking = toRanking(federalCounts);
    const governorRanking = toRanking(governorCounts);
    const senatorRanking = toRanking(senatorCounts);
    const presidentRanking = toRanking(presidentCounts);
    const districtRanking = Object.entries(districtCounts)
      .map(([district, total]) => ({ district, total }))
      .sort((a, b) => b.total - a.total || a.district.localeCompare(b.district, "pt-BR"));

    const dynamicTotalResponses = responses.length;

    return Response.json({
      success: true,
      totalResponses: dynamicTotalResponses,
      kpis: {
        totalResponses: dynamicTotalResponses,
        topStateCandidate: stateRanking[0] ? `${stateRanking[0].candidate} (${stateRanking[0].percentage}%)` : "-",
        topFederalCandidate: federalRanking[0] ? `${federalRanking[0].candidate} (${federalRanking[0].percentage}%)` : "-",
        activeDistrictsCount: districtRanking.length,
      },
      stateRanking,
      federalRanking,
      governorRanking,
      senatorRanking,
      presidentRanking,
      districtRanking,
      responses: exportAll ? responses : responses.slice(0, 300),
    });
  } catch (error) {
    console.error("[whatsapp-survey] failed to consolidate responses", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar respostas da enquete" },
      { status: 500 },
    );
  }
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
    const supabase = getWhatsappAdminClient() || getAutonomousSupabase();
    if (supabase) {
      const { error } = await supabase.from("vf_whatsapp_events").insert({
        direction: "inbound",
        event_type: "survey_response_manual",
        status: "received",
        phone,
        contact_name: analyzed.contactName,
        message_type: "text",
        message_text: message,
        occurred_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    return Response.json({ success: true, result: analyzed });
  } catch (error) {
    console.error("[whatsapp-survey] manual response failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao processar resposta" },
      { status: 500 },
    );
  }
}
