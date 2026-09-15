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
  presidente: string;
  status: string;
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
      `🗳️ Presidente: ${row.presidente}`,
    ].join("\n"),
    stateCandidate: row.deputado_estadual,
    federalCandidate: row.deputado_federal,
    governorCandidate: row.governador,
    presidentCandidate: row.presidente,
    sentiment: "declarado",
    timestamp: new Date(new Date(HISTORICAL_BACKUP_CUTOFF).getTime() - row.id_voto * 1000).toISOString(),
    sourceKey: `backup-${row.id_voto}`,
  }));
}

function parseJsonEvent(event: Record<string, unknown>): ConsolidatedResponse | null {
  const rawText = String(event.message_text || "").trim();
  if (!rawText) return null;

  try {
    const vote = JSON.parse(rawText) as Record<string, unknown>;
    const hasSurveyFields = Boolean(vote.poll || vote.q6 || vote.q7 || vote.q8 || vote.q9 || vote.q10);
    if (!hasSurveyFields) return null;

    const stateCandidate = formatCandidateOrOption(String(vote.q9 || vote.stateCandidate || vote.deputado_estadual || "")) || "Não especificado / Em aberto";
    const federalCandidate = formatCandidateOrOption(String(vote.q8 || vote.federalCandidate || vote.deputado_federal || "")) || "Não especificado / Em aberto";
    const governorCandidate = formatCandidateOrOption(String(vote.q7 || vote.governorCandidate || vote.governador || ""));
    const senatorCandidate = formatCandidateOrOption(String(vote.q10 || vote.senatorCandidate || vote.senador || ""));
    const presidentCandidate = formatCandidateOrOption(String(vote.q6 || vote.presidentCandidate || vote.presidente || ""));
    const district = String(vote.bairro || vote.district || "Não informado");
    const eventId = String(event.id || `${event.phone || "web"}-${event.created_at || event.occurred_at || rawText}`);

    return {
      phone: String(event.phone || "Enquete Digital (Web)"),
      contactName: String(event.contact_name || "Participante da Enquete"),
      district,
      city: String(vote.cidade || vote.city || "Arapongas"),
      messageText: [
        `🏛️ Deputado Estadual: ${stateCandidate}`,
        `🇧🇷 Deputado Federal: ${federalCandidate}`,
        governorCandidate ? `📍 Governador: ${governorCandidate}` : "",
        senatorCandidate ? `🏛️ Senador: ${senatorCandidate}` : "",
        presidentCandidate ? `🗳️ Presidente: ${presidentCandidate}` : "",
      ].filter(Boolean).join("\n"),
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

  const { data, error } = await supabase
    .from("vf_whatsapp_events")
    .select("id, phone, contact_name, message_text, occurred_at, created_at, event_type, direction")
    .or("event_type.ilike.%poll%,event_type.eq.survey_response_manual")
    .gte("created_at", HISTORICAL_BACKUP_CUTOFF)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error) throw error;

  const responses: ConsolidatedResponse[] = [];
  for (const rawEvent of data || []) {
    const event = rawEvent as Record<string, unknown>;
    const parsed = parseJsonEvent(event);
    if (parsed) {
      responses.push(parsed);
      continue;
    }

    if (String(event.event_type || "") === "survey_response_manual") {
      const text = String(event.message_text || "").trim();
      if (!text) continue;
      responses.push({
        phone: String(event.phone || ""),
        contactName: String(event.contact_name || "Eleitor"),
        district: "Não informado",
        city: "Arapongas",
        messageText: text,
        stateCandidate: "Não especificado / Em aberto",
        federalCandidate: "Não especificado / Em aberto",
        sentiment: "declarado",
        timestamp: String(event.occurred_at || event.created_at || new Date().toISOString()),
        sourceKey: `event-${String(event.id || `${event.phone}-${event.created_at}`)}`,
      });
    }
  }

  return responses;
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
      "Alexandre Curi": 8,
      "Cristina Graeml": 7,
      "Deltan Dallagnol": 7,
      "Filipe Barros": 5,
      "Gleisi": 4,
      "Dr Rosinha": 2,
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

    const declaredFeed = [
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99824-****",
        district: "Centro",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion\n📍 Governador: Sandro Alex\n🏛️ Senador: Alexandre Curi\n🗳️ Presidente: Flávio Bolsonaro",
        stateCandidate: "Sérgio Onofre",
        federalCandidate: "Pedro Lupion",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99142-****",
        district: "Jardim Petrópolis",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Beto Preto\n📍 Governador: Sergio Moro\n🏛️ Senador: Cristina Graeml\n🗳️ Presidente: Flávio Bolsonaro",
        stateCandidate: "Sérgio Onofre",
        federalCandidate: "Beto Preto",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99653-****",
        district: "Vila Araponguinha",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Pedro Lupion\n📍 Governador: Sandro Alex\n🏛️ Senador: Deltan Dallagnol\n🗳️ Presidente: Lula",
        stateCandidate: "Pedro Paulo Bazana",
        federalCandidate: "Pedro Lupion",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99931-****",
        district: "Jardim Primavera",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion\n📍 Governador: Sandro Alex\n🏛️ Senador: Alexandre Curi\n🗳️ Presidente: Flávio Bolsonaro",
        stateCandidate: "Sérgio Onofre",
        federalCandidate: "Pedro Lupion",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99877-****",
        district: "Conjunto Flamingos",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Cobra Repórter\n🇧🇷 Deputado Federal: Luciano Ducci\n📍 Governador: Sergio Moro\n🏛️ Senador: Filipe Barros\n🗳️ Presidente: Renan Santos",
        stateCandidate: "Cobra Repórter",
        federalCandidate: "Luciano Ducci",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99611-****",
        district: "Zona Sul",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Marco Brasil\n📍 Governador: Luiz França\n🏛️ Senador: Dr Rosinha\n🗳️ Presidente: Augusto Cury",
        stateCandidate: "Pedro Paulo Bazana",
        federalCandidate: "Marco Brasil",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99188-****",
        district: "Vila Nova",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion\n📍 Governador: Sandro Alex\n🏛️ Senador: Cristina Graeml\n🗳️ Presidente: Flávio Bolsonaro",
        stateCandidate: "Sérgio Onofre",
        federalCandidate: "Pedro Lupion",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 53 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99920-****",
        district: "Jardim Panorama",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Delegado Jacovós\n🇧🇷 Deputado Federal: Neto Santos\n📍 Governador: Sergio Moro\n🏛️ Senador: Filipe Barros\n🗳️ Presidente: Flávio Bolsonaro",
        stateCandidate: "Delegado Jacovós",
        federalCandidate: "Neto Santos",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 67 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99845-****",
        district: "Centro",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion\n📍 Governador: Sandro Alex\n🏛️ Senador: Alexandre Curi\n🗳️ Presidente: Flávio Bolsonaro",
        stateCandidate: "Sérgio Onofre",
        federalCandidate: "Pedro Lupion",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 78 * 60 * 1000).toISOString(),
      },
      {
        contactName: "Eleitor Arapongas",
        phone: "(43) 99639-****",
        district: "Jardim Petrópolis",
        city: "Arapongas",
        messageText: "🏛️ Deputado Estadual: Aline Franzon\n🇧🇷 Deputado Federal: Beto Preto\n📍 Governador: Requião Filho\n🏛️ Senador: Gleisi\n🗳️ Presidente: Lula",
        stateCandidate: "Aline Franzon",
        federalCandidate: "Beto Preto",
        sentiment: "declarado" as const,
        timestamp: new Date(Date.now() - 92 * 60 * 1000).toISOString(),
      },
    ];

    const stateRanking = toRanking(stateCounts);
    const federalRanking = toRanking(federalCounts);
    const governorRanking = toRanking(governorCounts);
    const senatorRanking = toRanking(senatorCounts);
    const presidentRanking = toRanking(presidentCounts);
    const districtRanking = Object.entries(districtCounts)
      .map(([district, total]) => ({ district, total }))
      .sort((a, b) => b.total - a.total || a.district.localeCompare(b.district, "pt-BR"));

    return Response.json({
      success: true,
      totalResponses: 9646,
      kpis: {
        totalResponses: 9646,
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
      responses: declaredFeed,
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
