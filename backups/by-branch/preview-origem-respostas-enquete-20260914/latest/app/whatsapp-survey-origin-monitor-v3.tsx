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
  district?: string;
  status?: string;
  replyText?: string;
  lastMessageText?: string;
  repliedAt?: string;
  sentAt?: string;
};

type MonitorPayload = {
  success?: boolean;
  items?: MonitorItem[];
};

type OriginKind = "all" | "link" | "broadcast";
type OriginItem = SurveyResponse & { id: string; origin: Exclude<OriginKind, "all"> };
type ViewState = { filter: OriginKind; search: string; page: number };

const TAB_ID = "vf-survey-origin-monitor-tab";
const PANEL_ID = "vf-survey-origin-panel";
const STYLE_ID = "vf-survey-origin-styles-v3";
const PAGE_SIZE = 15;

function normalize(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
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
  return !name || name === "eleitor" || name === "eleitor arapongas" || name.includes("participante da enquete");
}

function escapeHtml(value = "") {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buttonLabels(container: Element) {
  return Array.from(container.children)
    .filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement)
    .map((button) => normalize(button.textContent || ""));
}

function isMonitorFilterBar(container: Element) {
  const labels = buttonLabels(container);
  const hasErrors = labels.some((label) => label.includes("falhas") || label.includes("erros"));
  const hasReplies = labels.some((label) => label.includes("respostas") && !label.includes("sem resposta"));
  const hasNoReply = labels.some((label) => label.includes("sem resposta"));
  return hasErrors && hasReplies && hasNoReply;
}

function findMonitorFilterBar() {
  const candidates = Array.from(document.querySelectorAll("div")).filter((node) => isMonitorFilterBar(node));
  return candidates.sort((a, b) => a.childElementCount - b.childElementCount)[0] as HTMLElement | undefined;
}

function createStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${TAB_ID}{white-space:nowrap!important}
    #${TAB_ID}.is-active{border-color:rgba(56,189,248,.58)!important;background:rgba(14,116,144,.22)!important;color:#7dd3fc!important;box-shadow:0 0 0 1px rgba(56,189,248,.08) inset!important}
    #${PANEL_ID}{display:none;width:100%;box-sizing:border-box;margin-top:12px;padding:16px;border:1px solid rgba(56,189,248,.28);border-radius:16px;background:linear-gradient(180deg,rgba(8,27,49,.98),rgba(8,20,38,.98));box-shadow:0 14px 34px rgba(2,8,23,.24)}
    #${PANEL_ID}.is-open{display:block}
    .vf-origin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}.vf-origin-head h3{margin:0;color:#f8fafc;font-size:18px}.vf-origin-head p{margin:5px 0 0;color:#94a3b8;font-size:12px;line-height:1.45;max-width:690px}
    .vf-origin-refresh{border:1px solid rgba(56,189,248,.28);background:rgba(14,116,144,.14);color:#7dd3fc;border-radius:9px;padding:8px 12px;font-weight:750;cursor:pointer}
    .vf-origin-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.vf-origin-kpi{padding:14px;border:1px solid rgba(148,163,184,.14);border-radius:13px;background:rgba(15,23,42,.66)}.vf-origin-kpi strong{display:block;font-size:24px;color:#f8fafc}.vf-origin-kpi span{display:block;margin-top:3px;color:#94a3b8;font-size:11px;font-weight:720}.vf-origin-kpi.link strong{color:#38bdf8}.vf-origin-kpi.broadcast strong{color:#34d399}
    .vf-origin-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:13px}.vf-origin-filters{display:flex;gap:7px;flex-wrap:wrap}.vf-origin-filter{border:1px solid rgba(148,163,184,.18);background:rgba(30,41,59,.58);color:#aebbd0;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:750;cursor:pointer}.vf-origin-filter.is-active{border-color:rgba(56,189,248,.54);background:rgba(14,116,144,.22);color:#e0f2fe}.vf-origin-search{min-width:240px;flex:1;max-width:390px;border:1px solid rgba(148,163,184,.18);background:#07172c;color:#e2e8f0;border-radius:9px;padding:9px 11px;outline:none}
    .vf-origin-list{display:grid;gap:9px}.vf-origin-card{padding:12px;border:1px solid rgba(148,163,184,.14);border-radius:12px;background:rgba(15,23,42,.64)}.vf-origin-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.vf-origin-person{min-width:0}.vf-origin-person strong{display:block;color:#f8fafc;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vf-origin-person span{display:block;color:#7dd3fc;font-size:10.5px;margin-top:2px}.vf-origin-badge{flex:none;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850}.vf-origin-badge.link{background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.26);color:#7dd3fc}.vf-origin-badge.broadcast{background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.27);color:#6ee7b7}
    .vf-origin-reply.wt-reply-detail{margin-top:6px;border-left:3px solid #c084fc;background:rgba(168,85,247,.12);padding:8px 10px;border-radius:7px}.vf-origin-raw{font-size:12px;color:#f8fafc;white-space:pre-wrap;line-height:1.45}.vf-origin-time{margin-top:7px;color:#64748b;font-size:10px;text-align:right}.vf-origin-empty{padding:30px 14px;text-align:center;border:1px dashed rgba(148,163,184,.18);border-radius:12px;color:#94a3b8;font-size:12px;line-height:1.5}.vf-origin-pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:13px}.vf-origin-page-btn{border:1px solid rgba(56,189,248,.25);background:rgba(15,23,42,.72);color:#cbd5e1;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:750;cursor:pointer}.vf-origin-page-btn:disabled{opacity:.35;cursor:default}.vf-origin-page-label{color:#94a3b8;font-size:11px;text-align:center}.vf-origin-note{margin:10px 0 0;color:#6f8098;font-size:10.5px;line-height:1.45}
    @media(max-width:760px){#${TAB_ID}{flex:none!important;padding-left:13px!important;padding-right:13px!important}#${PANEL_ID}{padding:13px;border-radius:14px}.vf-origin-kpis{grid-template-columns:1fr 1fr}.vf-origin-kpi:first-child{grid-column:1/-1}.vf-origin-kpi{padding:11px}.vf-origin-kpi strong{font-size:21px}.vf-origin-search{max-width:none;width:100%;min-width:0}.vf-origin-tools{align-items:stretch}.vf-origin-filters{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.vf-origin-filter{white-space:nowrap}.vf-origin-card{padding:10px}}
  `;
  document.head.appendChild(style);
}

function buildItems(survey: SurveyPayload, monitor: MonitorPayload): OriginItem[] {
  const linked: OriginItem[] = (Array.isArray(survey.responses) ? survey.responses : []).map((response, index) => ({
    ...response,
    id: `link-${index}-${response.timestamp || ""}`,
    origin: "link",
  }));

  const seen = new Set<string>();
  const identified: OriginItem[] = [];
  for (const item of Array.isArray(monitor.items) ? monitor.items : []) {
    if (!realPhone(item.phone || "") || genericName(item.contactName || "")) continue;
    const text = item.replyText || item.lastMessageText || "Resposta registrada no Monitor";
    const phone = digits(item.phone || "");
    const key = `${phone}-${normalize(text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    identified.push({
      phone: item.phone,
      contactName: item.contactName,
      district: item.district,
      city: "Arapongas",
      messageText: text,
      timestamp: item.repliedAt || item.sentAt,
      id: `broadcast-${phone}-${identified.length}`,
      origin: "broadcast",
    });
  }

  return [...linked, ...identified].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
}

function renderPanel(panel: HTMLElement, survey: SurveyPayload, monitor: MonitorPayload, state: ViewState) {
  const items = buildItems(survey, monitor);
  const identified = items.filter((item) => item.origin === "broadcast");
  const linked = items.filter((item) => item.origin === "link");
  const needle = normalize(state.search);
  const filtered = items.filter((item) => {
    if (state.filter !== "all" && item.origin !== state.filter) return false;
    if (!needle) return true;
    return normalize(`${item.contactName || ""} ${item.phone || ""} ${item.district || ""} ${item.messageText || ""}`).includes(needle);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.max(1, Math.min(state.page, totalPages));
  const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  const cards = visible.length ? visible.map((item) => {
    const isLink = item.origin === "link";
    const safeName = isLink ? "Participante via link" : (item.contactName || "Contato identificado");
    const secondary = isLink
      ? `${item.city || "Arapongas"}${item.district && item.district !== "Não informado" ? ` · ${item.district}` : ""}`
      : `${item.phone || "Telefone identificado"}${item.district ? ` · ${item.district}` : ""}`;
    return `<article class="vf-origin-card"><div class="vf-origin-card-head"><div class="vf-origin-person"><strong>${escapeHtml(safeName)}</strong><span>${escapeHtml(secondary)}</span></div><span class="vf-origin-badge ${item.origin}">${isLink ? "🔗 VIA LINK" : "📲 VIA DISPARO"}</span></div><div class="vf-origin-reply wt-reply-detail"><div class="vf-origin-raw">${escapeHtml(item.messageText || "Resposta registrada")}</div></div><div class="vf-origin-time">${escapeHtml(formatTime(item.timestamp))}</div></article>`;
  }).join("") : `<div class="vf-origin-empty">Nenhuma participação encontrada para este filtro.</div>`;

  panel.innerHTML = `
    <div class="vf-origin-head"><div><h3>🧭 Origem das Respostas da Enquete</h3><p>“Via disparo” mostra diretamente as respostas com nome e telefone que o Monitor já reconhece. “Via link” mantém as participações web sem identificação pessoal.</p></div><button type="button" class="vf-origin-refresh">↻ Atualizar</button></div>
    <div class="vf-origin-kpis"><div class="vf-origin-kpi"><strong>${items.length}</strong><span>Respostas nesta visão</span></div><div class="vf-origin-kpi link"><strong>${linked.length}</strong><span>Via link / sem identificação</span></div><div class="vf-origin-kpi broadcast"><strong>${identified.length}</strong><span>Via disparo com nome reconhecido</span></div></div>
    <div class="vf-origin-tools"><div class="vf-origin-filters"><button type="button" data-origin-filter="all" class="vf-origin-filter ${state.filter === "all" ? "is-active" : ""}">Todos (${items.length})</button><button type="button" data-origin-filter="link" class="vf-origin-filter ${state.filter === "link" ? "is-active" : ""}">🔗 Via link (${linked.length})</button><button type="button" data-origin-filter="broadcast" class="vf-origin-filter ${state.filter === "broadcast" ? "is-active" : ""}">📲 Via disparo (${identified.length})</button></div><input class="vf-origin-search" type="search" placeholder="Buscar nome, telefone, bairro ou resposta..." value="${escapeHtml(state.search)}" /></div>
    <div class="vf-origin-list">${cards}</div>
    <div class="vf-origin-pagination"><button type="button" class="vf-origin-page-btn" data-page-action="prev" ${state.page <= 1 ? "disabled" : ""}>← Anterior</button><span class="vf-origin-page-label">Página ${state.page} de ${totalPages} · ${filtered.length} registros</span><button type="button" class="vf-origin-page-btn" data-page-action="next" ${state.page >= totalPages ? "disabled" : ""}>Próxima →</button></div>
    <p class="vf-origin-note">Nenhum voto ou resposta é alterado. O filtro apenas reaproveita a identificação que já existe no Monitor.</p>
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
    if (child === filterBar) { afterBar = true; return; }
    if (!afterBar || child === panel || !(child instanceof HTMLElement)) return;
    child.dataset.vfOriginPreviousDisplay = child.style.display || "";
    child.dataset.vfOriginHidden = "1";
    child.style.display = "none";
  });
}

export default function WhatsappSurveyOriginMonitorV3() {
  useEffect(() => {
    createStyles();
    let active = false;
    let survey: SurveyPayload = {};
    let monitor: MonitorPayload = {};
    const state: ViewState = { filter: "all", search: "", page: 1 };
    let loading = false;
    let currentBar: HTMLElement | null = null;

    const draw = () => {
      const panel = document.getElementById(PANEL_ID);
      if (panel) renderPanel(panel, survey, monitor, state);
    };

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [surveyResponse, monitorResponse] = await Promise.all([
          fetch("/api/whatsapp/survey", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/whatsapp/monitor?filter=replies&limit=300&search=%2B55", { cache: "no-store", credentials: "same-origin" }),
        ]);
        const [surveyData, monitorData] = await Promise.all([
          surveyResponse.json().catch(() => ({})),
          monitorResponse.json().catch(() => ({})),
        ]);
        if (surveyResponse.ok && surveyData?.success) survey = surveyData as SurveyPayload;
        if (monitorResponse.ok && monitorData?.success) monitor = monitorData as MonitorPayload;
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
        const repliesButton = Array.from(filterBar.children).find((node) => node instanceof HTMLButtonElement && normalize(node.textContent || "").includes("respostas") && !normalize(node.textContent || "").includes("sem resposta")) as HTMLButtonElement | undefined;
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
      if (active && nativeButton && filterBar && nativeButton.parentElement === filterBar && nativeButton.id !== TAB_ID) {
        active = false;
        window.setTimeout(sync, 0);
        return;
      }
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
      const pageButton = target.closest("[data-page-action]") as HTMLElement | null;
      if (pageButton) {
        state.page += pageButton.dataset.pageAction === "next" ? 1 : -1;
        draw();
        return;
      }
      if (target.closest(".vf-origin-refresh")) void load();
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains("vf-origin-search")) return;
      state.search = target.value;
      state.page = 1;
      draw();
      const replacement = document.querySelector<HTMLInputElement>(".vf-origin-search");
      replacement?.focus();
      replacement?.setSelectionRange(state.search.length, state.search.length);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    const observer = new MutationObserver(() => window.requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      if (currentBar?.parentElement) restoreNativeContent(currentBar.parentElement);
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
