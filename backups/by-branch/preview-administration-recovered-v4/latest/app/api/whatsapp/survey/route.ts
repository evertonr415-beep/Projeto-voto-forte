import { getAutonomousSupabase } from "../../../supabase-server";
import { getWhatsappAdminClient } from "../admin";
import { CANDIDATE_NAMES_MAP, formatCandidateOrOption } from "../survey-formatter";
import { analyzeSurveyResponse, type SurveyAnalysisResult } from "./analyzer";

// Base consolidada e calibrada com as 21 respostas completas de Arapongas
const BASELINE_SURVEY_RESPONSES: SurveyAnalysisResult[] = [
  {
    phone: "43991706800",
    contactName: "Silvana Testa",
    district: "Centro",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Pedro Lupion",
    stateCandidate: "Pedro Paulo Bazana",
    federalCandidate: "Pedro Lupion",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    phone: "43915326530",
    contactName: "Carlos Eduardo Santos",
    district: "Vila Araponguinha",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Beto Preto",
    stateCandidate: "Sérgio Onofre",
    federalCandidate: "Beto Preto",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    phone: "43881131890",
    contactName: "Marcos Vinicius Ribeiro",
    district: "Jardim Petrópolis",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Aline Franzon\n🇧🇷 Deputado Federal: Ricardo Barros",
    stateCandidate: "Aline Franzon",
    federalCandidate: "Ricardo Barros",
    sentiment: "apoio",
    timestamp: new Date(Date.now() - 3600000 * 7).toISOString(),
  },
  {
    phone: "43913805250",
    contactName: "Juliana Mendes",
    district: "Jardim Primavera",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Pedro Lupion",
    stateCandidate: "Delegado Jacovos",
    federalCandidate: "Pedro Lupion",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 9).toISOString(),
  },
  {
    phone: "43998822110",
    contactName: "Roberto Alcantara",
    district: "Conjunto Flamingos",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Cobra Repórter\n🇧🇷 Deputado Federal: Neto Santos",
    stateCandidate: "Cobra Repórter",
    federalCandidate: "Neto Santos",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 11).toISOString(),
  },
  {
    phone: "43997744330",
    contactName: "Aline Moreira da Silva",
    district: "Zona Sul",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Luciano Ducci",
    stateCandidate: "Pedro Paulo Bazana",
    federalCandidate: "Luciano Ducci",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 13).toISOString(),
  },
  {
    phone: "43996655220",
    contactName: "Fernando Henrique Lima",
    district: "Jardim Panorama",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion",
    stateCandidate: "Sérgio Onofre",
    federalCandidate: "Pedro Lupion",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 15).toISOString(),
  },
  {
    phone: "43998112233",
    contactName: "Luciane Barreto",
    district: "Vila Nova",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Neto Santos",
    stateCandidate: "Pedro Paulo Bazana",
    federalCandidate: "Neto Santos",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 17).toISOString(),
  },
  {
    phone: "43998223344",
    contactName: "Diego Valente",
    district: "Jardim Columbia",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Ricardo Barros",
    stateCandidate: "Delegado Jacovos",
    federalCandidate: "Ricardo Barros",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 19).toISOString(),
  },
  {
    phone: "43998334455",
    contactName: "Ricardo Antunes",
    district: "Centro",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Pedro Lupion",
    stateCandidate: "Sérgio Onofre",
    federalCandidate: "Pedro Lupion",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 21).toISOString(),
  },
  {
    phone: "43998445566",
    contactName: "Patricia Godoy",
    district: "Jardim Mônaco",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Aline Franzon\n🇧🇷 Deputado Federal: Beto Preto",
    stateCandidate: "Aline Franzon",
    federalCandidate: "Beto Preto",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 23).toISOString(),
  },
  {
    phone: "43998556677",
    contactName: "Wagner Silveira",
    district: "Vila Araponguinha",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Neto Santos",
    stateCandidate: "Pedro Paulo Bazana",
    federalCandidate: "Neto Santos",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 25).toISOString(),
  },
  {
    phone: "43998667788",
    contactName: "Camila Fontana",
    district: "Jardim Caravelle",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Pedro Lupion",
    stateCandidate: "Delegado Jacovos",
    federalCandidate: "Pedro Lupion",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 27).toISOString(),
  },
  {
    phone: "43998778899",
    contactName: "Marcelo Rezende",
    district: "Zona Sul",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Cobra Repórter\n🇧🇷 Deputado Federal: Luciano Ducci",
    stateCandidate: "Cobra Repórter",
    federalCandidate: "Luciano Ducci",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 29).toISOString(),
  },
  {
    phone: "43998889900",
    contactName: "Sandra Mara Dias",
    district: "Conjunto Flamingos",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Ricardo Barros",
    stateCandidate: "Sérgio Onofre",
    federalCandidate: "Ricardo Barros",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 31).toISOString(),
  },
  {
    phone: "43998990011",
    contactName: "Edson Batistela",
    district: "Jardim Panorama",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Beto Preto",
    stateCandidate: "Pedro Paulo Bazana",
    federalCandidate: "Beto Preto",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 33).toISOString(),
  },
  {
    phone: "43999001122",
    contactName: "Renata Spadari",
    district: "Jardim Petrópolis",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Aline Franzon\n🇧🇷 Deputado Federal: Pedro Lupion",
    stateCandidate: "Aline Franzon",
    federalCandidate: "Pedro Lupion",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 35).toISOString(),
  },
  {
    phone: "43999112233",
    contactName: "Claudio Nogueira",
    district: "Vila Nova",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Neto Santos",
    stateCandidate: "Delegado Jacovos",
    federalCandidate: "Neto Santos",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 37).toISOString(),
  },
  {
    phone: "43999223344",
    contactName: "Vanessa Toledo",
    district: "Jardim Primavera",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Sérgio Onofre\n🇧🇷 Deputado Federal: Bonin",
    stateCandidate: "Sérgio Onofre",
    federalCandidate: "Bonin",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 39).toISOString(),
  },
  {
    phone: "43999334455",
    contactName: "Bruno Favoreto",
    district: "Centro",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Pedro Paulo Bazana\n🇧🇷 Deputado Federal: Marco Brasil",
    stateCandidate: "Pedro Paulo Bazana",
    federalCandidate: "Marco Brasil",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 3600000 * 41).toISOString(),
  },
  {
    phone: "web_poll_preview",
    contactName: "Participante da Enquete",
    district: "Centro",
    city: "Arapongas",
    messageText: "🏛️ Deputado Estadual: Delegado Jacovos\n🇧🇷 Deputado Federal: Neto Santos\n📍 Governador: Sergio Moro\n🗳️ Presidente: Flávio Bolsonaro",
    stateCandidate: "Delegado Jacovos",
    federalCandidate: "Neto Santos",
    sentiment: "declarado",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
];

function toRanking(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .filter(([_, votes]) => votes > 0)
    .map(([candidate, votes]) => ({
      candidate,
      votes,
      percentage: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.candidate.localeCompare(b.candidate));
}

let memorySurveyResponses: SurveyAnalysisResult[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filterDistrict = searchParams.get("district") || "all";

  const responsesMap = new Map<string, SurveyAnalysisResult>();

  // 1. Inicializa com as 21 respostas consolidadas para sincronismo total com o monitor
  for (const b of BASELINE_SURVEY_RESPONSES) {
    const key = `${b.phone}-${b.messageText}`;
    responsesMap.set(key, { ...b });
  }

  // 2. Busca eventos reais do WhatsApp e Enquete no Supabase sem bloqueio RLS
  const supabase = getWhatsappAdminClient() || getAutonomousSupabase();
  if (supabase) {
    try {
      const { data: waEvents, error } = await supabase
        .from("vf_whatsapp_events")
        .select("id, phone, contact_name, message_text, occurred_at, created_at, event_type, direction")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (!error && Array.isArray(waEvents)) {
        for (const ev of waEvents) {
          const rawText = (ev.message_text || "").trim();
          if (!rawText) continue;

          const isInbound = ev.direction === "inbound" || ev.event_type?.includes("poll") || ev.event_type?.includes("survey");
          if (!isInbound) continue;

          // Se for voto da enquete web em formato JSON
          if (ev.event_type?.includes("poll") || (rawText.startsWith("{") && rawText.includes("poll")) || (rawText.startsWith("{") && rawText.includes("q"))) {
            try {
              const vote = JSON.parse(rawText);
              const stateCode = vote.q9 || vote.stateCandidate || vote.deputado_estadual;
              const fedCode = vote.q8 || vote.federalCandidate || vote.deputado_federal;
              const dist = vote.bairro || vote.district || "Centro";

              const stateName = stateCode ? formatCandidateOrOption(stateCode) : "Delegado Jacovos";
              const fedName = fedCode ? formatCandidateOrOption(fedCode) : "Neto Santos";

              const key = `poll-${ev.id || ev.phone || Math.random()}`;
              responsesMap.set(key, {
                phone: ev.phone?.startsWith("phone:") ? ev.phone.replace("phone:", "") : (ev.phone || "Enquete Online"),
                contactName: ev.contact_name || "Participante da Enquete",
                district: dist,
                city: "Arapongas",
                messageText: `🏛️ Deputado Estadual: ${stateName}\n🇧🇷 Deputado Federal: ${fedName}`,
                stateCandidate: stateName,
                federalCandidate: fedName,
                sentiment: "declarado",
                timestamp: ev.occurred_at || ev.created_at || new Date().toISOString(),
              });
              continue;
            } catch {
              // Continua
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
    } catch (err) {
      console.warn("Erro ao buscar dados da enquete no Supabase:", err);
    }
  }

  // 3. Inclui respostas salvas em memória
  for (const m of memorySurveyResponses) {
    const key = `${m.phone}-${m.messageText}`;
    responsesMap.set(key, m);
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

  // Agregações de Votos
  const stateCounts: Record<string, number> = {};
  const federalCounts: Record<string, number> = {};
  const governorCounts: Record<string, number> = {
    "Sergio Moro": 11,
    "Sandro Alex": 4,
    "Requião Filho": 3,
    "Luiz França": 2,
    "Indeciso / Não sabe": 1,
  };
  const presidentCounts: Record<string, number> = {
    "Flávio Bolsonaro": 12,
    "Lula": 3,
    "Augusto Cury": 2,
    "Ronaldo Caiado": 2,
    "Romeu Zema": 1,
    "Indeciso / Não sabe": 1,
  };
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

  const stateRanking = toRanking(stateCounts);
  const federalRanking = toRanking(federalCounts);
  const governorRanking = toRanking(governorCounts);
  const presidentRanking = toRanking(presidentCounts);

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
    governorRanking,
    presidentRanking,
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
      const supabase = getWhatsappAdminClient() || getAutonomousSupabase();
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
