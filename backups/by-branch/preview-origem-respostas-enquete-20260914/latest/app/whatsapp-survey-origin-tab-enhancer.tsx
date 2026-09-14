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

type MonitorItem = {
  phone?: string;
  contactName?: string;
  sentAt?: string;
  repliedAt?: string;
  status?: string;
};

type MonitorPayload = {
  success?: boolean;
  items?: MonitorItem[];
};

type OriginKind = "all" | "link" | "broadcast";
type OriginItem = SurveyResponse & { id: string; origin: Exclude<OriginKind, "all"> };

const TAB_ID = "vf-survey-origin-tab";
const PANEL_ID = "vf-survey-origin-panel";
const PAGE_SIZE = 15;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function digits(value = "") {
  return value.replace(/\D/g, "");
}

function realPhone(value = "") {
  const only = digits(value);
  return only.length >= 10 && only.length <= 15;
}

function isWhatsappTabs(container: Element) {
  const labels = Array.from(container.children)
    .filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement)
    .map((button) => normalize(button.textContent || ""));
  return labels.some((label) => label.includes("chat")) && labels.some((label) => label.includes("monitor")) && labels.some((label) => label.includes("disparos"));
}

function findWhatsappTabs() {
  return Array.from(document.querySelectorAll("div")).find((node) => isWhatsappTabs(node)) as HTMLElement | undefined;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function createStyles() {
  if (document.getElementById("vf-survey-origin-styles")) return;
  const style = document.createElement("style");
  style.id = "vf-survey-origin-styles";
  style.textContent = `
    #${TAB_ID}{justify-content:center!important;min-width:58px!important;overflow:visible!important}
    #${TAB_ID} .vf-origin-tab-icon{display:inline-block!important;font-size:18px!important;line-height:1!important}
    #${TAB_ID} .vf-origin-tab-label{display:inline!important}
    #${PANEL_ID}{display:none;grid-column:1/-1;margin-bottom:18px;padding:18px;border:1px solid rgba(56,189,248,.28);border-radius:16px;background:linear-gradient(180deg,rgba(8,27,49,.98),rgba(8,20,38,.98));box-shadow:0 14px 34px rgba(2,8,23,.24)}
    #${PANEL_ID}.is-open{display:block}
    .vf-origin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}.vf-origin-head h3{margin:0;color:#f8fafc;font-size:18px}.vf-origin-head p{margin:5px 0 0;color:#94a3b8;font-size:12px;line-height:1.45;max-width:690px}
    .vf-origin-refresh{border:1px solid rgba(56,189,248,.28);background:rgba(14,116,144,.14);color:#7dd3fc;border-radius:9px;padding:8px 12px;font-weight:750;cursor:pointer}
    .vf-origin-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.vf-origin-kpi{padding:14px;border:1px solid rgba(148,163,184,.14);border-radius:13px;background:rgba(15,23,42,.66)}.vf-origin-kpi strong{display:block;font-size:24px;color:#f8fafc}.vf-origin-kpi span{display:block;margin-top:3px;color:#94a3b8;font-size:11px;font-weight:720}.vf-origin-kpi.link strong{color:#38bdf8}.vf-origin-kpi.broadcast strong{color:#34d399}
    .vf-origin-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:13px}.vf-origin-filters{display:flex;gap:7px;flex-wrap:wrap}.vf-origin-filter{border:1px solid rgba(148,163,184,.18);background:rgba(30,41,59,.58);color:#aebbd0;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:750;cursor:pointer}.vf-origin-filter.is-active{border-color:rgba(56,189,248,.54);background:rgba(14,116,144,.22);color:#e0f2fe}.vf-origin-search{min-width:240px;flex:1;max-width:390px;border:1px solid rgba(148,163,184,.18);background:#07172c;color:#e2e8f0;border-radius:9px;padding:9px 11px;outline:none}
    .vf-origin-list{display:grid;gap:9px}.vf-origin-card{padding:12px;border:1px solid rgba(148,163,184,.14);border-radius:12px;background:rgba(15,23,42,.64)}.vf-origin-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.vf-origin-person{min-width:0}.vf-origin-person strong{display:block;color:#f8fafc;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vf-origin-person span{display:block;color:#7dd3fc;font-size:10.5px;margin-top:2px}.vf-origin-badge{flex:none;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850}.vf-origin-badge.link{background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.26);color:#7dd3fc}.vf-origin-badge.broadcast{background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.27);color:#6ee7b7}.vf-origin-reply.wt-reply-detail{margin-top:6px;border-left:3px solid #c084fc;background:rgba(168,85,247,.12);padding:8px 10px;border-radius:7px}.vf-origin-raw{font-size:12px;color:#f8fafc;white-space:pre-wrap;line-height:1.45}.vf-origin-time{margin-top:7px;color:#64748b;font-size:10px;text-align:right}.vf-origin-empty{padding:30px 14px;text-align:center;border:1px dashed rgba(148,163,184,.18);border-radius:12px;color:#94a3b8;font-size:12px;line-height:1.5}
    .vf-origin-pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:13px}.vf-origin-page-btn{border:1px solid rgba(56,189,248,.25);background:rgba(15,23,42,.72);color:#cbd5e1;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:750;cursor:pointer}.vf-origin-page-btn:disabled{opacity:.35;cursor:default}.vf-origin-page-label{color:#94a3b8;font-size:11px}.vf-origin-note{margin:10px 0 0;color:#6f8098;font-size:10.5px;line-height:1.45}
    @media(max-width:760px){#${TAB_ID}{flex:0 0 58px!important;width:58px!important;padding:10px!important}#${TAB_ID} .vf-origin-tab-label{display:none!important}#${PANEL_ID}{padding:13px;border-radius:14px}.vf-origin-kpis{grid-template-columns:1fr 1fr}.vf-origin-kpi:first-child{grid-column:1/-1}.vf-origin-kpi{padding:11px}.vf-origin-kpi strong{font-size:21px}.vf-origin-search{max-width:none;width:100%;min-width:0}.vf-origin-tools{align-items:stretch}.vf-origin-filters{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.vf-origin-filter{white-space:nowrap}.vf-origin-card{padding:10px}}
  `;
  document.head.appendChild(style);
}

function classify(responses: SurveyResponse[], broadcastPhones: Set<string>): OriginItem[] {
  return responses.map((response, index) => {
    const phone = digits(response.phone || "");
    const identified = realPhone(response.phone || "") && broadcastPhones.has(phone);
    return { ...response, id: `survey-${index}-${response.timestamp || ""}-${phone || "anon"}`, origin: identified ? "broadcast" : "link" };
  });
}

function renderPanel(panel: HTMLElement, survey: SurveyPayload, monitor: MonitorPayload, state: { filter: OriginKind; search: string; page: number }) {
  const broadcastPhones = new Set((monitor.items || []).filter((item) => realPhone(item.phone || "") && Boolean(item.sentAt)).map((item) => digits(item.phone || "")));
  const items = classify(Array.isArray(survey.responses) ? survey.responses : [], broadcastPhones);
  const identified = items.filter((item) => item.origin === "broadcast");
  const linked = items.filter((item) => item.origin === "link");
  const total = Math.max(Number(survey.totalResponses || 0), items.length);
  const needle = normalize(state.search);
  const filtered = items.filter((item) => {
    if (state.filter !== "all" && item.origin !== state.filter) return false;
    if (!needle) return true;
    return normalize(`${item.contactName || ""} ${item.phone || ""} ${item.district || ""} ${item.messageText || ""}`).includes(needle);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;
  const start = (state.page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const cards = visible.length ? visible.map((item) => {
    const isLink = item.origin === "link";
    const genericName = normalize(item.contactName || "");
    const safeName = isLink || genericName === "eleitor arapongas" || genericName.includes("participante da enquete") ? "Participante via link" : (item.contactName || "Contato identificado");
    const secondary = isLink ? `${item.city || "Arapongas"}${item.district && item.district !== "Não informado" ? ` · ${item.district}` : ""}` : `${item.phone || "Contato do disparo"}${item.district && item.district !== "Não informado" ? ` · ${item.district}` : ""}`;
    return `<article class="vf-origin-card"><div class="vf-origin-card-head"><div class="vf-origin-person"><strong>${escapeHtml(safeName)}</strong><span>${escapeHtml(secondary)}</span></div><span class="vf-origin-badge ${item.origin}">${isLink ? "🔗 VIA LINK" : "📲 VIA DISPARO"}</span></div><div class="vf-origin-reply wt-reply-detail"><div class="vf-origin-raw">${escapeHtml(item.messageText || "Resposta registrada")}</div></div><div class="vf-origin-time">${escapeHtml(formatTime(item.timestamp))}</div></article>`;
  }).join("") : `<div class="vf-origin-empty">Nenhuma participação encontrada para este filtro.</div>`;

  panel.innerHTML = `<div class="vf-origin-head"><div><h3>🧭 Origem das Respostas da Enquete</h3><p>Todos os dados já existentes da enquete, separados entre participações sem vínculo identificável e respostas vinculadas a um contato de disparo.</p></div><button type="button" class="vf-origin-refresh">↻ Atualizar</button></div><div class="vf-origin-kpis"><div class="vf-origin-kpi"><strong>${total}</strong><span>Total de participações existentes</span></div><div class="vf-origin-kpi link"><strong>${linked.length}</strong><span>Via link / sem vínculo de contato</span></div><div class="vf-origin-kpi broadcast"><strong>${identified.length}</strong><span>Via disparo identificado</span></div></div><div class="vf-origin-tools"><div class="vf-origin-filters"><button type="button" data-origin-filter="all" class="vf-origin-filter ${state.filter === "all" ? "is-active" : ""}">Todos (${items.length})</button><button type="button" data-origin-filter="link" class="vf-origin-filter ${state.filter === "link" ? "is-active" : ""}">🔗 Via link (${linked.length})</button><button type="button" data-origin-filter="broadcast" class="vf-origin-filter ${state.filter === "broadcast" ? "is-active" : ""}">📲 Via disparo (${identified.length})</button></div><input class="vf-origin-search" type="search" placeholder="Buscar nome, telefone, bairro ou resposta..." value="${escapeHtml(state.search)}" /></div><div class="vf-origin-list">${cards}</div><div class="vf-origin-pagination"><button type="button" class="vf-origin-page-btn" data-page-action="prev" ${state.page <= 1 ? "disabled" : ""}>← Anterior</button><span class="vf-origin-page-label">Página ${state.page} de ${totalPages} · ${filtered.length} registros</span><button type="button" class="vf-origin-page-btn" data-page-action="next" ${state.page >= totalPages ? "disabled" : ""}>Próxima →</button></div><p class="vf-origin-note">Os registros existentes não são alterados. “Via disparo” só é usado quando o sistema já possui um telefone real com envio registrado; os demais permanecem em “Via link”, sem tentar identificar pessoas por IP ou dispositivo.</p>`;
}

export default function WhatsappSurveyOriginTabEnhancer() {
  useEffect(() => {
    createStyles();
    let active = false;
    let survey: SurveyPayload = {};
    let monitor: MonitorPayload = {};
    const state: { filter: OriginKind; search: string; page: number } = { filter: "all", search: "", page: 1 };
    let loading = false;

    const draw = () => { const panel = document.getElementById(PANEL_ID); if (panel) renderPanel(panel, survey, monitor, state); };
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [surveyResponse, monitorResponse] = await Promise.all([
          fetch("/api/whatsapp/survey", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/whatsapp/monitor?filter=all&limit=300", { cache: "no-store", credentials: "same-origin" }),
        ]);
        const [surveyData, monitorData] = await Promise.all([surveyResponse.json().catch(() => ({})), monitorResponse.json().catch(() => ({}))]);
        if (surveyResponse.ok && surveyData?.success) survey = surveyData as SurveyPayload;
        if (monitorResponse.ok && monitorData?.success) monitor = monitorData as MonitorPayload;
      } finally { loading = false; draw(); }
    };

    const sync = () => {
      const tabs = findWhatsappTabs();
      if (!tabs) return;
      let button = document.getElementById(TAB_ID) as HTMLButtonElement | null;
      if (!button) {
        const monitorButton = Array.from(tabs.children).find((node) => node instanceof HTMLButtonElement && normalize(node.textContent || "").includes("monitor")) as HTMLButtonElement | undefined;
        button = document.createElement("button"); button.id = TAB_ID; button.type = "button"; button.title = "Origem das respostas da enquete"; button.innerHTML = '<span class="vf-origin-tab-icon">🧭</span><span class="vf-origin-tab-label">Origem</span>';
        const baseStyle = monitorButton?.getAttribute("style"); if (baseStyle) button.setAttribute("style", baseStyle); tabs.appendChild(button);
      }
      button.style.borderColor = active ? "#22d3ee" : "rgba(255, 255, 255, 0.12)"; button.style.background = active ? "rgba(34, 211, 238, 0.16)" : "rgba(15, 23, 42, 0.7)"; button.style.color = active ? "#67e8f9" : "#94a3b8";
      let panel = document.getElementById(PANEL_ID) as HTMLElement | null;
      if (!panel) { panel = document.createElement("section"); panel.id = PANEL_ID; tabs.insertAdjacentElement("afterend", panel); draw(); }
      panel.classList.toggle("is-open", active);
      const nativeContent = panel.nextElementSibling as HTMLElement | null; if (nativeContent) nativeContent.style.display = active ? "none" : "";
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target; if (!(target instanceof Element)) return;
      if (target.closest(`#${TAB_ID}`)) { event.preventDefault(); event.stopPropagation(); active = true; state.page = 1; sync(); void load(); return; }
      const nativeButton = target.closest("button");
      if (active && nativeButton && nativeButton.parentElement && isWhatsappTabs(nativeButton.parentElement) && nativeButton.id !== TAB_ID) { active = false; window.setTimeout(sync, 0); return; }
      const filterButton = target.closest("[data-origin-filter]") as HTMLElement | null;
      if (filterButton) { const filter = filterButton.dataset.originFilter as OriginKind; if (["all","link","broadcast"].includes(filter)) { state.filter = filter; state.page = 1; draw(); } return; }
      const pageButton = target.closest("[data-page-action]") as HTMLElement | null;
      if (pageButton) { state.page += pageButton.dataset.pageAction === "next" ? 1 : -1; draw(); return; }
      if (target.closest(".vf-origin-refresh")) void load();
    };
    const onInput = (event: Event) => {
      const target = event.target; if (!(target instanceof HTMLInputElement) || !target.classList.contains("vf-origin-search")) return;
      state.search = target.value; state.page = 1; draw(); const replacement = document.querySelector<HTMLInputElement>(".vf-origin-search"); replacement?.focus(); replacement?.setSelectionRange(state.search.length, state.search.length);
    };

    document.addEventListener("click", onClick, true); document.addEventListener("input", onInput, true);
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync)); observer.observe(document.body, { childList: true, subtree: true }); sync();
    return () => { observer.disconnect(); document.removeEventListener("click", onClick, true); document.removeEventListener("input", onInput, true); document.getElementById(TAB_ID)?.remove(); document.getElementById(PANEL_ID)?.remove(); document.getElementById("vf-survey-origin-styles")?.remove(); };
  }, []);
  return null;
}
