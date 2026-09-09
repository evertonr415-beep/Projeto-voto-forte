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

/**
 * Normaliza número de telefone para busca
 */
function cleanPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Analisa e extrai menções a candidatos a deputado estadual e federal do texto
 */
export async function analyzeSurveyResponse(
  fromPhone: string,
  messageText: string,
): Promise<SurveyAnalysisResult> {
  const cleanPhone = cleanPhoneDigits(fromPhone);
  let contactName = "Eleitor";
  let district = "Não informado";
  let city = "Arapongas";

  // Busca dados cadastrais do eleitor no Supabase
  try {
    const supabase = getAutonomousSupabase();
    const { data } = await supabase
      .from("vf_contacts")
      .select("name, district, city, phone")
      .or(`phone.ilike.%${cleanPhone}%,phone.ilike.%${cleanPhone.slice(-8)}%`)
      .limit(1);

    if (data && data.length > 0) {
      const c = data[0];
      if (c.name) contactName = c.name;
      if (c.district) district = c.district;
      if (c.city) city = c.city;
    }
  } catch {
    // Silencia erro se offline
  }

  const text = messageText.trim();
  const lower = text.toLowerCase();

  let stateCandidate = "";
  let federalCandidate = "";
  let sentiment: SurveyAnalysisResult["sentiment"] = "neutro";

  // Detecção de Sentimento / Intenção
  if (
    lower.includes("não sei") ||
    lower.includes("indeciso") ||
    lower.includes("ainda não") ||
    lower.includes("duvida") ||
    lower.includes("nenhum") ||
    lower.includes("nulo")
  ) {
    sentiment = "indeciso";
  } else if (
    lower.includes("voto") ||
    lower.includes("apoio") ||
    lower.includes("vou de") ||
    lower.includes("fechado com") ||
    lower.includes("com certeza") ||
    lower.includes("meu candidato")
  ) {
    sentiment = "declarado";
  } else if (lower.includes("gosto") || lower.includes("simpatizo") || lower.includes("bom")) {
    sentiment = "apoio";
  } else if (lower.includes("ruim") || lower.includes("contra") || lower.includes("não gosto")) {
    sentiment = "critica";
  }

  // Regex e padrões de extração para Deputado Estadual
  const stateRegex =
    /(?:estadual|deputado estadual|p\/ estadual|pra estadual|dep estadual)[\s:]*([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,25}?)(?:e|,|\.|\n|federal|deputado federal|$)/i;
  const stateMatch = text.match(stateRegex);
  if (stateMatch && stateMatch[1]) {
    const candidate = stateMatch[1].trim().replace(/\b(e|para|pra|o|a|no|na)\b/gi, "").trim();
    if (candidate.length >= 2 && !candidate.toLowerCase().includes("indeciso")) {
      stateCandidate = candidate;
    }
  }

  // Regex e padrões de extração para Deputado Federal
  const federalRegex =
    /(?:federal|deputado federal|p\/ federal|pra federal|dep federal)[\s:]*([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,25}?)(?:e|,|\.|\n|estadual|deputado estadual|$)/i;
  const federalMatch = text.match(federalRegex);
  if (federalMatch && federalMatch[1]) {
    const candidate = federalMatch[1].trim().replace(/\b(e|para|pra|o|a|no|na)\b/gi, "").trim();
    if (candidate.length >= 2 && !candidate.toLowerCase().includes("indeciso")) {
      federalCandidate = candidate;
    }
  }

  // Se não encontrou por prefixo formal, tenta extrair nomes diretos
  if (!stateCandidate && !federalCandidate && sentiment !== "indeciso") {
    // Remove palavras comuns para capturar o nome citado
    const cleaned = text
      .replace(/^(olá|ola|bom dia|boa tarde|boa noite|tudo bem|opa|opa amigo)[,\s!]*/gi, "")
      .replace(/^(eu voto no|eu voto na|meu voto é|vou votar no|vou com o|fechado com)[,\s]*/gi, "")
      .trim();

    if (cleaned.length > 2 && cleaned.length < 35 && !cleaned.includes("?")) {
      stateCandidate = cleaned;
    }
  }

  return {
    phone: fromPhone,
    contactName,
    district,
    city,
    messageText,
    stateCandidate: stateCandidate ? formatCandidateName(stateCandidate) : "Não especificado / Em aberto",
    federalCandidate: federalCandidate ? formatCandidateName(federalCandidate) : "Não especificado / Em aberto",
    sentiment,
    timestamp: new Date().toISOString(),
  };
}

function formatCandidateName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
