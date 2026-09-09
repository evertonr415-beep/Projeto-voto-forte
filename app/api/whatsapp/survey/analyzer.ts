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

const STOP_WORDS_SET = new Set([
  "eu", "meu", "minha", "nosso", "nossa", "aqui", "em", "casa", "familia", "gente",
  "voto", "votar", "votamos", "apoio", "apoiamos", "vou", "vamos", "fechado",
  "com", "no", "na", "nos", "nas", "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "para", "pra", "p/", "de", "do", "da", "dos", "das", "e", "ou", "mas",
  "que", "se", "por", "pelo", "pela", "pelos", "pelas", "bom", "boa", "dia",
  "tarde", "noite", "ola", "olá", "opa", "oi", "amigo", "amiga", "lider", "liderança",
  "deputado", "deputada", "candidato", "candidata", "estadual", "federal",
  "ainda", "acho", "talvez", "duvida", "dúvida", "pensando", "decidindo",
  "nao", "não", "sei", "nenhum", "nenhuma", "nulo", "branco", "ninguem", "ninguém",
  "certeza", "com certeza", "mesmo", "mesma", "todos", "todas"
]);

function sanitizeCandidateRaw(raw: string): string {
  if (!raw) return "";
  let clean = raw
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove preposições ou conectivos iniciais e finais
  clean = clean.replace(/^(no|na|o|a|do|da|de|em|com|para|pra|p\/|e)\s+/i, "");
  clean = clean.replace(/\s+(no|na|o|a|do|da|de|em|com|para|pra|p\/|e)$/i, "");
  clean = clean.replace(/^(deputado|deputada|dep|candidato|candidata)\s+/i, "");
  clean = clean.trim();

  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return "";

  // Se todas as palavras forem stop words, descarta
  const allStop = words.every(w => STOP_WORDS_SET.has(w.toLowerCase()));
  if (allStop) return "";

  // Limite razoável de nome de candidato (até 4 palavras)
  return words.slice(0, 4).join(" ");
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

  const rawText = messageText.trim();
  const lower = rawText.toLowerCase();

  let stateCandidate = "";
  let federalCandidate = "";
  let sentiment: SurveyAnalysisResult["sentiment"] = "neutro";

  // 1. Detecção de Sentimento / Intenção
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
    lower.includes("fechado com") ||
    lower.includes("com certeza") ||
    lower.includes("meu candidato") ||
    lower.includes("com certeza") ||
    lower.includes("vamos de")
  ) {
    sentiment = "declarado";
  } else if (lower.includes("gosto") || lower.includes("simpatizo") || lower.includes("bom") || lower.includes("ajuda")) {
    sentiment = "apoio";
  } else if (lower.includes("ruim") || lower.includes("contra") || lower.includes("não gosto") || lower.includes("pessimo") || lower.includes("péssimo")) {
    sentiment = "critica";
  }

  // 1.1 Suporte a Resposta Estruturada da Enquete Web
  const webMatch = rawText.match(/Estadual:\s*([^|]+)\s*\|\s*Federal:\s*(.+)$/i);
  if (webMatch && webMatch[1] && webMatch[2]) {
    const est = sanitizeCandidateRaw(webMatch[1]);
    const fed = sanitizeCandidateRaw(webMatch[2]);
    if (est) stateCandidate = est;
    if (fed) federalCandidate = fed;
    sentiment = "declarado";
  }

  // 2. Extração de Deputado Estadual
  // Padrão A: Menção com palavra estadual / deputado estadual
  const statePatterns = [
    /(?:estadual|deputado estadual|deputada estadual|dep[\s.]*estadual|p\/[\s]*estadual|pra[\s]*estadual|para[\s]*estadual)[\s:=–-]*([^\n,;e|]+?)(?=(?:\s+e\s+|\s*,\s*|\s*;\s*|\s*\|\s*|\n|federal|deputado federal|deputada federal|$))/i,
    /(?:voto|apoio|fechado com|vou de)[\s]+([^\n,;e|]+?)[\s]+(?:para|pra|p\/|como)?[\s]*(?:estadual|deputado estadual|deputada estadual)/i
  ];

  for (const pattern of statePatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const sanitized = sanitizeCandidateRaw(match[1]);
      if (sanitized && sanitized.length >= 2 && !sanitized.toLowerCase().includes("indeciso") && !sanitized.toLowerCase().includes("não sei")) {
        stateCandidate = sanitized;
        break;
      }
    }
  }

  // 3. Extração de Deputado Federal
  // Padrão A: Menção com palavra federal / deputado federal
  const federalPatterns = [
    /(?:federal|deputado federal|deputada federal|dep[\s.]*federal|p\/[\s]*federal|pra[\s]*federal|para[\s]*federal)[\s:=–-]*([^\n,;e]+?)(?=(?:\s+e\s+|\s*,\s*|\s*;\s*|\n|estadual|deputado estadual|deputada estadual|$))/i,
    /(?:voto|apoio|fechado com|vou de)[\s]+([^\n,;e]+?)[\s]+(?:para|pra|p\/|como)?[\s]*(?:federal|deputado federal|deputada federal)/i
  ];

  for (const pattern of federalPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const sanitized = sanitizeCandidateRaw(match[1]);
      if (sanitized && sanitized.length >= 2 && !sanitized.toLowerCase().includes("indeciso") && !sanitized.toLowerCase().includes("não sei")) {
        federalCandidate = sanitized;
        break;
      }
    }
  }

  // 4. Padrão "Voto no [Nome1] e no [Nome2]" ou "[Nome1] e [Nome2]"
  if (!stateCandidate && !federalCandidate && sentiment !== "indeciso") {
    const doubleMatch = rawText.match(/(?:voto no|voto na|apoio o|apoio a|vou de|fechado com)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,25})\s+(?:e|e no|e na)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{2,25})/i);
    if (doubleMatch && doubleMatch[1] && doubleMatch[2]) {
      const c1 = sanitizeCandidateRaw(doubleMatch[1]);
      const c2 = sanitizeCandidateRaw(doubleMatch[2]);
      if (c1) stateCandidate = c1;
      if (c2) federalCandidate = c2;
    }
  }

  // 5. Se ainda não achou e for resposta direta com 1 nome
  if (!stateCandidate && !federalCandidate && sentiment !== "indeciso") {
    const directCleaned = rawText
      .replace(/^(olá|ola|bom dia|boa tarde|boa noite|tudo bem|opa|opa amigo|salve|fala)[,\s!]*/gi, "")
      .replace(/^(eu voto no|eu voto na|meu voto é|vou votar no|vou com o|fechado com|aqui é|com certeza no|vamos de)[,\s]*/gi, "")
      .replace(/[.!?,]/g, "")
      .trim();

    const sanitizedDirect = sanitizeCandidateRaw(directCleaned);
    if (sanitizedDirect && sanitizedDirect.length >= 2 && sanitizedDirect.length <= 35 && !sanitizedDirect.includes("?")) {
      stateCandidate = sanitizedDirect;
    }
  }

  return {
    phone: fromPhone,
    contactName,
    district,
    city,
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
