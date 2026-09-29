"use client";

import { useEffect } from "react";

type AgendaEvent = {
  id?: number | string;
  date?: string;
  category?: string;
  title?: string;
  desc?: string;
  done?: boolean;
  location?: string;
};

const AGENDA_STORAGE_KEY = "agenda-eleitoral-parana-2026-v1";
const OFFICIAL_AGENDA_PATH = "/comunicacao-institucional";

// Fallback igual aos compromissos futuros da agenda oficial. A Agenda oficial
// usa esta base somente quando ainda não existe uma agenda salva no navegador.
const DEFAULT_FUTURE_AGENDA_EVENTS: AgendaEvent[] = [
  {
    id: 11,
    date: "2026-09-26",
    category: "Propaganda",
    title: "Último dia de propaganda sonora",
    desc: "Encerrar conteúdos e ações com restrição de horário.",
    done: false,
    location: "Paraná",
  },
  {
    id: 12,
    date: "2026-10-02",
    category: "Agenda",
    title: "Último dia para comícios",
    desc: "Fechar a agenda presencial antes da votação.",
    done: false,
    location: "Paraná",
  },
  {
    id: 13,
    date: "2026-10-04",
    category: "Eleição",
    title: "1º turno",
    desc: "Dia da votação em todo o Paraná.",
    done: false,
    location: "Paraná",
  },
  {
    id: 14,
    date: "2026-10-06",
    category: "Jurídico",
    title: "Resultado oficial do 1º turno",
    desc: "Acompanhar apuração e eventuais recursos.",
    done: false,
    location: "TRE-PR",
  },
  {
    id: 15,
    date: "2026-11-22",
    category: "Eleição",
    title: "2º turno",
    desc: "Se necessário, votação de segundo turno.",
    done: false,
    location: "Paraná",
  },
  {
    id: 16,
    date: "2026-12-19",
    category: "Diplomação",
    title: "Diplomação dos eleitos",
    desc: "Fechar a fase pós-eleitoral e documentação final.",
    done: false,
    location: "TRE-PR",
  },
  {
    id: 17,
    date: "2027-01-01",
    category: "Posse",
    title: "Posse do Governador e Vice",
    desc: "Início do mandato executivo estadual.",
    done: false,
    location: "Curitiba",
  },
  {
    id: 18,
    date: "2027-01-01",
    category: "Posse",
    title: "Posse dos deputados estaduais e federais",
    desc: "Conferir agenda de cerimônia e compromissos institucionais.",
    done: false,
    location: "Curitiba",
  },
];

function todayInBrasilia() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function eventTime(event: AgendaEvent) {
  const match = String(event.desc || "").match(/(\d{2}h\d{2}|\d{2}:\d{2})/);
  return match ? match[1].replace("h", ":") : "";
}

function readUpcomingAgenda() {
  let source = DEFAULT_FUTURE_AGENDA_EVENTS;
  try {
    const raw = window.localStorage.getItem(AGENDA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Mesmo critério da Agenda Inteligente oficial: só substitui a base se
      // existir um array salvo com pelo menos um compromisso.
      if (Array.isArray(parsed) && parsed.length > 0) source = parsed as AgendaEvent[];
    }
  } catch {}

  const today = todayInBrasilia();
  return source
    .filter((event) => {
      const date = String(event.date || "").trim();
      return !event.done && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
    })
    .sort((left, right) => {
      const dateOrder = String(left.date).localeCompare(String(right.date));
      if (dateOrder !== 0) return dateOrder;
      return eventTime(left).localeCompare(eventTime(right));
    });
}

function setStyles(element: HTMLElement, styles: Record<string, string>) {
  Object.assign(element.style, styles);
}

function renderAgendaList(container: HTMLElement, events: AgendaEvent[]) {
  container.replaceChildren();

  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhum compromisso futuro agendado na Agenda Inteligente.";
    setStyles(empty, {
      fontSize: "12px",
      color: "#94a3b8",
      padding: "16px",
      textAlign: "center",
    });
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  setStyles(list, {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  });

  events.slice(0, 5).forEach((event, index) => {
    const card = document.createElement("div");
    card.dataset.vfOverviewAgendaLink = "true";
    card.title = "Clique para abrir na Agenda Inteligente";
    setStyles(card, {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      padding: "12px 14px",
      borderRadius: "12px",
      background: "rgba(14, 28, 54, 0.85)",
      border: "1px solid rgba(56, 189, 248, 0.14)",
      cursor: "pointer",
      transition: "all 0.15s ease",
    });

    const numberBox = document.createElement("div");
    setStyles(numberBox, {
      width: "42px",
      height: "42px",
      borderRadius: "10px",
      background: "rgba(56, 189, 248, 0.12)",
      border: "1px solid rgba(56, 189, 248, 0.25)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: "0",
    });

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");
    setStyles(number, {
      fontSize: "14px",
      fontWeight: "800",
      color: "#38bdf8",
      lineHeight: "1",
    });

    const agendaLabel = document.createElement("span");
    agendaLabel.textContent = "AGENDA";
    setStyles(agendaLabel, {
      fontSize: "7.5px",
      fontWeight: "700",
      color: "#94a3b8",
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      marginTop: "2px",
    });
    numberBox.append(number, agendaLabel);

    const body = document.createElement("div");
    setStyles(body, {
      flex: "1",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      gap: "3px",
    });

    const meta = document.createElement("div");
    setStyles(meta, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flexWrap: "wrap",
    });

    const date = document.createElement("span");
    date.textContent = `🗓️ ${event.date || "Data a definir"}`;
    setStyles(date, {
      fontSize: "10.5px",
      fontWeight: "700",
      color: "#38bdf8",
      background: "rgba(56, 189, 248, 0.12)",
      padding: "2px 8px",
      borderRadius: "6px",
    });
    meta.appendChild(date);

    const timeValue = eventTime(event);
    if (timeValue) {
      const time = document.createElement("span");
      time.textContent = `⏰ ${timeValue}`;
      setStyles(time, {
        fontSize: "10.5px",
        fontWeight: "600",
        color: "#cbd5e1",
      });
      meta.appendChild(time);
    }

    const categoryValue = String(event.category || "").trim();
    if (categoryValue) {
      const category = document.createElement("span");
      category.textContent = categoryValue;
      setStyles(category, {
        fontSize: "9.5px",
        fontWeight: "650",
        color: "#fbbf24",
        background: "rgba(251, 191, 36, 0.12)",
        border: "1px solid rgba(251, 191, 36, 0.25)",
        padding: "2px 6px",
        borderRadius: "4px",
      });
      meta.appendChild(category);
    }

    const title = document.createElement("div");
    title.textContent = String(event.title || "Compromisso da Agenda Inteligente");
    setStyles(title, {
      fontSize: "13.5px",
      fontWeight: "750",
      color: "#f8fafc",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      marginTop: "2px",
    });

    const place = document.createElement("div");
    setStyles(place, {
      fontSize: "11px",
      color: "#94a3b8",
      display: "flex",
      alignItems: "center",
      gap: "4px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    });
    const pin = document.createElement("span");
    pin.textContent = "📍";
    const placeText = document.createElement("span");
    placeText.textContent = String(event.location || "Local não informado");
    setStyles(placeText, { overflow: "hidden", textOverflow: "ellipsis" });
    place.append(pin, placeText);

    body.append(meta, title, place);
    card.append(numberBox, body);
    list.appendChild(card);
  });

  container.appendChild(list);
}

export default function OverviewAgendaOfficialBridge() {
  useEffect(() => {
    let activePanel: HTMLElement | null = null;
    let mount: HTMLElement | null = null;
    let lastSignature = "";
    let scheduled = false;
    const linkedTargets = new Set<HTMLElement>();

    const openOfficialAgenda = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));
      window.location.assign(OFFICIAL_AGENDA_PATH);
    };

    const bindOfficialAgenda = (element: HTMLElement | null) => {
      if (!element || linkedTargets.has(element)) return;
      element.dataset.vfOverviewAgendaLink = "true";
      element.addEventListener("click", openOfficialAgenda, true);
      linkedTargets.add(element);
    };

    const teardownPanel = () => {
      if (activePanel) {
        Array.from(activePanel.children).forEach((child) => {
          const element = child as HTMLElement;
          if (element.dataset.vfOverviewAgendaOriginal === "true") {
            element.style.display = element.dataset.vfOverviewAgendaDisplay || "";
            delete element.dataset.vfOverviewAgendaOriginal;
            delete element.dataset.vfOverviewAgendaDisplay;
          }
        });
      }
      mount?.remove();
      activePanel = null;
      mount = null;
      lastSignature = "";
    };

    const sync = () => {
      scheduled = false;

      const panelTitle = Array.from(
        document.querySelectorAll<HTMLElement>(".panel-title"),
      ).find(
        (element) =>
          element.querySelector("h3")?.textContent?.trim() ===
          "Próximos compromissos",
      );
      const panel = panelTitle?.closest<HTMLElement>("article.panel") || null;

      if (!panel || !panelTitle) {
        if (activePanel) teardownPanel();
        return;
      }

      const events = readUpcomingAgenda();
      const signature = JSON.stringify(
        events.map((event) => [
          event.id,
          event.date,
          event.title,
          event.desc,
          event.location,
          event.category,
          event.done,
        ]),
      );

      const meetingKpi = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button.kpi"),
      ).find(
        (button) =>
          button.querySelector("b")?.textContent?.trim() ===
          "Reuniões agendadas",
      );
      if (meetingKpi) {
        const value = meetingKpi.querySelector<HTMLElement>("strong");
        const nextValue = String(events.length);
        if (value && value.textContent !== nextValue) value.textContent = nextValue;
        bindOfficialAgenda(meetingKpi);
      }

      bindOfficialAgenda(panelTitle.querySelector<HTMLElement>("button"));

      if (activePanel !== panel || !mount?.isConnected) {
        teardownPanel();
        activePanel = panel;
        mount = document.createElement("div");
        mount.dataset.vfOverviewAgendaOfficial = "true";
        panel.appendChild(mount);
      }

      Array.from(panel.children).forEach((child) => {
        const element = child as HTMLElement;
        if (element === panelTitle || element === mount) return;
        if (element.dataset.vfOverviewAgendaOriginal !== "true") {
          element.dataset.vfOverviewAgendaOriginal = "true";
          element.dataset.vfOverviewAgendaDisplay = element.style.display || "";
        }
        element.style.display = "none";
      });

      if (mount && signature !== lastSignature) {
        renderAgendaList(mount, events);
        lastSignature = signature;
        mount
          .querySelectorAll<HTMLElement>("[data-vf-overview-agenda-link='true']")
          .forEach((element) => bindOfficialAgenda(element));
      }
    };

    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("storage", scheduleSync);
    window.addEventListener("focus", scheduleSync);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", scheduleSync);
      window.removeEventListener("focus", scheduleSync);
      linkedTargets.forEach((element) =>
        element.removeEventListener("click", openOfficialAgenda, true),
      );
      teardownPanel();
    };
  }, []);

  return null;
}
