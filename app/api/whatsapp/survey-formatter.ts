/**
 * Formatador Universal de Respostas da Enquete e WhatsApp
 * Transforma códigos JSON e IDs técnicos em textos 100% humanizados, legíveis e profissionais.
 */

export const CANDIDATE_NAMES_MAP: Record<string, string> = {
  // Deputados Estaduais
  pedro_paulo_bazana: "Pedro Paulo Bazana",
  bazana: "Pedro Paulo Bazana",
  sergio_onofre: "Sérgio Onofre",
  onofre: "Sérgio Onofre",
  aline_franzon: "Aline Franzon",
  franzon: "Aline Franzon",
  delegado_jacovos: "Delegado Jacovos",
  jacovos: "Delegado Jacovos",
  cobra_reporter: "Cobra Repórter",
  cobra: "Cobra Repórter",

  // Deputados Federais
  neto_santos: "Neto Santos",
  ricardo_barros: "Ricardo Barros",
  pedro_lupion: "Pedro Lupion",
  pedro_upion: "Pedro Lupion",
  lupion: "Pedro Lupion",
  upion: "Pedro Lupion",
  beto_preto: "Beto Preto",
  luciano_ducci: "Luciano Ducci",
  ducci: "Luciano Ducci",
  bonin: "Bonin",
  marco_brasil: "Marco Brasil",
  santin_roveda: "Santin Roveda",

  // Governador
  sergio_moro_pl: "Sergio Moro",
  sergio_moro: "Sergio Moro",
  moro: "Sergio Moro",
  requiao_filho_pdt: "Requião Filho",
  requiao_filho: "Requião Filho",
  requiao: "Requião Filho",
  sandro_alex_psd: "Sandro Alex",
  sandro_alex: "Sandro Alex",
  luiz_franca_missao: "Luiz França",
  luiz_franca: "Luiz França",

  // Presidente
  lula_pt: "Lula",
  lula: "Lula",
  flavio_bolsonaro_pl: "Flávio Bolsonaro",
  flavio_bolsonaro: "Flávio Bolsonaro",
  bolsonaro: "Flávio Bolsonaro",
  augusto_cury_avante: "Augusto Cury",
  augusto_cury: "Augusto Cury",
  cury: "Augusto Cury",
  renan_santos_missao: "Renan Santos",
  renan_santos: "Renan Santos",
  ronaldo_caiado_psd: "Ronaldo Caiado",
  ronaldo_caiado: "Ronaldo Caiado",
  caiado: "Ronaldo Caiado",
  romeu_zema_novo: "Romeu Zema",
  romeu_zema: "Romeu Zema",
  zema: "Romeu Zema",

  // Opções de voto e respostas gerais
  outro: "Outro candidato",
  branco_nulo: "Branco / Nulo",
  ainda_nao_sei: "Indeciso / Ainda não sabe",
  boa: "Boa",
  media: "Regular / Média",
  ruim: "Ruim",
  sim: "Sim",
  nao: "Não",
  indeciso: "Indeciso",
  alguns_nao_lembro: "Alguns / Não lembro",
};

export function formatCandidateOrOption(code?: string): string {
  if (!code) return "";
  const key = code.toLowerCase().trim();
  if (CANDIDATE_NAMES_MAP[key]) return CANDIDATE_NAMES_MAP[key];
  return code
    .replace(/_/g, " ")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Remove aspas externas ou barras invertidas duplicadas de strings JSON serializadas
 */
function cleanRawJson(raw: string): string {
  let s = raw.trim();
  // Se estiver envolvida por aspas duplas externas com JSON dentro
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      const unescaped = JSON.parse(s);
      if (typeof unescaped === "string") {
        s = unescaped.trim();
      }
    } catch {
      s = s.slice(1, -1).trim();
    }
  }
  return s;
}

/**
 * Converte JSON de respostas de enquetes (ex: Arapongas preview) em texto claro e organizado
 */
export function formatReadableSurveyText(rawText?: string | null): string {
  if (!rawText || !rawText.trim()) return "";
  const cleaned = cleanRawJson(rawText);

  // Tenta fazer o parse caso seja JSON de enquete
  if ((cleaned.startsWith("{") && cleaned.endsWith("}")) || cleaned.includes('"poll"') || cleaned.includes('"q1"')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === "object") {
        const lines: string[] = [];

        // 1. Deputado Estadual (q9 ou stateCandidate ou deputado_estadual)
        const est = parsed.q9 || parsed.stateCandidate || parsed.deputado_estadual || parsed.estadual;
        if (est) {
          lines.push(`🏛️ Deputado Estadual: ${formatCandidateOrOption(est)}`);
        }

        // 2. Deputado Federal (q8 ou federalCandidate ou deputado_federal)
        const fed = parsed.q8 || parsed.federalCandidate || parsed.deputado_federal || parsed.federal;
        if (fed) {
          lines.push(`🇧🇷 Deputado Federal: ${formatCandidateOrOption(fed)}`);
        }

        // 3. Governador (q7 ou governorCandidate ou governador)
        const gov = parsed.q7 || parsed.governorCandidate || parsed.governador;
        if (gov) {
          lines.push(`📍 Governador: ${formatCandidateOrOption(gov)}`);
        }

        // 4. Presidente (q6 ou presidentCandidate ou presidente)
        const pres = parsed.q6 || parsed.presidentCandidate || parsed.presidente;
        if (pres) {
          lines.push(`🗳️ Presidente: ${formatCandidateOrOption(pres)}`);
        }

        // 5. Avaliação da Gestão Municipal (q1)
        if (parsed.q1 && (parsed.q6 || parsed.q8 || parsed.q9)) {
          lines.push(`⭐ Gestão Municipal: ${formatCandidateOrOption(parsed.q1)}`);
        }

        // 6. Avaliação da Gestão Estadual (q2)
        if (parsed.q2 && (parsed.q6 || parsed.q8 || parsed.q9)) {
          lines.push(`⭐ Gestão Estadual: ${formatCandidateOrOption(parsed.q2)}`);
        }

        // 7. Bairro / Região
        if (parsed.bairro || parsed.district) {
          lines.push(`📌 Região: ${parsed.bairro || parsed.district}`);
        }

        if (lines.length > 0) {
          return lines.join("\n");
        }
      }
    } catch {
      // Ignora erro e cai no fallback
    }
  }

  // Fallback: se for texto simples, remove aspas extras ao redor
  return cleaned;
}

/**
 * Formata números de telefone ou esconde identificadores/hashes longos de dispositivos web
 */
export function formatDisplayPhone(rawPhone?: string): string {
  if (!rawPhone) return "";
  const trimmed = rawPhone.trim();

  // Se for hash hexadecimal, chave sha256 ou ID numérico de navegador longo (> 14 dígitos)
  const isHash = /^[a-f0-9]{20,}$/i.test(trimmed);
  const digits = trimmed.replace(/\D/g, "");

  if (
    isHash ||
    digits.length > 14 ||
    trimmed.startsWith("device:") ||
    trimmed.startsWith("phone:device") ||
    trimmed.startsWith("web_")
  ) {
    return "Enquete Digital (Web)";
  }

  if (trimmed.startsWith("phone:")) {
    const p = trimmed.replace("phone:", "");
    return formatDisplayPhone(p);
  }

  if (digits.startsWith("55") && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return rawPhone;
}
