"use client";

import { useEffect } from "react";

type MonitorItem = {
  id: string;
  phone?: string;
  contactName?: string;
  status?: string;
  repliedAt?: string;
  replyText?: string;
};

type MonitorPayload = {
  success?: boolean;
  totalResponses?: number;
  items?: MonitorItem[];
};

type OriginKind = "all" | "link" | "broadcast";

type OriginItem = MonitorItem & {
  origin: Exclude<OriginKind, "all">;
};

const TAB_ID = "vf-survey-origin-tab";
const PANEL_ID = "vf-survey-origin-panel";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function isWhatsappTabs(container: Element) {
  const labels = Array.from(container.children)
    .filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement)
    .map((button) => normalize(button.textContent || ""));
  return (
    labels.some((label) => label.includes("chat")) &&
    labels.some((label) => label.includes("monitor")) &&
    labels.some((label) => label.includes("disparos"))
  );
}

function findWhatsappTabs() {
  return Array.from(document.querySelectorAll("div")).find((node) => isWhatsappTabs(node)) as HTMLElement | undefined;
}

function looksLikeSurvey(text = "") {
  const value = normalize(text);
  return (
    value.includes("deputado estadual:") ||
    value.includes("deputado federal:") ||
    value.includes("governador:") ||
    value.includes("presidente:") ||
    value.includes('"poll"') ||
    value.includes('"q6"')
  );
}

function isAnonymousWeb(item: MonitorItem) {
  const phone = normalize(item.phone || "");
  const name = normalize(item.contactName || "");
  return (
    phone.includes("enquete digital") ||
    phone.includes("web") ||
    name.includes("participante da enquete") ||
    name === "eleitor arapongas"
  );
}

function classify(items: MonitorItem[]): OriginItem[] {
  return items
    .filter((item) => item.status === "replied" || Boolean(item.replyText))
    .filter((item) => !String(item.id || "").startsWith("base-"))
    .filter((item) => isAnonymousWeb(item) || looksLikeSurvey(item.replyText || ""))
    .map((item) => ({
      ...item,
      origin: isAnonymousWeb(item) ? "link" : "broadcast",
    }));
}

function escapeHtml(value: string) {
  return value
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

function createStyles() {
  if (document.getElementById("vf-survey-origin-styles")) return;
  const style = document.createElement("style");
  style.id = "vf-survey-origin-styles";
  style.textContent = `
    #${PANEL_ID}{display:none;grid-column:1/-1;margin-bottom:18px;padding:18px;border:1px solid rgba(56,189,248,.28);border-radius:16px;background:linear-gradient(180deg,rgba(8,27,49,.98),rgba(8,20,38,.98));box-shadow:0 14px 34px rgba(2,8,23,.24)}
    #${PANEL_ID}.is-open{display:block}
    .vf-origin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:15px}
    .vf-origin-head h3{margin:0;color:#f8fafc;font-size:18px}.vf-origin-head p{margin:5px 0 0;color:#94a3b8;font-size:12px;line-height:1.45;max-width:690px}
    .vf-origin-refresh{border:1px solid rgba(56,189,248,.28);background:rgba(14,116,144,.14);color:#7dd3fc;border-radius:9px;padding:8px 12px;font-weight:750;cursor:pointer}
    .vf-origin-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
    .vf-origin-kpi{padding:14px;border:1px solid rgba(148,163,184,.14);border-radius:13px;background:rgba(15,23,42,.66)}
    .vf-origin-kpi strong{display:block;font-size:24px;color:#f8fafc}.vf-origin-kpi span{display:block;margin-top:3px;color:#94a3b8;font-size:11px;font-weight:720}
    .vf-origin-kpi.link strong{color:#38bdf8}.vf-origin-kpi.broadcast strong{color:#34d399}
    .vf-origin-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:13px}
    .vf-origin-filters{display:flex;gap:7px;flex-wrap:wrap}.vf-origin-filter{border:1px solid rgba(148,163,184,.18);background:rgba(30,41,59,.58);color:#aebbd0;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:750;cursor:pointer}
    .vf-origin-filter.is-active{border-color:rgba(56,189,248,.54);background:rgba(14,116,144,.22);color:#e0f2fe}
    .vf-origin-search{min-width:240px;flex:1;max-width:390px;border:1px solid rgba(148,163,184,.18);background:#07172c;color:#e2e8f0;border-radius:9px;padding:9px 11px;outline:none}
    .vf-origin-list{display:grid;gap:9px;max-height:580px;overflow:auto;padding-right:2px}
    .vf-origin-card{padding:12px;border:1px solid rgba(148,163,184,.14);border-radius:12px;background:rgba(15,23,42,.64)}
    .vf-origin-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}.vf-origin-person{min-width:0}.vf-origin-person strong{display:block;color:#f8fafc;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vf-origin-person span{display:block;color:#7dd3fc;font-size:10.5px;margin-top:2px}
    .vf-origin-badge{flex:none;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:850;letter-spacing:.02em}.vf-origin-badge.link{background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.26);color:#7dd3fc}.vf-origin-badge.broadcast{background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.27);color:#6ee7b7}
    .vf-origin-reply.wt-reply-detail{margin-top:6px;border-left:3px solid #c084fc;background:rgba(168,85,247,.12);padding:8px 10px;border-radius:7px}.vf-origin-reply .vf-origin-raw{font-size:12px;color:#f8fafc;white-space:pre-wrap;line-height:1.45}
    .vf-origin-time{margin-top:7px;color:#64748b;font-size:10px;text-align:right}.vf-origin-empty{padding:30px 14px;text-align:center;border:1px dashed rgba(148,163,184,.18);border-radius:12px;color:#94a3b8;font-size:12px;line-height:1.5}
    .vf-origin-note{margin:10px 0 0;color:#6f8098;font-size:10.5px;line-height:1.45}
    @media(max-width:760px){#${PANEL_ID}{padding:13px;border-radius:14px}.vf-origin-kpis{grid-template-columns:1fr 1fr}.vf-origin-kpi:first-child{grid-column:1/-1}.vf-origin-kpi{padding:11px}.vf-origin-kpi strong{font-size:21px}.vf-origin-search{max-width:none;width:100%;min-width:0}.vf-origin-tools{align-items:stretch}.vf-origin-filters{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.vf-origin-filter{white-space:nowrap}.vf-origin-list{max-height:64vh}.vf-origin-card{padding:10px}}
  `;
  document.head.appendChild(style);
}

function renderPanel(panel: HTMLElement, payload: MonitorPayload, state: { filter: OriginKind; search: string }) {
  const items = classify(Array.isArray(payload.items) ? payload.items : []);
  const identified = items.filter((item) => item.origin === "broadcast");
  const reportedTotal = Math.max(0, Number(payload.totalResponses || 0));
  const linkTotal = Math.max(items.filter((item) => item.origin === "link").length, reportedTotal - identified.length);
  const total = Math.max(reportedTotal, linkTotal + identified.length);
  const needle = normalize(state.search);
  const visible = items.filter((item) => {
    if (state.filter !== "all" && item.origin !== state.filter) return false;
    if (!needle) return true;
    return normalize(`${item.contactName || ""} ${item.phone || ""} ${item.replyText || ""}`).includes(needle);
  });

  const cards = visible.length
    ? visible.map((item) => {
        const link = item.origin === "link";
        const name = link ? "Participante via link" : (item.contactName || "Contato identificado");
        const secondary = link ? "Enquete Digital (Web) · identidade não informada" : (item.phone || "Contato do disparo");
        const reply = item.replyText || "Resposta registrada";
        return `<article class="vf-origin-card">
          <div class="vf-origin-card-head">
            <div class="vf-origin-person"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(secondary)}</span></div>
            <span class="vf-origin-badge ${item.origin}">${link ? "🔗 LINK / ANÔNIMO" : "📲 DISPARO IDENTIFICADO"}</span>
          </div>
          <div class="vf-origin-reply wt-reply-detail"><div class="vf-origin-raw">${escapeHtml(reply)}</div></div>
          <div class="vf-origin-time">${escapeHtml(formatTime(item.repliedAt))}</div>
        </article>`;
      }).join("")
    : `<div class="vf-origin-empty">${state.filter === "broadcast" ? "Ainda não há participação de enquete com vínculo técnico seguro a um contato do disparo. Quando houver identificação disponível, ela aparecerá aqui com nome e telefone." : "Nenhuma participação encontrada para este filtro."}</div>`;

  panel.innerHTML = `
    <div class="vf-origin-head">
      <div><h3>🧭 Origem das Respostas da Enquete</h3><p>Separe participações recebidas pelo link da enquete das respostas que possuem vínculo identificável com um contato do WhatsApp.</p></div>
      <button type="button" class="vf-origin-refresh">↻ Atualizar</button>
    </div>
    <div class="vf-origin-kpis">
      <div class="vf-origin-kpi"><strong>${total}</strong><span>Total de participações registradas</span></div>
      <div class="vf-origin-kpi link"><strong>${linkTotal}</strong><span>Link / sem identificação de contato</span></div>
      <div class="vf-origin-kpi broadcast"><strong>${identified.length}</strong><span>Disparo com contato identificado</span></div>
    </div>
    <div class="vf-origin-tools">
      <div class="vf-origin-filters">
        <button type="button" data-origin-filter="all" class="vf-origin-filter ${state.filter === "all" ? "is-active" : ""}">Todos</button>
        <button type="button" data-origin-filter="link" class="vf-origin-filter ${state.filter === "link" ? "is-active" : ""}">🔗 Via link</button>
        <button type="button" data-origin-filter="broadcast" class="vf-origin-filter ${state.filter === "broadcast" ? "is-active" : ""}">📲 Via disparo</button>
      </div>
      <input class="vf-origin-search" type="search" placeholder="Buscar nome, telefone ou resposta..." value="${escapeHtml(state.search)}" />
    </div>
    <div class="vf-origin-list">${cards}</div>
    <p class="vf-origin-note">Classificação conservadora: o sistema só chama de “Via disparo” quando existe vínculo técnico com um contato real. Participações web sem esse vínculo permanecem em “Via link / sem identificação”, sem tentar descobrir identidade por IP ou dispositivo. A lista mostra as respostas mais recentes disponibilizadas pelo Monitor.</p>
  `;
}

export default function WhatsappSurveyOriginTabEnhancer() {
  useEffect(() => {
    createStyles();
    let active = false;
    let payload: MonitorPayload = {};
    const state: { filter: OriginKind; search: string } = { filter: "all", search: "" };
    let loading = false;

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/whatsapp/monitor?filter=replies&limit=300", { cache: "no-store", credentials: "same-origin" });
        const data = (await response.json().catch(() => ({}))) as MonitorPayload;
        if (response.ok && data?.success) payload = data;
      } finally {
        loading = false;
        const panel = document.getElementById(PANEL_ID);
        if (panel) renderPanel(panel, payload, state);
      }
    };

    const sync = () => {
      const tabs = findWhatsappTabs();
      if (!tabs) return;

      let button = document.getElementById(TAB_ID) as HTMLButtonElement | null;
      if (!button) {
        const monitorButton = Array.from(tabs.children).find(
          (node) => node instanceof HTMLButtonElement && normalize(node.textContent || "").includes("monitor"),
        ) as HTMLButtonElement | undefined;
        button = document.createElement("button");
        button.id = TAB_ID;
        button.type = "button";
        button.textContent = "🧭 Origem da Enquete";
        const baseStyle = monitorButton?.getAttribute("style");
        if (baseStyle) button.setAttribute("style", baseStyle);
        button.style.borderColor = active ? "#22d3ee" : "rgba(255, 255, 255, 0.12)";
        button.style.background = active ? "rgba(34, 211, 238, 0.16)" : "rgba(15, 23, 42, 0.7)";
        button.style.color = active ? "#67e8f9" : "#94a3b8";
        tabs.appendChild(button);
      }

      let panel = document.getElementById(PANEL_ID) as HTMLElement | null;
      if (!panel) {
        panel = document.createElement("section");
        panel.id = PANEL_ID;
        tabs.insertAdjacentElement("afterend", panel);
        renderPanel(panel, payload, state);
      }

      button.style.borderColor = active ? "#22d3ee" : "rgba(255, 255, 255, 0.12)";
      button.style.background = active ? "rgba(34, 211, 238, 0.16)" : "rgba(15, 23, 42, 0.7)";
      button.style.color = active ? "#67e8f9" : "#94a3b8";
      panel.classList.toggle("is-open", active);

      const nativeContent = panel.nextElementSibling as HTMLElement | null;
      if (nativeContent) nativeContent.style.display = active ? "none" : "";
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const originTab = target.closest(`#${TAB_ID}`);
      if (originTab) {
        event.preventDefault();
        event.stopPropagation();
        active = true;
        sync();
        void load();
        return;
      }

      const nativeButton = target.closest("button");
      if (active && nativeButton && nativeButton.parentElement && isWhatsappTabs(nativeButton.parentElement) && nativeButton.id !== TAB_ID) {
        active = false;
        window.setTimeout(sync, 0);
        return;
      }

      const filterButton = target.closest("[data-origin-filter]") as HTMLElement | null;
      if (filterButton) {
        const filter = filterButton.dataset.originFilter as OriginKind;
        if (filter === "all" || filter === "link" || filter === "broadcast") {
          state.filter = filter;
          const panel = document.getElementById(PANEL_ID);
          if (panel) renderPanel(panel, payload, state);
        }
        return;
      }

      if (target.closest(".vf-origin-refresh")) void load();
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains("vf-origin-search")) return;
      state.search = target.value;
      const panel = document.getElementById(PANEL_ID);
      if (panel) renderPanel(panel, payload, state);
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
      document.getElementById(TAB_ID)?.remove();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById("vf-survey-origin-styles")?.remove();
    };
  }, []);

  return null;
}
