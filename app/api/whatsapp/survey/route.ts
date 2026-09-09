import { getAccount } from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";
import { analyzeSurveyResponse, type SurveyAnalysisResult } from "./analyzer";

// Armazenamento em memória / fallback rápido para respostas de sondagem
let memorySurveyResponses: SurveyAnalysisResult[] = [];

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterDistrict = searchParams.get("district") || "all";

  let responses = [...memorySurveyResponses];

  // Tenta carregar do Supabase registros persistidos de auditoria/respostas
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

        if (text && !text.startsWith("[Mídia") && !responses.some((r) => r.messageText === text)) {
          const parsed = await analyzeSurveyResponse(phone, text);
          parsed.timestamp = row.created_at || new Date().toISOString();
          responses.unshift(parsed);
        }
      }
    }
  } catch {
    // Silencia se indisponível
  }

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
    if (r.district) {
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
      topStateCandidate: stateRanking[0]?.candidate || "Nenhum ainda",
      topFederalCandidate: federalRanking[0]?.candidate || "Nenhum ainda",
      activeDistrictsCount: districtRanking.length,
    },
    stateRanking,
    federalRanking,
    districtRanking,
    responses,
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { phone: string; message: string };
    if (!body.phone || !body.message) {
      return Response.json({ error: "Telefone e mensagem são obrigatórios" }, { status: 400 });
    }

    const analyzed = await analyzeSurveyResponse(body.phone, body.message);
    memorySurveyResponses.unshift(analyzed);

    return Response.json({ success: true, analysis: analyzed });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao processar resposta." },
      { status: 500 },
    );
  }
}
