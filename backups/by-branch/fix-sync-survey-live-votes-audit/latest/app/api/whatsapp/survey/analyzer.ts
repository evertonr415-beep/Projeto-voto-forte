import { getAutonomousSupabase } from "../../../supabase-server";

export interface SurveyAnalysisResult {
  phone: string;
  contactName: string;
  district: string;
  city: string;
  messageText: string;
  stateCandidate: string;
  federalCandidate: string;
  sentiment: "declarado" | "indeciso" | "apoio" | "critica" | "neutro";
  timestamp: string;
}

function cleanPhoneDigits(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

// Candidatos Conhecidos do Paraná / Arapongas para Reconhecimento de Menção
const KNOWN_STATE_CANDIDATES = [
  { name: "Pedro Paulo Bazana", keywords: ["bazana", "pedro paulo", "pedro paulo bazana"] },
  { name: "Sérgio Onofre", keywords: ["sergio onofre", "sérgio onofre", "onofre"] },
  { name: "Aline Franzon", keywords: ["aline", "franzon", "aline franzon"] },
  { name: "Delegado Jacovos", keywords: ["jacovos", "delegado jacovos", "delegado"] },
  { name: "Cobra Repórter", keywords: ["cobra", "cobra reporter", "cobra repórter"] },
  { name: "Neto Santos", keywords: ["neto santos", "neto"] },
  { name: "Beto Preto", keywords: ["beto preto", "beto"] },
  { name: "Requião Filho", keywords: ["requiao filho", "requião filho", "requiao"] },
  { name: "Santin Roveda", keywords: ["santin", "roveda", "santin roveda"] },
  { name: "Bonin", keywords: ["bonin"] },
  { name: "Luiz França", keywords: ["luiz frança", "luiz franca", "frança"] },
];

const KNOWN_FEDERAL_CANDIDATES = [
  { name: "Pedro Lupion", keywords: ["lupion", "pedro lupion"] },
  { name: "Ricardo Barros", keywords: ["ricardo barros", "barros"] },
  { name: "Sergio Moro", keywords: ["moro", "sergio moro", "sérgio moro"] },
  { name: "Luciano Ducci", keywords: ["ducci", "luciano ducci"] },
  { name: "Marco Brasil", keywords: ["marco brasil", "brasil"] },
  { name: "Sandro Alex", keywords: ["sandro alex", "sandro"] },
  { name: "Felipe Francischini", keywords: ["francischini", "felipe francischini"] },
  { name: "Beto Richa", keywords: ["beto richa", "richa"] },
  { name: "Giacobo", keywords: ["giacobo", "fernando giacobo"] },
  { name: "Luisa Canziani", keywords: ["canziani", "luisa canziani"] },
  { name: "Diego Garcia", keywords: ["diego garcia", "garcia"] },
];

export async function analyzeSurveyResponse(
  fromPhone: string,
  messageText: string,
): Promise<SurveyAnalysisResult> {
  const cleanPhone = cleanPhoneDigits(fromPhone);
  let contactName = "Eleitor";
  let district = "Arapongas";
  let city = "Arapongas";

  // Busca dados cadastrais do eleitor no Supabase vf_owned_records
  try {
    const supabase = getAutonomousSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("vf_owned_records")
        .select("payload")
        .eq("kind", "contact")
        .limit(2000);

      if (Array.isArray(data)) {
        for (const row of data) {
          const p = (row.payload || {}) as Record<string, unknown>;
          const rawP = String(p.phone || p.phoneNormalized || "").replace(/\D/g, "");
          if (rawP.includes(cleanPhone) || cleanPhone.includes(rawP.slice(-8))) {
            if (p.name) contactName = String(p.name).trim();
            if (p.district || p.bairro) district = String(p.district || p.bairro).trim();
            if (p.city) city = String(p.city).trim();
            break;
          }
        }
      }
    }
  } catch {
    // Silencia
  }

  const rawText = messageText.trim();
  const lower = rawText.toLowerCase();

  let stateCandidate = "";
  let federalCandidate = "";
  let sentiment: SurveyAnalysisResult["sentiment"] = "neutro";

  // 1. Trata JSON estruturado de enquete
  if (rawText.startsWith("{") && rawText.endsWith("}")) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.q1 || parsed.stateCandidate || parsed.deputado_estadual) {
        stateCandidate = String(parsed.q1 || parsed.stateCandidate || parsed.deputado_estadual);
      }
      if (parsed.q2 || parsed.federalCandidate || parsed.deputado_federal) {
        federalCandidate = String(parsed.q2 || parsed.federalCandidate || parsed.deputado_federal);
      }
      if (parsed.bairro || parsed.district) {
        district = String(parsed.bairro || parsed.district);
      }
      sentiment = "declarado";
    } catch {
      // Ignora erro de parse
    }
  }

  // 2. Sentimento / Intenção
  if (
    lower.includes("não sei") ||
    lower.includes("indeciso") ||
    lower.includes("ainda não") ||
    lower.includes("duvida") ||
    lower.includes("dúvida") ||
    lower.includes("nenhum") ||
    lower.includes("nulo") ||
    lower.includes("branco")
  ) {
    sentiment = "indeciso";
  } else if (
    lower.includes("voto") ||
    lower.includes("apoio") ||
    lower.includes("vou de") ||
    lower.includes("fechado") ||
    lower.includes("meu candidato") ||
    lower.includes("já tenho") ||
    lower.includes("ja tenho")
  ) {
    sentiment = "declarado";
  } else if (lower.includes("gosto") || lower.includes("simpatizo") || lower.includes("bom")) {
    sentiment = "apoio";
  }

  // 3. Reconhecimento de Candidatos por Dicionário de Palavras-Chave
  if (!stateCandidate) {
    for (const cand of KNOWN_STATE_CANDIDATES) {
      if (cand.keywords.some((kw) => lower.includes(kw))) {
        stateCandidate = cand.name;
        if (sentiment === "neutro") sentiment = "declarado";
        break;
      }
    }
  }

  if (!federalCandidate) {
    for (const cand of KNOWN_FEDERAL_CANDIDATES) {
      if (cand.keywords.some((kw) => lower.includes(kw))) {
        federalCandidate = cand.name;
        if (sentiment === "neutro") sentiment = "declarado";
        break;
      }
    }
  }

  // 4. Extração via Regex Genérico se não achou no catálogo
  if (!stateCandidate && sentiment !== "indeciso") {
    const stateMatch = rawText.match(/(?:estadual|deputado estadual|p\/ estadual)[\s:=–-]*([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,25})/i);
    if (stateMatch && stateMatch[1]) {
      stateCandidate = formatCandidateName(stateMatch[1]);
    }
  }

  if (!federalCandidate && sentiment !== "indeciso") {
    const fedMatch = rawText.match(/(?:federal|deputado federal|p\/ federal)[\s:=–-]*([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,25})/i);
    if (fedMatch && fedMatch[1]) {
      federalCandidate = formatCandidateName(fedMatch[1]);
    }
  }

  return {
    phone: fromPhone,
    contactName,
    district: district || "Arapongas",
    city: city || "Arapongas",
    messageText: rawText,
    stateCandidate: stateCandidate ? formatCandidateName(stateCandidate) : "Não especificado / Em aberto",
    federalCandidate: federalCandidate ? formatCandidateName(federalCandidate) : "Não especificado / Em aberto",
    sentiment,
    timestamp: new Date().toISOString(),
  };
}

export function formatCandidateName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
