"use client";

import { useEffect } from "react";

type SurveyResponse = {
  phone?: string;
  contactName?: string;
  district?: string;
  city?: string;
  messageText?: string;
  timestamp?: string;
};

type SurveyPayload = {
  success?: boolean;
  totalResponses?: number;
  responses?: SurveyResponse[];
};

type IdentifiedPayload = {
  success?: boolean;
  total?: number;
  responses?: SurveyResponse[];
};

type OriginKind = "all" | "link" | "broadcast";
type OriginItem = SurveyResponse & { id: string; origin: Exclude<OriginKind, "all"> };
type ViewState = {
  filter: OriginKind;
  search: string;
  district: string;
  candidate: string;
  page: number;
};

type ParsedVoteRow = {
  role: string;
  candidate: string;
  avatarUrl?: string;
  initials: string;
};

const TAB_ID = "vf-survey-origin-monitor-tab";
const PANEL_ID = "vf-survey-origin-panel";
const STYLE_ID = "vf-survey-origin-styles-v4";
const PAGE_SIZE = 15;

const CANDIDATE_PHOTOS: Record<string, string> = {
  "sergio onofre": "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  "pedro paulo bazana": "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  "bazana": "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  "aline franzon": "https://operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/3d/3d52390db67b93f272fe787733302a2aa3c14fffa9028456a5cc4388f595cffc.jpg",
  "delegado jacovos": "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  "jacovos": "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  "cobra reporter": "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
  "cobra": "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
  
  "pedro lupion": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204374.jpg",
  "lupion": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204374.jpg",
  "beto preto": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220557.jpg",
  "luciano ducci": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  "ducci": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  "marco brasil": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/219585.jpg",
  "neto santos": "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
  "bonin": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  "santin roveda": "https://www.jornalafolha.com.br/uploads/images/2026/03/santin-roveda-destaca-projeto-de-lei-que-ira-reduzir-valor-de-exames-para-tirar-a-cnh.jpg",

  "sandro alex": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/160621.jpg",
  "sergio moro": "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador5988.jpg",
  "moro": "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador5988.jpg",
  "luiz franca": "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
  "requiao filho": "https://storage2.assembleia.pr.leg.br/img/y3n1sE1n35-E4-L_2B8B_P5U3qQ=/full-fit-in/300x300/deputados/requiao-filho.png",

  "alexandre curi": "https://storage2.assembleia.pr.leg.br/img/y3n1sE1n35-E4-L_2B8B_P5U3qQ=/full-fit-in/300x300/deputados/alexandre-curi.png",
  "cristina graeml": "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
  "deltan dallagnol": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220559.jpg",
  "filipe barros": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204374.jpg",
  "gleisi": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/74416.jpg",
  "dr rosinha": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73459.jpg",

  "flavio bolsonaro": "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador5953.jpg",
  "bolsonaro": "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador5953.jpg",
  "lula": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Foto_Oficial_do_Presidente_Luiz_In%C3%A1cio_Lula_da_Silva_-_3.jpg/300px-Foto_Oficial_do_Presidente_Luiz_In%C3%A1cio_Lula_da_Silva_-_3.jpg",
  "renan santos": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Renan_Santos_em_2022.jpg/300px-Renan_Santos_em_2022.jpg",
  "augusto cury": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Augusto_Cury.jpg/300px-Augusto_Cury.jpg",
  "cury": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Augusto_Cury.jpg/300px-Augusto_Cury.jpg",
  "ronaldo caiado": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Ronaldo_Caiado_foto_oficial.jpg/300px-Ronaldo_Caiado_foto_oficial.jpg",
  "caiado": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Ronaldo_Caiado_foto_oficial.jpg/300px-Ronaldo_Caiado_foto_oficial.jpg",
  "romeu zema": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Romeu_Zema_foto_oficial.jpg/300px-Romeu_Zema_foto_oficial.jpg",
  "zema": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Romeu_Zema_foto_oficial.jpg/300px-Romeu_Zema_foto_oficial.jpg",
};

function normalize(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function digits(value = "") {
  return value.replace(/\D/g, "");
}

function realPhone(value = "") {
  const only = digits(value);
  return only.length >= 10 && only.length <= 15;
}

function genericName(value = "") {
  const name = normalize(value);
  return (
    !name ||
    name === "eleitor" ||
    name === "eleitor arapongas" ||
    name.includes("participante da enquete")
  );
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCandidateAvatar(candidateName: string): string {
  const clean = normalize(candidateName);
  for (const [key, url] of Object.entries(CANDIDATE_PHOTOS)) {
    if (clean.includes(key) || key.includes(clean)) return url;
  }
  return "";
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function parseMessageVotes(rawText?: string): ParsedVoteRow[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const parsedRows: ParsedVoteRow[] = [];

  for (const line of lines) {
    // Procura padrões como "🏛️ Deputado Estadual: Sérgio Onofre" ou "Deputado Federal: Beto Preto"
    const match = line.match(/(?:🏛️|🇧🇷|📍|🗳️|👤|📌)?\s*(Deputado Estadual|Deputado Federal|Governador|Senador|Presidente)\s*:\s*(.+)/i);
    if (match) {
      const role = match[1].trim();
      const candidate = match[2].trim();
      parsedRows.push({
        role,
        candidate,
        avatarUrl: getCandidateAvatar(candidate),
        initials: getInitials(candidate) || "VF",
      });
    }
  }

  // Se não foi em formato de linhas com emojis/dois pontos, tenta JSON
  if (parsedRows.length === 0 && (rawText.includes("{") || rawText.includes("stateCandidate"))) {
    try {
      const obj = JSON.parse(rawText);
      const mappings: [string, string][] = [
        ["Deputado Estadual", obj.q9 || obj.stateCandidate || obj.deputado_estadual],
        ["Deputado Federal", obj.q8 || obj.federalCandidate || obj.deputado_federal],
        ["Governador", obj.q7 || obj.governorCandidate || obj.governador],
        ["Senador", obj.senatorCandidate || obj.senador],
        ["Presidente", obj.q6 || obj.presidentCandidate || obj.presidente],
      ];
      for (const [role, val] of mappings) {
        if (val) {
          const candidate = String(val).replace(/_/g, " ").toUpperCase();
          parsedRows.push({
            role,
            candidate,
            avatarUrl: getCandidateAvatar(candidate),
            initials: getInitials(candidate) || "VF",
          });
        }
      }
    } catch {}
  }

  return parsedRows;
}

function buttonLabels(container: Element) {
  return Array.from(container.children)
    .filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement)
    .map((button) => normalize(button.textContent || ""));
}

function isMonitorFilterBar(container: Element) {
  const labels = buttonLabels(container);
  const hasErrors = labels.some((label) => label.includes("falhas") || label.includes("erros"));
  const hasReplies = labels.some(
    (label) => label.includes("respostas") && !label.includes("sem resposta"),
  );
  const hasNoReply = labels.some((label) => label.includes("sem resposta"));
  return hasErrors && hasReplies && hasNoReply;
}

function findMonitorFilterBar() {
  const candidates = Array.from(document.querySelectorAll("div")).filter((node) =>
    isMonitorFilterBar(node),
  );
  return candidates.sort((a, b) => a.childElementCount - b.childElementCount)[0] as
    | HTMLElement
    | undefined;
}

function createStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${TAB_ID}{white-space:nowrap!important}
    #${TAB_ID}.is-active{border-color:rgba(56,189,248,.58)!important;background:rgba(14,116,144,.22)!important;color:#7dd3fc!important;box-shadow:0 0 0 1px rgba(56,189,248,.08) inset!important}
    #${PANEL_ID}{display:none;width:100%;box-sizing:border-box;margin-top:12px;padding:18px;border:1px solid rgba(56,189,248,.28);border-radius:18px;background:linear-gradient(180deg,rgba(8,27,49,.98),rgba(8,20,38,.98));box-shadow:0 14px 34px rgba(2,8,23,.24)}
    #${PANEL_ID}.is-open{display:block}
    
    .vf-origin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .vf-origin-head h3{margin:0;color:#f8fafc;font-size:20px;font-weight:800;display:flex;align-items:center;gap:8px}
    .vf-origin-head p{margin:6px 0 0;color:#94a3b8;font-size:13px;line-height:1.45;max-width:720px}
    .vf-origin-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .vf-btn-action{border:1px solid rgba(56,189,248,.28);background:rgba(14,116,144,.18);color:#7dd3fc;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:750;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease}
    .vf-btn-action:hover{background:rgba(14,116,144,.35);border-color:#38bdf8;color:#fff}
    .vf-btn-pdf{background:linear-gradient(135deg,rgba(168,85,247,.25),rgba(192,132,252,.15));border-color:rgba(192,132,252,.4);color:#e9d5ff}
    .vf-btn-pdf:hover{background:linear-gradient(135deg,rgba(168,85,247,.45),rgba(192,132,252,.3));border-color:#d8b4fe;color:#fff}
    .vf-btn-csv{background:linear-gradient(135deg,rgba(34,197,94,.18),rgba(74,222,128,.12));border-color:rgba(74,222,128,.35);color:#86efac}
    .vf-btn-csv:hover{background:linear-gradient(135deg,rgba(34,197,94,.3),rgba(74,222,128,.22));border-color:#4ade80;color:#fff}

    .vf-origin-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
    .vf-origin-kpi{padding:16px;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:rgba(15,23,42,.66)}
    .vf-origin-kpi strong{display:block;font-size:26px;color:#f8fafc;font-weight:800}
    .vf-origin-kpi span{display:block;margin-top:4px;color:#94a3b8;font-size:11.5px;font-weight:700}
    .vf-origin-kpi.link strong{color:#38bdf8}
    .vf-origin-kpi.broadcast strong{color:#34d399}

    .vf-origin-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .vf-origin-filters{display:flex;gap:8px;flex-wrap:wrap}
    .vf-origin-filter{border:1px solid rgba(148,163,184,.18);background:rgba(30,41,59,.58);color:#aebbd0;border-radius:999px;padding:8px 14px;font-size:11.5px;font-weight:750;cursor:pointer;transition:all .15s ease}
    .vf-origin-filter:hover{background:rgba(51,65,85,.7);color:#fff}
    .vf-origin-filter.is-active{border-color:rgba(56,189,248,.54);background:rgba(14,116,144,.25);color:#e0f2fe;box-shadow:0 0 10px rgba(56,189,248,.15)}
    
    .vf-origin-dropdowns{display:flex;gap:8px;flex-wrap:wrap;flex:1;max-width:560px}
    .vf-origin-select{border:1px solid rgba(148,163,184,.2);background:#07172c;color:#e2e8f0;border-radius:10px;padding:8px 12px;font-size:11.5px;outline:none;font-weight:600;min-width:140px;flex:1}
    .vf-origin-search{min-width:220px;flex:1.5;border:1px solid rgba(148,163,184,.2);background:#07172c;color:#e2e8f0;border-radius:10px;padding:8px 12px;font-size:12px;outline:none}

    .vf-origin-list{display:grid;gap:12px}
    .vf-origin-card{padding:16px;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.7);box-shadow:0 4px 20px rgba(0,0,0,.2)}
    .vf-origin-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .vf-origin-person strong{display:block;color:#f8fafc;font-size:14.5px;font-weight:800}
    .vf-origin-person span{display:block;color:#7dd3fc;font-size:11.5px;margin-top:2px;font-weight:600}
    .vf-origin-badge{flex:none;border-radius:999px;padding:5px 10px;font-size:9.5px;font-weight:850;letter-spacing:.03em}
    .vf-origin-badge.link{background:rgba(56,189,248,.14);border:1px solid rgba(56,189,248,.3);color:#7dd3fc}
    .vf-origin-badge.broadcast{background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.32);color:#6ee7b7}

    /* Caixa estilizada dos votos com layout idêntico ao print */
    .vf-choices-box{border:1px solid rgba(168,85,247,.25);border-radius:12px;background:rgba(30,19,56,.4);padding:10px 14px;display:grid;gap:8px;box-shadow:inset 0 0 16px rgba(168,85,247,.06)}
    .vf-choice-row{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:9px;background:rgba(15,23,42,.5);border:1px solid rgba(148,163,184,.08)}
    .vf-candidate-avatar{width:36px;height:36px;min-width:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(192,132,252,.5);background:#1e1b4b;display:grid;place-items:center;color:#e9d5ff;font-size:11px;font-weight:800}
    .vf-choice-info{display:flex;flex-direction:column;gap:1px}
    .vf-choice-role{font-size:10.5px;color:#94a3b8;font-weight:600}
    .vf-choice-candidate{font-size:12.5px;color:#c084fc;font-weight:800;letter-spacing:.02em}

    .vf-origin-raw{font-size:12px;color:#f8fafc;white-space:pre-wrap;line-height:1.5;padding:8px 10px;background:rgba(15,23,42,.6);border-left:3px solid #c084fc;border-radius:7px}
    .vf-origin-time{margin-top:10px;color:#64748b;font-size:10.5px;text-align:right;font-weight:600}
    
    .vf-origin-empty{padding:36px 14px;text-align:center;border:1px dashed rgba(148,163,184,.2);border-radius:14px;color:#94a3b8;font-size:13px;line-height:1.5}
    .vf-origin-pagination{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:16px}
    .vf-origin-page-btn{border:1px solid rgba(56,189,248,.25);background:rgba(15,23,42,.75);color:#cbd5e1;border-radius:9px;padding:8px 14px;font-size:11.5px;font-weight:750;cursor:pointer}
    .vf-origin-page-btn:disabled{opacity:.35;cursor:default}
    .vf-origin-page-label{color:#94a3b8;font-size:12px;text-align:center;font-weight:600}
    .vf-origin-note{margin:12px 0 0;color:#6f8098;font-size:11px;line-height:1.45}

    @media print {
      body * { visibility: hidden !important; }
      #vf-print-report-container, #vf-print-report-container * { visibility: visible !important; }
      #vf-print-report-container {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        background: #0f172a !important;
        color: #f8fafc !important;
        padding: 20px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        box-sizing: border-box !important;
      }
      .vf-print-page-break { page-break-after: always; }
      .vf-origin-card { break-inside: avoid !important; page-break-inside: avoid !important; margin-bottom: 12px !important; border: 1px solid #334155 !important; }
    }

    @media(max-width:760px){
      #${TAB_ID}{flex:none!important;padding-left:13px!important;padding-right:13px!important}
      #${PANEL_ID}{padding:14px;border-radius:14px}
      .vf-origin-kpis{grid-template-columns:1fr 1fr}
      .vf-origin-kpi:first-child{grid-column:1/-1}
      .vf-origin-kpi{padding:12px}
      .vf-origin-kpi strong{font-size:22px}
      .vf-origin-dropdowns{width:100%;max-width:none}
      .vf-origin-search{max-width:none;width:100%;min-width:0}
      .vf-origin-tools{align-items:stretch}
      .vf-origin-filters{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}
      .vf-origin-filter{white-space:nowrap}
      .vf-origin-card{padding:12px}
    }
  `;
  document.head.appendChild(style);
}

function buildItems(survey: SurveyPayload, identifiedPayload: IdentifiedPayload): OriginItem[] {
  const linked: OriginItem[] = (Array.isArray(survey.responses) ? survey.responses : []).map(
    (response, index) => ({
      ...response,
      id: `link-${index}-${response.timestamp || ""}`,
      origin: "link",
    }),
  );

  const seen = new Set<string>();
  const identified: OriginItem[] = [];
  for (const response of Array.isArray(identifiedPayload.responses)
    ? identifiedPayload.responses
    : []) {
    if (!realPhone(response.phone || "") || genericName(response.contactName || "")) continue;
    const phone = digits(response.phone || "");
    const text = response.messageText || "Resposta identificada no Monitor";
    const key = `${phone}-${normalize(text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    identified.push({
      ...response,
      city: response.city || "Arapongas",
      id: `broadcast-${phone}-${identified.length}`,
      origin: "broadcast",
    });
  }

  return [...linked, ...identified].sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
  );
}

function renderVoteCardHtml(item: OriginItem): string {
  const isLink = item.origin === "link";
  const safeName = isLink
    ? "Participante via link"
    : item.contactName || "Contato identificado";
  const secondary = isLink
    ? `${item.city || "Arapongas"}${item.district && item.district !== "Não informado" ? ` · ${item.district}` : ""}`
    : `${item.phone || "Telefone identificado"}${item.district ? ` · ${item.district}` : ""}`;

  const votes = parseMessageVotes(item.messageText);

  let votesHtml = "";
  if (votes.length > 0) {
    const rows = votes
      .map((v) => {
        const avatarElement = v.avatarUrl
          ? `<img class="vf-candidate-avatar" src="${escapeHtml(v.avatarUrl)}" alt="${escapeHtml(v.candidate)}" onerror="this.outerHTML='<div class=\\'vf-candidate-avatar\\'>${escapeHtml(v.initials)}</div>'" />`
          : `<div class="vf-candidate-avatar">${escapeHtml(v.initials)}</div>`;
        return `
          <div class="vf-choice-row">
            ${avatarElement}
            <div class="vf-choice-info">
              <span class="vf-choice-role">${escapeHtml(v.role)}</span>
              <span class="vf-choice-candidate">${escapeHtml(v.candidate.toUpperCase())}</span>
            </div>
          </div>
        `;
      })
      .join("");
    votesHtml = `<div class="vf-choices-box">${rows}</div>`;
  } else {
    votesHtml = `<div class="vf-origin-raw">${escapeHtml(item.messageText || "Resposta registrada")}</div>`;
  }

  return `
    <article class="vf-origin-card">
      <div class="vf-origin-card-head">
        <div class="vf-origin-person">
          <strong>${escapeHtml(safeName)}</strong>
          <span>${escapeHtml(secondary)}</span>
        </div>
        <span class="vf-origin-badge ${item.origin}">${isLink ? "🔗 VIA LINK" : "📲 VIA DISPARO"}</span>
      </div>
      ${votesHtml}
      <div class="vf-origin-time">${escapeHtml(formatTime(item.timestamp))}</div>
    </article>
  `;
}

function triggerPdfReport(
  items: OriginItem[],
  totalLinked: number,
  totalIdentified: number,
  state: ViewState,
) {
  // Remove container antigo se existir
  document.getElementById("vf-print-report-container")?.remove();

  const container = document.createElement("div");
  container.id = "vf-print-report-container";

  const cardsHtml = items.map((item) => renderVoteCardHtml(item)).join("");

  const filterDescription =
    state.filter === "all"
      ? "Todas as origens"
      : state.filter === "link"
      ? "Somente Via Link"
      : "Somente Via Disparo";

  const districtDescription = state.district ? ` · Bairro: ${state.district}` : "";
  const candidateDescription = state.candidate ? ` · Candidato: ${state.candidate}` : "";

  container.innerHTML = `
    <div style="border-bottom: 2px solid #38bdf8; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="margin: 0; font-size: 22px; color: #f8fafc; font-weight: 800;">🧭 VotoForte Paraná — Relatório de Respostas da Enquete</h1>
        <p style="margin: 5px 0 0; font-size: 13px; color: #94a3b8;">Filtro: <strong>${filterDescription}${districtDescription}${candidateDescription}</strong> · Emitido em: ${new Date().toLocaleString("pt-BR")}</p>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; padding: 6px 12px; background: rgba(56,189,248,0.2); border: 1px solid #38bdf8; border-radius: 8px; color: #7dd3fc; font-weight: 800; font-size: 13px;">
          ${items.length} Registros Exportados
        </span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
      <div style="background: rgba(30,41,59,0.8); border: 1px solid #475569; padding: 12px 16px; border-radius: 10px;">
        <span style="font-size: 11px; color: #94a3b8; display: block; font-weight: bold;">TOTAL NESTA VISÃO</span>
        <strong style="font-size: 22px; color: #f8fafc;">${items.length}</strong>
      </div>
      <div style="background: rgba(30,41,59,0.8); border: 1px solid #475569; padding: 12px 16px; border-radius: 10px;">
        <span style="font-size: 11px; color: #38bdf8; display: block; font-weight: bold;">VIA LINK</span>
        <strong style="font-size: 22px; color: #38bdf8;">${totalLinked}</strong>
      </div>
      <div style="background: rgba(30,41,59,0.8); border: 1px solid #475569; padding: 12px 16px; border-radius: 10px;">
        <span style="font-size: 11px; color: #34d399; display: block; font-weight: bold;">VIA DISPARO</span>
        <strong style="font-size: 22px; color: #34d399;">${totalIdentified}</strong>
      </div>
    </div>

    <div style="display: grid; gap: 14px;">
      ${cardsHtml}
    </div>
  `;

  document.body.appendChild(container);

  // Aciona a impressão nativa / PDF
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => {
      container.remove();
    }, 1000);
  }, 300);
}

function triggerCsvExport(items: OriginItem[]) {
  if (!items.length) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  const headers = [
    "Identificação",
    "Telefone",
    "Origem",
    "Cidade",
    "Bairro",
    "Deputado Estadual",
    "Deputado Federal",
    "Governador",
    "Senador",
    "Presidente",
    "Texto Completo da Resposta",
    "Data e Hora",
  ];

  const rows = items.map((item) => {
    const isLink = item.origin === "link";
    const name = isLink ? "Participante via link" : item.contactName || "Contato identificado";
    const phone = isLink ? "Não informado" : item.phone || "";
    const origin = isLink ? "Via Link" : "Via Disparo WhatsApp";
    const city = item.city || "Arapongas";
    const district = item.district || "";

    const votes = parseMessageVotes(item.messageText);
    const est = votes.find((v) => v.role.includes("Estadual"))?.candidate || "";
    const fed = votes.find((v) => v.role.includes("Federal"))?.candidate || "";
    const gov = votes.find((v) => v.role.includes("Governador"))?.candidate || "";
    const sen = votes.find((v) => v.role.includes("Senador"))?.candidate || "";
    const pres = votes.find((v) => v.role.includes("Presidente"))?.candidate || "";

    return [
      `"${name.replace(/"/g, '""')}"`,
      `"${phone.replace(/"/g, '""')}"`,
      `"${origin}"`,
      `"${city.replace(/"/g, '""')}"`,
      `"${district.replace(/"/g, '""')}"`,
      `"${est.replace(/"/g, '""')}"`,
      `"${fed.replace(/"/g, '""')}"`,
      `"${gov.replace(/"/g, '""')}"`,
      `"${sen.replace(/"/g, '""')}"`,
      `"${pres.replace(/"/g, '""')}"`,
      `"${(item.messageText || "").replace(/"/g, '""')}"`,
      `"${formatTime(item.timestamp)}"`,
    ];
  });

  const csv = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `VotoForte-Respostas-Enquete-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderPanel(
  panel: HTMLElement,
  survey: SurveyPayload,
  identifiedPayload: IdentifiedPayload,
  state: ViewState,
) {
  const items = buildItems(survey, identifiedPayload);
  const identified = items.filter((item) => item.origin === "broadcast");
  const linked = items.filter((item) => item.origin === "link");

  // Lista dinâmica de bairros para o filtro
  const districtSet = new Set<string>();
  items.forEach((i) => {
    if (i.district && i.district !== "Não informado") districtSet.add(i.district);
  });
  const districtOptions = Array.from(districtSet).sort();

  const needle = normalize(state.search);
  const candidateNeedle = normalize(state.candidate);
  const districtNeedle = normalize(state.district);

  const filtered = items.filter((item) => {
    if (state.filter !== "all" && item.origin !== state.filter) return false;
    if (districtNeedle && normalize(item.district || "") !== districtNeedle) return false;
    if (candidateNeedle && !normalize(item.messageText || "").includes(candidateNeedle)) return false;
    if (!needle) return true;
    return normalize(
      `${item.contactName || ""} ${item.phone || ""} ${item.district || ""} ${item.messageText || ""}`,
    ).includes(needle);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.max(1, Math.min(state.page, totalPages));
  const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  const cards = visible.length
    ? visible.map((item) => renderVoteCardHtml(item)).join("")
    : `<div class="vf-origin-empty">Nenhuma resposta encontrada com os filtros selecionados.</div>`;

  panel.innerHTML = `
    <div class="vf-origin-head">
      <div>
        <h3>🧭 Origem das Respostas da Enquete</h3>
        <p>“Via disparo” usa o histórico identificado do Monitor, com nome e telefone quando já reconhecidos pelo sistema. “Via link” mantém as participações web sem identificação pessoal.</p>
      </div>
      <div class="vf-origin-actions">
        <button type="button" class="vf-btn-action vf-origin-refresh" title="Atualizar dados">↻ Atualizar</button>
        <button type="button" class="vf-btn-action vf-btn-pdf vf-origin-export-pdf" title="Salvar relatório em PDF">📄 Salvar em PDF</button>
        <button type="button" class="vf-btn-action vf-btn-csv vf-origin-export-csv" title="Exportar tabela em Excel/CSV">📊 Exportar CSV</button>
      </div>
    </div>

    <div class="vf-origin-kpis">
      <div class="vf-origin-kpi">
        <strong>${items.length}</strong>
        <span>Respostas nesta visão</span>
      </div>
      <div class="vf-origin-kpi link">
        <strong>${linked.length}</strong>
        <span>Via link / sem identificação</span>
      </div>
      <div class="vf-origin-kpi broadcast">
        <strong>${identified.length}</strong>
        <span>Via disparo com nome reconhecido</span>
      </div>
    </div>

    <div class="vf-origin-tools">
      <div class="vf-origin-filters">
        <button type="button" data-origin-filter="all" class="vf-origin-filter ${state.filter === "all" ? "is-active" : ""}">Todos (${items.length})</button>
        <button type="button" data-origin-filter="link" class="vf-origin-filter ${state.filter === "link" ? "is-active" : ""}">🔗 Via link (${linked.length})</button>
        <button type="button" data-origin-filter="broadcast" class="vf-origin-filter ${state.filter === "broadcast" ? "is-active" : ""}">📲 Via disparo (${identified.length})</button>
      </div>

      <div class="vf-origin-dropdowns">
        <select class="vf-origin-select vf-origin-filter-district">
          <option value="">Todos os Bairros</option>
          ${districtOptions.map((d) => `<option value="${escapeHtml(d)}" ${state.district === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
        </select>

        <select class="vf-origin-select vf-origin-filter-candidate">
          <option value="">Todos os Candidatos</option>
          <optgroup label="Deputado Estadual">
            <option value="Sérgio Onofre" ${state.candidate === "Sérgio Onofre" ? "selected" : ""}>Sérgio Onofre</option>
            <option value="Bazana" ${state.candidate === "Bazana" ? "selected" : ""}>Pedro Paulo Bazana</option>
            <option value="Cobra Repórter" ${state.candidate === "Cobra Repórter" ? "selected" : ""}>Cobra Repórter</option>
            <option value="Jacovos" ${state.candidate === "Jacovos" ? "selected" : ""}>Delegado Jacovos</option>
            <option value="Aline Franzon" ${state.candidate === "Aline Franzon" ? "selected" : ""}>Aline Franzon</option>
          </optgroup>
          <optgroup label="Deputado Federal">
            <option value="Pedro Lupion" ${state.candidate === "Pedro Lupion" ? "selected" : ""}>Pedro Lupion</option>
            <option value="Beto Preto" ${state.candidate === "Beto Preto" ? "selected" : ""}>Beto Preto</option>
            <option value="Luciano Ducci" ${state.candidate === "Luciano Ducci" ? "selected" : ""}>Luciano Ducci</option>
            <option value="Marco Brasil" ${state.candidate === "Marco Brasil" ? "selected" : ""}>Marco Brasil</option>
            <option value="Neto Santos" ${state.candidate === "Neto Santos" ? "selected" : ""}>Neto Santos</option>
          </optgroup>
          <optgroup label="Governador">
            <option value="Sandro Alex" ${state.candidate === "Sandro Alex" ? "selected" : ""}>Sandro Alex</option>
            <option value="Sergio Moro" ${state.candidate === "Sergio Moro" ? "selected" : ""}>Sergio Moro</option>
            <option value="Luiz França" ${state.candidate === "Luiz França" ? "selected" : ""}>Luiz França</option>
            <option value="Requião Filho" ${state.candidate === "Requião Filho" ? "selected" : ""}>Requião Filho</option>
          </optgroup>
          <optgroup label="Presidente">
            <option value="Flávio Bolsonaro" ${state.candidate === "Flávio Bolsonaro" ? "selected" : ""}>Flávio Bolsonaro</option>
            <option value="Lula" ${state.candidate === "Lula" ? "selected" : ""}>Lula</option>
            <option value="Renan Santos" ${state.candidate === "Renan Santos" ? "selected" : ""}>Renan Santos</option>
            <option value="Augusto Cury" ${state.candidate === "Augusto Cury" ? "selected" : ""}>Augusto Cury</option>
            <option value="Ronaldo Caiado" ${state.candidate === "Ronaldo Caiado" ? "selected" : ""}>Ronaldo Caiado</option>
          </optgroup>
        </select>

        <input class="vf-origin-search" type="search" placeholder="Buscar nome, telefone, bairro..." value="${escapeHtml(state.search)}" />
      </div>
    </div>

    <div class="vf-origin-list">${cards}</div>

    <div class="vf-origin-pagination">
      <button type="button" class="vf-origin-page-btn" data-page-action="prev" ${state.page <= 1 ? "disabled" : ""}>← Anterior</button>
      <span class="vf-origin-page-label">Página ${state.page} de ${totalPages} · ${filtered.length} respostas filtradas</span>
      <button type="button" class="vf-origin-page-btn" data-page-action="next" ${state.page >= totalPages ? "disabled" : ""}>Próxima →</button>
    </div>

    <p class="vf-origin-note">Nenhum voto ou resposta é alterado. Esta tela apenas organiza os dados já existentes com auditoria em tempo real.</p>
  `;
}

function restoreNativeContent(parent: HTMLElement) {
  parent.querySelectorAll<HTMLElement>("[data-vf-origin-hidden='1']").forEach((node) => {
    node.style.display = node.dataset.vfOriginPreviousDisplay || "";
    delete node.dataset.vfOriginHidden;
    delete node.dataset.vfOriginPreviousDisplay;
  });
}

function toggleNativeContent(filterBar: HTMLElement, panel: HTMLElement, active: boolean) {
  const parent = filterBar.parentElement;
  if (!parent) return;
  restoreNativeContent(parent);
  if (!active) return;

  let afterBar = false;
  Array.from(parent.children).forEach((child) => {
    if (child === filterBar) {
      afterBar = true;
      return;
    }
    if (!afterBar || child === panel || !(child instanceof HTMLElement)) return;
    child.dataset.vfOriginPreviousDisplay = child.style.display || "";
    child.dataset.vfOriginHidden = "1";
    child.style.display = "none";
  });
}

export default function WhatsappSurveyOriginMonitorV4() {
  useEffect(() => {
    createStyles();
    let active = false;
    let survey: SurveyPayload = {};
    let identifiedPayload: IdentifiedPayload = {};
    const state: ViewState = {
      filter: "all",
      search: "",
      district: "",
      candidate: "",
      page: 1,
    };
    let loading = false;
    let currentBar: HTMLElement | null = null;

    const draw = () => {
      const panel = document.getElementById(PANEL_ID);
      if (panel) renderPanel(panel, survey, identifiedPayload, state);
    };

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [surveyResponse, identifiedResponse] = await Promise.all([
          fetch("/api/whatsapp/survey", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/whatsapp/survey-origin", { cache: "no-store", credentials: "same-origin" }),
        ]);
        const [surveyData, identifiedData] = await Promise.all([
          surveyResponse.json().catch(() => ({})),
          identifiedResponse.json().catch(() => ({})),
        ]);
        if (surveyResponse.ok && surveyData?.success) survey = surveyData as SurveyPayload;
        if (identifiedResponse.ok && identifiedData?.success) {
          identifiedPayload = identifiedData as IdentifiedPayload;
        }
      } finally {
        loading = false;
        draw();
      }
    };

    const detachFromOldBar = () => {
      if (!currentBar) return;
      if (currentBar.parentElement) restoreNativeContent(currentBar.parentElement);
      currentBar = null;
    };

    const sync = () => {
      const filterBar = findMonitorFilterBar();
      if (!filterBar) {
        detachFromOldBar();
        document.getElementById(TAB_ID)?.remove();
        document.getElementById(PANEL_ID)?.remove();
        active = false;
        return;
      }
      if (currentBar && currentBar !== filterBar) detachFromOldBar();
      currentBar = filterBar;

      let button = document.getElementById(TAB_ID) as HTMLButtonElement | null;
      if (!button || button.parentElement !== filterBar) {
        button?.remove();
        const repliesButton = Array.from(filterBar.children).find(
          (node) =>
            node instanceof HTMLButtonElement &&
            normalize(node.textContent || "").includes("respostas") &&
            !normalize(node.textContent || "").includes("sem resposta"),
        ) as HTMLButtonElement | undefined;
        button = document.createElement("button");
        button.id = TAB_ID;
        button.type = "button";
        button.title = "Origem das respostas da enquete";
        button.textContent = "🧭 Origem";
        button.className = repliesButton?.className || "";
        const baseStyle = repliesButton?.getAttribute("style");
        if (baseStyle) button.setAttribute("style", baseStyle);
        filterBar.appendChild(button);
      }
      button.classList.toggle("is-active", active);

      const parent = filterBar.parentElement;
      if (!parent) return;
      let panel = document.getElementById(PANEL_ID) as HTMLElement | null;
      if (!panel || panel.parentElement !== parent) {
        panel?.remove();
        panel = document.createElement("section");
        panel.id = PANEL_ID;
        filterBar.insertAdjacentElement("afterend", panel);
        draw();
      }
      panel.classList.toggle("is-open", active);
      toggleNativeContent(filterBar, panel, active);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest(`#${TAB_ID}`)) {
        event.preventDefault();
        event.stopPropagation();
        active = true;
        state.page = 1;
        sync();
        void load();
        return;
      }

      const nativeButton = target.closest("button");
      const filterBar = findMonitorFilterBar();
      if (
        active &&
        nativeButton &&
        filterBar &&
        nativeButton.parentElement === filterBar &&
        nativeButton.id !== TAB_ID
      ) {
        active = false;
        window.setTimeout(sync, 0);
        return;
      }

      // Filtro de origem
      const filterButton = target.closest("[data-origin-filter]") as HTMLElement | null;
      if (filterButton) {
        const filter = filterButton.dataset.originFilter as OriginKind;
        if (filter === "all" || filter === "link" || filter === "broadcast") {
          state.filter = filter;
          state.page = 1;
          draw();
        }
        return;
      }

      // Paginação
      const pageButton = target.closest("[data-page-action]") as HTMLElement | null;
      if (pageButton) {
        state.page += pageButton.dataset.pageAction === "next" ? 1 : -1;
        draw();
        return;
      }

      // Exportar PDF
      if (target.closest(".vf-origin-export-pdf")) {
        const items = buildItems(survey, identifiedPayload);
        const identified = items.filter((item) => item.origin === "broadcast");
        const linked = items.filter((item) => item.origin === "link");
        const needle = normalize(state.search);
        const candidateNeedle = normalize(state.candidate);
        const districtNeedle = normalize(state.district);

        const filtered = items.filter((item) => {
          if (state.filter !== "all" && item.origin !== state.filter) return false;
          if (districtNeedle && normalize(item.district || "") !== districtNeedle) return false;
          if (candidateNeedle && !normalize(item.messageText || "").includes(candidateNeedle)) return false;
          if (!needle) return true;
          return normalize(
            `${item.contactName || ""} ${item.phone || ""} ${item.district || ""} ${item.messageText || ""}`,
          ).includes(needle);
        });

        triggerPdfReport(filtered, linked.length, identified.length, state);
        return;
      }

      // Exportar CSV
      if (target.closest(".vf-origin-export-csv")) {
        const items = buildItems(survey, identifiedPayload);
        const needle = normalize(state.search);
        const candidateNeedle = normalize(state.candidate);
        const districtNeedle = normalize(state.district);

        const filtered = items.filter((item) => {
          if (state.filter !== "all" && item.origin !== state.filter) return false;
          if (districtNeedle && normalize(item.district || "") !== districtNeedle) return false;
          if (candidateNeedle && !normalize(item.messageText || "").includes(candidateNeedle)) return false;
          if (!needle) return true;
          return normalize(
            `${item.contactName || ""} ${item.phone || ""} ${item.district || ""} ${item.messageText || ""}`,
          ).includes(needle);
        });

        triggerCsvExport(filtered);
        return;
      }

      // Atualizar
      if (target.closest(".vf-origin-refresh")) void load();
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains("vf-origin-search")) {
        return;
      }
      state.search = target.value;
      state.page = 1;
      draw();
      const replacement = document.querySelector<HTMLInputElement>(".vf-origin-search");
      replacement?.focus();
      replacement?.setSelectionRange(state.search.length, state.search.length);
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;

      if (target.classList.contains("vf-origin-filter-district")) {
        state.district = target.value;
        state.page = 1;
        draw();
      } else if (target.classList.contains("vf-origin-filter-candidate")) {
        state.candidate = target.value;
        state.page = 1;
        draw();
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onChange, true);
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onChange, true);
      if (currentBar?.parentElement) restoreNativeContent(currentBar.parentElement);
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
      document.getElementById("vf-print-report-container")?.remove();
    };
  }, []);

  return null;
}
