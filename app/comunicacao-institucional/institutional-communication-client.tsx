"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "../ui-icons";
import "./institutional-communication.css";

export type CampaignEvent = {
  id: number;
  date: string;
  category: string;
  title: string;
  desc: string;
  priority: number;
  done: boolean;
  important: boolean;
  reminder: number;
  location: string;
  responsible: string;
};

const STORAGE_KEY = "agenda-eleitoral-parana-2026-v1";
const THEME_KEY = "agenda-eleitoral-theme-v1";
const ELECTION_DATE = new Date("2026-10-04T08:00:00-03:00").getTime();

// COMPONENTES DE ÍCONES SVG VETORIAIS PROFISSIONAIS
const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconUpload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconPrinter = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const IconArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconLocation = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 1 2-2h8a4 4 0 0 1 4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconKanban = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="18" rx="1" />
    <rect x="12" y="3" width="5" height="12" rx="1" />
    <rect x="21" y="3" width="5" height="8" rx="1" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const baseEvents: CampaignEvent[] = [
  {
    id: 1,
    date: "2026-08-01",
    category: "FASE 1 — Alinhamento interno",
    title: "Reunião com Secretários Municipais",
    desc: "09h00 · Alinhamento da organização da campanha, calendário geral, comunicação interna, definição das equipes e identificação de lideranças, classificação e criação de células.",
    priority: 3,
    done: false,
    important: true,
    reminder: 7,
    location: "Arapongas",
    responsible: "Coordenação geral",
  },
  {
    id: 2,
    date: "2026-08-03",
    category: "FASE 1 — Alinhamento interno",
    title: "Reunião com a Secretaria Municipal de Saúde",
    desc: "19h30 · Organização da equipe, cronograma interno, comunicação, participação em eventos, planejamento operacional e identificação de lideranças, classificação e criação de células.",
    priority: 3,
    done: false,
    important: true,
    reminder: 3,
    location: "Arapongas",
    responsible: "Coordenação setorial",
  },
  {
    id: 3,
    date: "2026-08-04",
    category: "FASE 1 — Alinhamento interno",
    title: "Reunião com a Secretaria Municipal de Educação",
    desc: "19h30 · Organização das equipes, calendário, comunicação interna, logística e identificação de lideranças, classificação e criação de células.",
    priority: 3,
    done: false,
    important: true,
    reminder: 3,
    location: "Arapongas",
    responsible: "Coordenação setorial",
  },
  {
    id: 4,
    date: "2026-08-05",
    category: "FASE 1 — Alinhamento interno",
    title: "Reunião com a Secretaria Municipal de Assistência Social",
    desc: "19h30 · Identificação de lideranças, classificação e criação de células.",
    priority: 2,
    done: false,
    important: true,
    reminder: 3,
    location: "Arapongas",
    responsible: "Coordenação setorial",
  },
  {
    id: 5,
    date: "2026-08-06",
    category: "FASE 1 — Alinhamento interno",
    title: "Reunião com as demais Secretarias e Autarquias",
    desc: "19h30 · Integração entre equipes, cronograma, fluxo operacional, definição dos responsáveis e identificação de lideranças, classificação e criação de células.",
    priority: 3,
    done: false,
    important: true,
    reminder: 3,
    location: "Arapongas",
    responsible: "Coordenação geral",
  },
  {
    id: 6,
    date: "2026-08-21",
    category: "FASE 2 — Início da campanha",
    title: "Lançamento Oficial da Campanha",
    desc: "19h00 · Pedro Lupion, Sérgio Onofre, convidados, Prefeito de Arapongas, vereadores, apoiadores, Alexandre Cury, Ratinho e demais lideranças. Local: Comitê Tucanos. Responsáveis: Comitê Tucanos e Escritório Athenas.",
    priority: 3,
    done: false,
    important: true,
    reminder: 7,
    location: "Comitê Tucanos",
    responsible: "Comitê Tucanos e Escritório Athenas",
  },
  {
    id: 7,
    date: "2026-08-22",
    category: "FASE 2 — Início da campanha",
    title: "Adesivaço Pedro e Sérgio",
    desc: "10h00 · Ação para 500 carros. Coordenação Atenas / Tucanos - Edmar Camparoto.",
    priority: 3,
    done: false,
    important: true,
    reminder: 3,
    location: "Arapongas",
    responsible: "Atenas / Tucanos",
  },
  {
    id: 8,
    date: "2026-08-24",
    category: "FASE 2 — Início da campanha",
    title: "Início do projeto Café da Manhã no Comércio",
    desc: "Coordenação: Sonia Passoni. Objetivos operacionais: a definir.",
    priority: 2,
    done: false,
    important: true,
    reminder: 3,
    location: "Comércio local",
    responsible: "Sonia Passoni",
  },
  {
    id: 9,
    date: "2026-08-16",
    category: "Campanha",
    title: "Início oficial da campanha",
    desc: "Liberar peças, agenda pública, reuniões e comunicação eleitoral permitida.",
    priority: 2,
    done: false,
    important: true,
    reminder: 7,
    location: "Paraná",
    responsible: "Equipe de campanha",
  },
  {
    id: 10,
    date: "2026-08-16",
    category: "Jurídico",
    title: "Divulgação oficial das candidaturas",
    desc: "Acompanhar publicação e conferência dos registros.",
    priority: 2,
    done: false,
    important: false,
    reminder: 3,
    location: "TRE-PR",
    responsible: "Jurídico",
  },
  {
    id: 11,
    date: "2026-09-26",
    category: "Propaganda",
    title: "Último dia de propaganda sonora",
    desc: "Encerrar conteúdos e ações com restrição de horário.",
    priority: 2,
    done: false,
    important: false,
    reminder: 3,
    location: "Paraná",
    responsible: "Comunicação",
  },
  {
    id: 12,
    date: "2026-10-02",
    category: "Agenda",
    title: "Último dia para comícios",
    desc: "Fechar a agenda presencial antes da votação.",
    priority: 3,
    done: false,
    important: true,
    reminder: 1,
    location: "Paraná",
    responsible: "Coordenação geral",
  },
  {
    id: 13,
    date: "2026-10-04",
    category: "Eleição",
    title: "1º turno",
    desc: "Dia da votação em todo o Paraná.",
    priority: 3,
    done: false,
    important: true,
    reminder: 1,
    location: "Paraná",
    responsible: "Toda a campanha",
  },
  {
    id: 14,
    date: "2026-10-06",
    category: "Jurídico",
    title: "Resultado oficial do 1º turno",
    desc: "Acompanhar apuração e eventuais recursos.",
    priority: 2,
    done: false,
    important: false,
    reminder: 1,
    location: "TRE-PR",
    responsible: "Jurídico",
  },
  {
    id: 15,
    date: "2026-11-22",
    category: "Eleição",
    title: "2º turno",
    desc: "Se necessário, votação de segundo turno.",
    priority: 3,
    done: false,
    important: true,
    reminder: 3,
    location: "Paraná",
    responsible: "Toda a campanha",
  },
  {
    id: 16,
    date: "2026-12-19",
    category: "Diplomação",
    title: "Diplomação dos eleitos",
    desc: "Fechar a fase pós-eleitoral e documentação final.",
    priority: 2,
    done: false,
    important: false,
    reminder: 7,
    location: "TRE-PR",
    responsible: "Jurídico",
  },
  {
    id: 17,
    date: "2027-01-01",
    category: "Posse",
    title: "Posse do Governador e Vice",
    desc: "Início do mandato executivo estadual.",
    priority: 3,
    done: false,
    important: true,
    reminder: 15,
    location: "Curitiba",
    responsible: "Cerimonial",
  },
  {
    id: 18,
    date: "2027-01-01",
    category: "Posse",
    title: "Posse dos deputados estaduais e federais",
    desc: "Conferir agenda de cerimônia e compromissos institucionais.",
    priority: 2,
    done: false,
    important: false,
    reminder: 15,
    location: "Curitiba",
    responsible: "Cerimonial",
  },
];

const dowLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

function getInitialElectionCountdown() {
  const now = Date.now();
  const diff = ELECTION_DATE - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, isPast: false };
}

function weekdayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

function isoToDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getTime();
}

// GERADOR DE ARQUIVO ICAL (.ICS)
function exportIcal(events: CampaignEvent[]) {
  let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Voto Certo//Agenda Eleitoral 2026//PT-BR\r\nCALSCALE:GREGORIAN\r\n";
  events.forEach((ev) => {
    const dStr = ev.date.replace(/-/g, "");
    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:event-${ev.id}-voto-certo@parana2026\r\n`;
    ics += `SUMMARY:${ev.title.replace(/\n/g, " ")}\r\n`;
    ics += `DESCRIPTION:${(ev.desc || "").replace(/\n/g, " ")} - Resp: ${ev.responsible || "—"}\r\n`;
    if (ev.location) ics += `LOCATION:${ev.location.replace(/\n/g, " ")}\r\n`;
    ics += `DTSTART;VALUE=DATE:${dStr}\r\n`;
    ics += `DTEND;VALUE=DATE:${dStr}\r\n`;
    ics += "END:VEVENT\r\n";
  });
  ics += "END:VCALENDAR\r\n";

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "agenda-eleitoral-parana-2026.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function InstitutionalCommunicationClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
} = {}) {
  const [events, setEvents] = useState<CampaignEvent[]>(baseEvents);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("dateAsc");
  const [filterMonth, setFilterMonth] = useState<Date>(new Date("2026-08-01T00:00:00"));

  // VISÕES E NAVEGAÇÃO
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");
  const [activeMobileTab, setActiveMobileTab] = useState<"agenda" | "calendario" | "resumo">("agenda");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(false);
  const [visibleCountMobile, setVisibleCountMobile] = useState(6);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBackToDashboard = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
      return;
    }
    window.dispatchEvent(new CustomEvent("voto-forte:navigate-overview"));
    if (typeof window !== "undefined" && window.location.pathname.includes("comunicacao-institucional")) {
      window.location.href = "/";
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fDate, setFDate] = useState("2026-08-16");
  const [fCategory, setFCategory] = useState("Agenda");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fResponsible, setFResponsible] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fPriority, setFPriority] = useState(2);
  const [fDone, setFDone] = useState(false);
  const [fImportant, setFImportant] = useState(false);
  const [fReminder, setFReminder] = useState(3);

  // Contagem regressiva até o 1º turno, atualizada somente no cliente para evitar divergência de hidratação.
  const [electionCountdown, setElectionCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
  });

  useEffect(() => {
    const updateCountdown = () => setElectionCountdown(getInitialElectionCountdown());
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Carregamento LocalStorage
  useEffect(() => {
    try {
      const savedTheme = (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark";
      setTheme(savedTheme);

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // ATALHOS DE TECLADO RÁPIDOS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        if (e.key === "Escape") {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openModal(null);
      } else if (e.key === "Escape") {
        setIsModalOpen(false);
        setSearch("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const saveEvents = useCallback((newEvents: CampaignEvent[]) => {
    setEvents(newEvents);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newEvents));
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.category))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = events.filter((ev) => {
      const hay = `${ev.date} ${ev.category} ${ev.title} ${ev.desc} ${ev.responsible} ${ev.location}`.toLowerCase();
      const okQ = !q || hay.includes(q);
      const okCat = filterCategory === "all" || ev.category === filterCategory;
      const okStatus =
        filterStatus === "all" ||
        (filterStatus === "pending" && !ev.done) ||
        (filterStatus === "done" && ev.done) ||
        (filterStatus === "important" && ev.important);
      return okQ && okCat && okStatus;
    });

    list.sort((a, b) => {
      if (sortBy === "dateDesc") return isoToDate(b.date) - isoToDate(a.date);
      if (sortBy === "title") return a.title.localeCompare(b.title, "pt-BR");
      if (sortBy === "priority")
        return b.priority - a.priority || isoToDate(a.date) - isoToDate(b.date);
      return isoToDate(a.date) - isoToDate(b.date);
    });

    return list;
  }, [events, search, filterCategory, filterStatus, sortBy]);

  // EVENTO SELECIONADO PARA INSPEÇÃO MASTER-DETAIL
  const selectedEvent = useMemo(() => {
    if (selectedEventId !== null) {
      const found = events.find((e) => e.id === selectedEventId);
      if (found) return found;
    }
    return filteredEvents[0] || events[0] || null;
  }, [events, filteredEvents, selectedEventId]);

  // GRUPOS PARA QUADRO KANBAN
  const kanbanGroups = useMemo(() => {
    const map: Record<string, CampaignEvent[]> = {
      "FASE 1 — Alinhamento interno": [],
      "FASE 2 — Início da campanha": [],
      "Campanha Geral": [],
      "Jurídico & Comunicação": [],
      "Eleição, Diplomação & Posse": [],
    };

    events.forEach((ev) => {
      const cat = ev.category;
      if (cat.includes("FASE 1")) {
        map["FASE 1 — Alinhamento interno"].push(ev);
      } else if (cat.includes("FASE 2")) {
        map["FASE 2 — Início da campanha"].push(ev);
      } else if (cat.includes("Jurídico") || cat.includes("Propaganda")) {
        map["Jurídico & Comunicação"].push(ev);
      } else if (cat.includes("Eleição") || cat.includes("Diplomação") || cat.includes("Posse")) {
        map["Eleição, Diplomação & Posse"].push(ev);
      } else {
        map["Campanha Geral"].push(ev);
      }
    });

    return map;
  }, [events]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = events.length;
    const pending = events.filter((e) => !e.done).length;
    const done = events.filter((e) => e.done).length;
    
    // Próximo marco pendente
    const pendingUpcoming = [...events]
      .filter((e) => !e.done)
      .sort((a, b) => isoToDate(a.date) - isoToDate(b.date));
    
    const next = pendingUpcoming[0] || null;
    const nextDays = next ? daysUntil(next.date) : null;

    return { total, pending, done, next, nextDays };
  }, [events]);

  // Próximos 4 eventos para contagem regressiva
  const upcomingCountdowns = useMemo(() => {
    const pendingList = [...events]
      .filter((e) => !e.done)
      .sort((a, b) => isoToDate(a.date) - isoToDate(b.date));
    
    if (pendingList.length > 0) {
      return pendingList.slice(0, 4);
    }
    return events.slice(0, 4);
  }, [events]);

  // Ações CRUD
  const toggleDone = (id: number) => {
    const updated = events.map((ev) => (ev.id === id ? { ...ev, done: !ev.done } : ev));
    saveEvents(updated);
  };

  const duplicateEvent = (id: number) => {
    const src = events.find((ev) => ev.id === id);
    if (!src) return;
    const nextId = Math.max(0, ...events.map((e) => e.id)) + 1;
    const copy: CampaignEvent = {
      ...src,
      id: nextId,
      title: `${src.title} (cópia)`,
      done: false,
    };
    saveEvents([...events, copy]);
  };

  const deleteEvent = (id: number) => {
    const target = events.find((e) => e.id === id);
    if (!target) return;
    if (window.confirm(`Deseja excluir "${target.title}"?`)) {
      saveEvents(events.filter((e) => e.id !== id));
      if (selectedEventId === id) setSelectedEventId(null);
    }
  };

  const openRescheduleModal = (ev: CampaignEvent) => {
    setRescheduleEvent(ev);
    setRescheduleDate(ev.date || "2026-08-16");
    const timeMatch = ev.desc.match(/(\d{2}h\d{2})/);
    setRescheduleTime(timeMatch ? timeMatch[1].replace("h", ":") : "19:30");
    setRescheduleLocation(ev.location || "");
  };

  const handleConfirmReschedule = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rescheduleEvent || !rescheduleDate) return;

    const formattedTime = rescheduleTime ? `${rescheduleTime.replace(":", "h")}` : "";
    let updatedDesc = rescheduleEvent.desc;
    if (formattedTime) {
      if (updatedDesc.match(/\d{2}h\d{2}/)) {
        updatedDesc = updatedDesc.replace(/\d{2}h\d{2}/, formattedTime);
      } else {
        updatedDesc = `${formattedTime} · ${updatedDesc}`;
      }
    }

    const updatedEvents = events.map((ev) =>
      ev.id === rescheduleEvent.id
        ? {
            ...ev,
            date: rescheduleDate,
            desc: updatedDesc,
            location: rescheduleLocation || ev.location,
            done: false, // Ao reagendar, volta como pendente
          }
        : ev
    );

    saveEvents(updatedEvents);
    setRescheduleEvent(null);
  };

  const openModal = (ev: CampaignEvent | null = null) => {
    if (ev) {
      setEditingId(ev.id);
      setFDate(ev.date);
      setFCategory(ev.category);
      setFTitle(ev.title);
      setFDesc(ev.desc);
      setFResponsible(ev.responsible || "");
      setFLocation(ev.location || "");
      setFPriority(ev.priority ?? 2);
      setFDone(Boolean(ev.done));
      setFImportant(Boolean(ev.important));
      setFReminder(ev.reminder ?? 3);
    } else {
      setEditingId(null);
      setFDate("2026-08-16");
      setFCategory("Agenda");
      setFTitle("");
      setFDesc("");
      setFResponsible("");
      setFLocation("");
      setFPriority(2);
      setFDone(false);
      setFImportant(false);
      setFReminder(3);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const saveFromModal = () => {
    if (!fDate || !fTitle.trim() || !fCategory.trim()) {
      alert("Preencha data, título e categoria.");
      return;
    }

    const payload: Omit<CampaignEvent, "id"> = {
      date: fDate,
      category: fCategory.trim(),
      title: fTitle.trim(),
      desc: fDesc.trim(),
      responsible: fResponsible.trim(),
      location: fLocation.trim(),
      priority: Number(fPriority),
      done: fDone,
      important: fImportant,
      reminder: Number(fReminder),
    };

    if (editingId !== null) {
      saveEvents(events.map((x) => (x.id === editingId ? { ...x, ...payload } : x)));
    } else {
      const nextId = Math.max(0, ...events.map((e) => e.id)) + 1;
      saveEvents([...events, { id: nextId, ...payload }]);
    }
    closeModal();
  };

  // Exportar JSON
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agenda-eleitoral-pedro-lupion-sergio-onofre-2026.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // Importar JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("Formato inválido");
        const imported: CampaignEvent[] = parsed.map((item, idx) => ({
          id: item.id ?? idx + 1,
          date: item.date,
          category: item.category || "Agenda",
          title: item.title || "Sem título",
          desc: item.desc || "",
          responsible: item.responsible || "",
          location: item.location || "",
          priority: Number(item.priority ?? 2),
          done: Boolean(item.done),
          important: Boolean(item.important),
          reminder: Number(item.reminder ?? 3),
        }));
        saveEvents(imported);
        alert("Agenda importada com sucesso!");
      } catch {
        alert("Não foi possível importar o arquivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  // Restaurar Base Original
  const resetBase = () => {
    if (window.confirm("Restaurar o modelo original da campanha de Pedro Lupion e Sérgio Onofre?")) {
      saveEvents(JSON.parse(JSON.stringify(baseEvents)));
    }
  };

  // Funções de Calendário
  const calendarData = useMemo(() => {
    const y = filterMonth.getFullYear();
    const m = filterMonth.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());

    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const inMonth = d.getMonth() === m;
      const dayEvents = events.filter((ev) => ev.date === iso);
      const highlight = dayEvents.some((ev) => ev.done)
        ? "ok"
        : dayEvents.length
          ? dayEvents.some((ev) => ev.important)
            ? "danger"
            : "warn"
          : "";

      cells.push({
        dateNumber: d.getDate(),
        iso,
        inMonth,
        eventCount: dayEvents.length,
        highlight,
      });
    }

    return {
      monthLabel: filterMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      cells,
    };
  }, [filterMonth, events]);

  const visibleEventsMobile = useMemo(() => {
    return filteredEvents.slice(0, visibleCountMobile);
  }, [filteredEvents, visibleCountMobile]);

  return (
    <div className={`ae-root ${theme === "light" ? "light-mode" : ""}`} data-theme={theme}>
      <div className="ae-shell">
        {/* TOPBAR EXECUTIVA COM SELETOR DE VISÃO */}
        <header className="ae-topbar">
          <div className="ae-brand">
            <div className="ae-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/voto-forte-bandeira-icon.jpg"
                alt="Paraná"
                className="ae-logo-img"
              />
            </div>
            <div>
              <h1 className="ae-title">Agenda Inteligente — Pedro Lupion e Sérgio Onofre</h1>
              <div className="ae-subtitle">
                Cronograma operacional da campanha • Arapongas 2026 • atalhos `/` busca, `N` novo evento.
              </div>
            </div>
          </div>
          <div className="ae-toolbar">
            {/* SELETOR DE VISÕES NO DESKTOP */}
            <div className="ae-view-switcher">
              <button
                type="button"
                className={`ae-view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Visão em Lista / Tabela"
              >
                <IconCalendar />
                <span>Lista</span>
              </button>
              <button
                type="button"
                className={`ae-view-btn ${viewMode === "kanban" ? "active" : ""}`}
                onClick={() => setViewMode("kanban")}
                title="Visão Kanban por Fases Estratégicas"
              >
                <IconKanban />
                <span>Quadro Fases</span>
              </button>
              <button
                type="button"
                className={`ae-view-btn ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
                title="Visão de Calendário Mês Inteiro"
              >
                <IconClock />
                <span>Calendário</span>
              </button>
            </div>

            <button type="button" className="ae-btn ae-btn-ghost" onClick={toggleTheme} title="Alternar tema de cores">
              {theme === "light" ? <IconMoon /> : <IconSun />}
              <span>{theme === "light" ? "Escuro" : "Claro"}</span>
            </button>
            <button
              type="button"
              className="ae-btn"
              onClick={() => exportIcal(events)}
              title="Exportar para Google Calendar / Apple iCal (.ics)"
            >
              <IconDownload />
              <span>Agenda iCal (.ics)</span>
            </button>
            <button
              type="button"
              className="ae-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icons.Upload size={15} />
              <span>Importar JSON</span>
            </button>
            <button type="button" className="ae-btn" onClick={exportJson} title="Exportar JSON">
              <IconDownload />
              <span>JSON</span>
            </button>
            <button type="button" className="ae-btn" onClick={() => window.print()} title="Imprimir cronograma">
              <IconPrinter />
            </button>
            <button type="button" className="ae-btn ae-btn-primary" onClick={handleBackToDashboard}>
              <IconArrowLeft />
              <span>Dashboard</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleImportFile}
          />
        </header>

        {/* LINHA DE CONTAGEM REGRESSIVA OFICIAL ATÉ A ELEIÇÃO (04 DE OUTUBRO DE 2026) */}
        <section
          className="ae-election-countdown"
          aria-label="Contagem regressiva oficial para as Eleições 2026"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            background: theme === "light"
              ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)"
              : "linear-gradient(135deg, rgba(12, 28, 52, 0.96) 0%, rgba(7, 18, 36, 0.98) 100%)",
            border: theme === "light"
              ? "1px solid rgba(212, 171, 100, 0.5)"
              : "1px solid rgba(212, 171, 100, 0.38)",
            borderRadius: "14px",
            padding: "12px 20px",
            margin: "0 0 16px 0",
            boxShadow: theme === "light"
              ? "0 4px 16px rgba(0, 0, 0, 0.06), 0 0 12px rgba(212, 171, 100, 0.15)"
              : "0 10px 28px rgba(0, 0, 0, 0.4), 0 0 16px rgba(212, 171, 100, 0.12)",
            position: "relative",
            overflow: "hidden",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* FAIXA SUPERIOR TRICOLOR PARANÁ */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #0284c7 0%, #d4ab64 50%, #16a34a 100%)",
            }}
          />

          <div
            className="ae-countdown-left"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
              minWidth: "260px",
            }}
          >
            <div
              className="ae-countdown-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                borderRadius: "20px",
                background: theme === "light" ? "rgba(212, 171, 100, 0.15)" : "rgba(212, 171, 100, 0.12)",
                border: "1px solid rgba(212, 171, 100, 0.35)",
                fontSize: "0.74rem",
                fontWeight: 800,
                color: theme === "light" ? "#92400e" : "#d4ab64",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              <span
                className="ae-countdown-pulse"
                aria-hidden="true"
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  boxShadow: "0 0 8px #22c55e",
                  display: "inline-block",
                }}
              />
              <span>ELEIÇÕES 2026 • 1º TURNO</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div
                className="ae-countdown-title"
                style={{
                  margin: 0,
                  fontSize: "1.02rem",
                  fontWeight: 800,
                  color: theme === "light" ? "#0f172a" : "#ffffff",
                  letterSpacing: "-0.01em",
                }}
              >
                🗳️ Votação Geral: <strong style={{ color: "#d4ab64" }}>04 de Outubro de 2026</strong>
              </div>
              <span
                className="ae-countdown-desc"
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: theme === "light" ? "#64748b" : "#94a3b8",
                }}
              >
                Abertura oficial das urnas em todo o Paraná às 08h00 (Horário de Brasília)
              </span>
            </div>
          </div>

          <div
            className="ae-countdown-boxes"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            {/* DIAS */}
            <div
              className="ae-count-unit"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "62px",
                padding: "6px 10px",
                borderRadius: "10px",
                background: theme === "light" ? "rgba(2, 132, 199, 0.08)" : "rgba(2, 132, 199, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              <span
                className="ae-count-num"
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  color: theme === "light" ? "#0284c7" : "#38bdf8",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(electionCountdown.days).padStart(2, "0")}
              </span>
              <span
                className="ae-count-label"
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: theme === "light" ? "#64748b" : "#94a3b8",
                  letterSpacing: "0.06em",
                  marginTop: "3px",
                }}
              >
                DIAS
              </span>
            </div>

            <span style={{ fontSize: "1.1rem", fontWeight: 900, color: theme === "light" ? "#94a3b8" : "rgba(255,255,255,0.3)" }}>:</span>

            {/* HORAS */}
            <div
              className="ae-count-unit"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "62px",
                padding: "6px 10px",
                borderRadius: "10px",
                background: theme === "light" ? "rgba(212, 171, 100, 0.1)" : "rgba(212, 171, 100, 0.12)",
                border: "1px solid rgba(212, 171, 100, 0.35)",
              }}
            >
              <span
                className="ae-count-num"
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  color: "#d4ab64",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(electionCountdown.hours).padStart(2, "0")}
              </span>
              <span
                className="ae-count-label"
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: theme === "light" ? "#64748b" : "#94a3b8",
                  letterSpacing: "0.06em",
                  marginTop: "3px",
                }}
              >
                HORAS
              </span>
            </div>

            <span style={{ fontSize: "1.1rem", fontWeight: 900, color: theme === "light" ? "#94a3b8" : "rgba(255,255,255,0.3)" }}>:</span>

            {/* MINUTOS */}
            <div
              className="ae-count-unit"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "62px",
                padding: "6px 10px",
                borderRadius: "10px",
                background: theme === "light" ? "rgba(212, 171, 100, 0.1)" : "rgba(212, 171, 100, 0.12)",
                border: "1px solid rgba(212, 171, 100, 0.35)",
              }}
            >
              <span
                className="ae-count-num"
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  color: "#d4ab64",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(electionCountdown.minutes).padStart(2, "0")}
              </span>
              <span
                className="ae-count-label"
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: theme === "light" ? "#64748b" : "#94a3b8",
                  letterSpacing: "0.06em",
                  marginTop: "3px",
                }}
              >
                MINUTOS
              </span>
            </div>

            <span style={{ fontSize: "1.1rem", fontWeight: 900, color: theme === "light" ? "#94a3b8" : "rgba(255,255,255,0.3)" }}>:</span>

            {/* SEGUNDOS */}
            <div
              className="ae-count-unit is-seconds"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "62px",
                padding: "6px 10px",
                borderRadius: "10px",
                background: theme === "light" ? "rgba(22, 163, 74, 0.08)" : "rgba(22, 163, 74, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
              }}
            >
              <span
                className="ae-count-num"
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  color: theme === "light" ? "#16a34a" : "#22c55e",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(electionCountdown.seconds).padStart(2, "0")}
              </span>
              <span
                className="ae-count-label"
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  color: theme === "light" ? "#64748b" : "#94a3b8",
                  letterSpacing: "0.06em",
                  marginTop: "3px",
                }}
              >
                SEGUNDOS
              </span>
            </div>
          </div>
        </section>

        {/* BARRA DE METRICAS RETRÁTIL / COMPACTA EM ACCORDION NO MOBILE */}
        <section className="ae-stats-container">
          <div className="ae-stats-mobile-bar" onClick={() => setIsMetricsExpanded(!isMetricsExpanded)}>
            <div className="ae-stats-mobile-summary">
              <span className="ae-accent">{stats.total} Total</span> ·{" "}
              <span className="ae-warn">{stats.pending} Pendentes</span> ·{" "}
              <span>Próximo: {stats.nextDays !== null ? (stats.nextDays === 0 ? "Hoje" : `${stats.nextDays}d`) : "—"}</span>
            </div>
            <button type="button" className="ae-mini-btn">
              {isMetricsExpanded ? <IconChevronUp /> : <IconChevronDown />}
              <span>{isMetricsExpanded ? "Ocultar" : "Métricas"}</span>
            </button>
          </div>

          <div className={`ae-stats ${isMetricsExpanded ? "expanded" : ""}`}>
            <div className="ae-stat">
              <div className="ae-stat-label">Total de Eventos</div>
              <div className="ae-stat-value" style={{ color: "var(--ae-accent)" }}>{stats.total}</div>
              <div className="ae-stat-hint">marcos operacionais no calendário</div>
            </div>
            <div className="ae-stat">
              <div className="ae-stat-label">Pendentes</div>
              <div className="ae-stat-value" style={{ color: "var(--ae-warn)" }}>{stats.pending}</div>
              <div className="ae-stat-hint">exigem acompanhamento ativo</div>
            </div>
            <div className="ae-stat">
              <div className="ae-stat-label">Concluídos</div>
              <div className="ae-stat-value" style={{ color: "var(--ae-ok)" }}>{stats.done}</div>
              <div className="ae-stat-hint">finalizados pela equipe</div>
            </div>
            <div className="ae-stat">
              <div className="ae-stat-label">Próximo Marco</div>
              <div className="ae-stat-value" style={{ color: "var(--ae-text)" }}>
                {stats.nextDays !== null
                  ? stats.nextDays < 0
                    ? `Há ${Math.abs(stats.nextDays)}d`
                    : stats.nextDays === 0
                      ? "Hoje"
                      : `${stats.nextDays} dias`
                  : "Concluído"}
              </div>
              <div className="ae-stat-hint">
                {stats.next ? `${stats.next.title} (${dateLabel(stats.next.date)})` : "Nenhum evento pendente"}
              </div>
            </div>
          </div>
        </section>

        {/* NAVEGAÇÃO DE ABAS NO MOBILE */}
        <div className="ae-mobile-tabs" role="tablist">
          <button
            type="button"
            className={`ae-mobile-tab ${activeMobileTab === "agenda" ? "active" : ""}`}
            onClick={() => setActiveMobileTab("agenda")}
          >
            <IconCalendar />
            <span>Lista</span>
          </button>
          <button
            type="button"
            className={`ae-mobile-tab ${activeMobileTab === "calendario" ? "active" : ""}`}
            onClick={() => setActiveMobileTab("calendario")}
          >
            <IconClock />
            <span>Calendário</span>
          </button>
          <button
            type="button"
            className={`ae-mobile-tab ${activeMobileTab === "resumo" ? "active" : ""}`}
            onClick={() => setActiveMobileTab("resumo")}
          >
            <IconStar />
            <span>Resumo</span>
          </button>
        </div>

        {/* MODO QUADRO KANBAN POR FASES DA CAMPANHA */}
        {viewMode === "kanban" && (
          <section className="ae-kanban-board">
            {Object.entries(kanbanGroups).map(([phaseName, groupEvents]) => (
              <div key={phaseName} className="ae-kanban-column">
                <div className="ae-kanban-head">
                  <h3>{phaseName}</h3>
                  <span className="ae-badge">{groupEvents.length}</span>
                </div>
                <div className="ae-kanban-body">
                  {groupEvents.length === 0 ? (
                    <div className="ae-empty-sm">Nenhum marco nesta fase.</div>
                  ) : (
                    groupEvents.map((ev) => {
                      const d = daysUntil(ev.date);
                      return (
                        <div
                          key={ev.id}
                          className={`ae-kcard ${ev.done ? "done" : ""} ${selectedEventId === ev.id ? "selected" : ""}`}
                          onClick={() => setSelectedEventId(ev.id)}
                        >
                          <div className="ae-kcard-head">
                            <span className="ae-badge ae-badge-date">{dateLabel(ev.date)}</span>
                            {ev.important && <span className="ae-badge ae-badge-danger"><IconStar /></span>}
                          </div>
                          <h4 className="ae-kcard-title">{ev.title}</h4>
                          <p className="ae-kcard-desc">{ev.desc}</p>
                          <div className="ae-kcard-foot">
                            <span className={`ae-badge ae-badge-${ev.done ? "ok" : d <= 3 ? "danger" : "warn"}`}>
                              {ev.done ? "Concluído" : d === 0 ? "Hoje" : `${d}d`}
                            </span>
                            <div className="ae-actions">
                              <button
                                type="button"
                                className="ae-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDone(ev.id);
                                }}
                              >
                                {ev.done ? <IconUndo /> : <IconCheck />}
                              </button>
                              <button
                                type="button"
                                className="ae-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal(ev);
                                }}
                              >
                                <IconEdit />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* MODO LISTA E CALENDÁRIO COM LAYOUT MASTER-DETAIL */}
        {viewMode !== "kanban" && (
          <section className={`ae-layout ae-show-mobile-${activeMobileTab}`}>
            {/* COLUNA ESQUERDA: CONTROLES & EVENTOS */}
            <div className="ae-grid ae-col-main">
              <article className="ae-card">
                <div className="ae-card-head">
                  <div>
                    <h2>Agenda de Compromissos</h2>
                    <div className="ae-footer-note">
                      Pressione <kbd className="ae-kbd">/</kbd> para pesquisar ou <kbd className="ae-kbd">N</kbd> para novo evento.
                    </div>
                  </div>
                  <div className="ae-split">
                    <button
                      type="button"
                      className="ae-btn ae-btn-primary ae-btn-touch"
                      onClick={() => openModal(null)}
                    >
                      <IconPlus />
                      <span>Novo Evento</span>
                    </button>
                  </div>
                </div>
                <div className="ae-card-body">
                  {/* CONTROLES E FILTROS */}
                  <div className="ae-controls">
                    <div className="ae-searchwrap">
                      <span className="ae-searchicon"><IconSearch /></span>
                      <input
                        ref={searchInputRef}
                        className="ae-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Pesquisar por data, título, responsável, local (pressione /)..."
                      />
                    </div>
                    <select
                      className="ae-select"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="all">Todas as Categorias</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <select
                      className="ae-select"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Todos os Status</option>
                      <option value="pending">Pendentes</option>
                      <option value="done">Concluídos</option>
                      <option value="important">Importantes</option>
                    </select>
                    <select
                      className="ae-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="dateAsc">Data (mais recente ↑)</option>
                      <option value="dateDesc">Data (mais antiga ↓)</option>
                      <option value="priority">Prioridade</option>
                      <option value="title">Título</option>
                    </select>
                  </div>

                  {/* PILULAS DE FILTRO RÁPIDO */}
                  <div className="ae-pills-bar">
                    <button
                      type="button"
                      className={`ae-pill ${filterStatus === "all" ? "active" : ""}`}
                      onClick={() => setFilterStatus("all")}
                    >
                      Todos ({events.length})
                    </button>
                    <button
                      type="button"
                      className={`ae-pill ${filterStatus === "pending" ? "active" : ""}`}
                      onClick={() => setFilterStatus("pending")}
                    >
                      Pendentes ({stats.pending})
                    </button>
                    <button
                      type="button"
                      className={`ae-pill ${filterStatus === "done" ? "active" : ""}`}
                      onClick={() => setFilterStatus("done")}
                    >
                      Concluídos ({stats.done})
                    </button>
                    <button
                      type="button"
                      className={`ae-pill ${filterStatus === "important" ? "active" : ""}`}
                      onClick={() => setFilterStatus("important")}
                    >
                      Importantes
                    </button>
                  </div>

                  {/* CARDS RESPONSIVOS PARA MOBILE (TOUCH OPTIMIZED) */}
                  <div className="ae-mobile-cards">
                    {visibleEventsMobile.length === 0 ? (
                      <div className="ae-empty">Nenhum evento encontrado com os filtros selecionados.</div>
                    ) : (
                      visibleEventsMobile.map((ev) => {
                        const d = daysUntil(ev.date);
                        return (
                          <div
                            key={ev.id}
                            className={`ae-mcard ${ev.done ? "ae-mcard-done" : ""} ${selectedEventId === ev.id ? "selected" : ""}`}
                            onClick={() => setSelectedEventId(ev.id)}
                          >
                            <div className="ae-mcard-header">
                              <div className="ae-mcard-date-badge">
                                <IconCalendar />
                                <span>{dateLabel(ev.date)} ({weekdayLabel(ev.date)})</span>
                              </div>
                              {ev.important && (
                                <span className="ae-badge ae-badge-danger">
                                  <IconStar /> Importante
                                </span>
                              )}
                            </div>

                            <h3 className="ae-mcard-title">{ev.title}</h3>
                            <div className="ae-mcard-desc">{ev.desc}</div>

                            <div className="ae-mcard-meta">
                              <span className="ae-badge ae-badge-cat">{ev.category}</span>
                              {ev.location && (
                                <span className="ae-badge ae-badge-loc">
                                  <IconLocation /> {ev.location}
                                </span>
                              )}
                              {ev.responsible && (
                                <span className="ae-badge ae-badge-resp">
                                  <IconUser /> {ev.responsible}
                                </span>
                              )}
                            </div>

                            <div className="ae-mcard-footer">
                              <div className="ae-mcard-status">
                                {ev.done ? (
                                  <span className="ae-badge ae-badge-ok"><IconCheck /> Concluído</span>
                                ) : d < 0 ? (
                                  <span className="ae-badge ae-badge-danger">Atrasado ({Math.abs(d)}d)</span>
                                ) : d === 0 ? (
                                  <span className="ae-badge ae-badge-danger">Hoje</span>
                                ) : (
                                  <span className="ae-badge ae-badge-warn">{d} dia{d === 1 ? "" : "s"}</span>
                                )}
                              </div>

                              <div className="ae-mcard-actions">
                                <button
                                  type="button"
                                  className={`ae-mini-btn ${ev.done ? "ae-btn-undo" : "ae-btn-check"}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDone(ev.id);
                                  }}
                                >
                                  {ev.done ? <IconUndo /> : <IconCheck />}
                                  <span>{ev.done ? "Reabrir" : "Concluir"}</span>
                                </button>
                                <button
                                  type="button"
                                  className="ae-mini-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openModal(ev);
                                  }}
                                >
                                  <IconEdit />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  className="ae-mini-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicateEvent(ev.id);
                                  }}
                                >
                                  <IconCopy />
                                </button>
                                <button
                                  type="button"
                                  className="ae-mini-btn ae-btn-trash"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteEvent(ev.id);
                                  }}
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {filteredEvents.length > visibleCountMobile && (
                      <button
                        type="button"
                        className="ae-btn ae-btn-touch ae-btn-more"
                        onClick={() => setVisibleCountMobile((prev) => prev + 6)}
                      >
                        Carregar Mais Compromissos ({filteredEvents.length - visibleCountMobile} restantes)
                      </button>
                    )}
                  </div>

                  {/* TABELA DE EVENTOS PARA DESKTOP */}
                  <div className="ae-table-wrap">
                    <table className="ae-table">
                      <thead>
                        <tr>
                          <th className="ae-th" style={{ width: "13%" }}>Data</th>
                          <th className="ae-th" style={{ width: "18%" }}>Categoria</th>
                          <th className="ae-th">Título / Descrição</th>
                          <th className="ae-th" style={{ width: "11%" }}>Prazo</th>
                          <th className="ae-th" style={{ width: "11%" }}>Status</th>
                          <th className="ae-th" style={{ width: "12%" }}>Responsável</th>
                          <th className="ae-th" style={{ width: "11%" }}>Local</th>
                          <th className="ae-th" style={{ width: "14%" }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEvents.length === 0 ? (
                          <tr>
                            <td className="ae-td" colSpan={8}>
                              <div className="ae-empty">Nenhum evento encontrado com os filtros selecionados.</div>
                            </td>
                          </tr>
                        ) : (
                          filteredEvents.map((ev) => {
                            const d = daysUntil(ev.date);
                            const isSelected = selectedEventId === ev.id;
                            return (
                              <tr
                                key={ev.id}
                                className={`${ev.done ? "ae-row-done" : ""} ${isSelected ? "ae-row-selected" : ""}`}
                                onClick={() => setSelectedEventId(ev.id)}
                                style={{ cursor: "pointer" }}
                              >
                                <td className="ae-td" data-label="Data">
                                  <div>
                                    <strong style={{ color: "var(--ae-text)" }}>{dateLabel(ev.date)}</strong>
                                  </div>
                                  <div className="ae-footer-note">{weekdayLabel(ev.date)}</div>
                                </td>
                                <td className="ae-td" data-label="Categoria">
                                  <span className="ae-badge">{ev.category}</span>
                                </td>
                                <td className="ae-td" data-label="Título">
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                                    <strong>{ev.title}</strong>
                                    {ev.important && (
                                      <span className="ae-badge ae-badge-danger">
                                        <IconStar /> Importante
                                      </span>
                                    )}
                                  </div>
                                  <div className="ae-footer-note">{ev.desc}</div>
                                </td>
                                <td className="ae-td" data-label="Prazo">
                                  {ev.done ? (
                                    <span className="ae-badge ae-badge-ok">Concluído</span>
                                  ) : d < 0 ? (
                                    <span className="ae-badge ae-badge-danger">Atrasado ({Math.abs(d)}d)</span>
                                  ) : d === 0 ? (
                                    <span className="ae-badge ae-badge-danger">Hoje</span>
                                  ) : d <= 7 ? (
                                    <span className="ae-badge ae-badge-danger">{d} dia{d === 1 ? "" : "s"}</span>
                                  ) : (
                                    <span className="ae-badge ae-badge-warn">{d} dias</span>
                                  )}
                                </td>
                                <td className="ae-td" data-label="Status">
                                  {ev.done ? (
                                    <span className="ae-badge ae-badge-ok">Concluído</span>
                                  ) : ev.important ? (
                                    <span className="ae-badge ae-badge-warn">Importante</span>
                                  ) : (
                                    <span className="ae-badge">Pendente</span>
                                  )}
                                </td>
                                <td className="ae-td" data-label="Responsável">
                                  <span className="ae-badge">{ev.responsible || "—"}</span>
                                </td>
                                <td className="ae-td" data-label="Local">
                                  <span className="ae-badge">{ev.location || "—"}</span>
                                </td>
                                <td className="ae-td" data-label="Ações">
                                  <div className="ae-actions">
                                    <button
                                      type="button"
                                      className="ae-mini-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleDone(ev.id);
                                      }}
                                      title={ev.done ? "Reabrir evento" : "Marcar como concluído"}
                                    >
                                      {ev.done ? <IconUndo /> : <IconCheck />}
                                    </button>
                                    <button
                                      type="button"
                                      className="ae-mini-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openModal(ev);
                                      }}
                                      title="Editar evento"
                                    >
                                      <IconEdit />
                                    </button>
                                    <button
                                      type="button"
                                      className="ae-mini-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        duplicateEvent(ev.id);
                                      }}
                                      title="Duplicar evento"
                                    >
                                      <IconCopy />
                                    </button>
                                    <button
                                      type="button"
                                      className="ae-mini-btn ae-btn-trash"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteEvent(ev.id);
                                      }}
                                      title="Excluir evento"
                                    >
                                      <IconTrash />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            </div>

            {/* COLUNA DIREITA: INSPECTOR MASTER-DETAIL & CALENDÁRIO */}
            <div className="ae-sidebar-panel ae-col-side">
              {/* INSPECTOR DE DETALHES MASTER-DETAIL */}
              {selectedEvent && (
                <article className="ae-card ae-inspector-card">
                  <div className="ae-card-head">
                    <div>
                      <h3>Detalhes do Compromisso</h3>
                      <div className="ae-footer-note">Informações completas do evento selecionado.</div>
                    </div>
                    <div className="ae-actions">
                      <button
                        type="button"
                        className="ae-mini-btn"
                        onClick={() => openModal(selectedEvent)}
                      >
                        <IconEdit /> Editar
                      </button>
                    </div>
                  </div>
                  <div className="ae-card-body">
                    <div className="ae-inspector-title">
                      <h2>{selectedEvent.title}</h2>
                      <span className={`ae-badge ae-badge-${selectedEvent.done ? "ok" : "warn"}`}>
                        {selectedEvent.done ? "Concluído" : "Pendente"}
                      </span>
                    </div>

                    <p className="ae-inspector-desc">{selectedEvent.desc || "Sem observações adicionais."}</p>

                    <div className="ae-inspector-grid">
                      <div className="ae-inspector-item">
                        <span className="label"><IconCalendar /> Data</span>
                        <strong className="val">{dateLabel(selectedEvent.date)} ({weekdayLabel(selectedEvent.date)})</strong>
                      </div>
                      <div className="ae-inspector-item">
                        <span className="label"><IconStar /> Categoria</span>
                        <strong className="val">{selectedEvent.category}</strong>
                      </div>
                      <div className="ae-inspector-item">
                        <span className="label"><IconUser /> Responsável</span>
                        <strong className="val">{selectedEvent.responsible || "Não atribuído"}</strong>
                      </div>
                      <div className="ae-inspector-item">
                        <span className="label"><IconLocation /> Local</span>
                        <strong className="val">{selectedEvent.location || "Não especificado"}</strong>
                      </div>
                    </div>

                    <div className="ae-inspector-actions">
                      <button
                        type="button"
                        className={`ae-btn ${selectedEvent.done ? "ae-btn-undo" : "ae-btn-primary"}`}
                        onClick={() => toggleDone(selectedEvent.id)}
                      >
                        {selectedEvent.done ? <IconUndo /> : <IconCheck />}
                        <span>{selectedEvent.done ? "Reabrir Compromisso" : "Marcar como Concluído"}</span>
                      </button>
                    </div>
                  </div>
                </article>
              )}

              {/* CALENDÁRIO MENSAL */}
              <article className="ae-card">
                <div className="ae-card-head">
                  <div>
                    <h3>Calendário Mensal</h3>
                    <div className="ae-footer-note">Visão global dos eventos por dia.</div>
                  </div>
                </div>
                <div className="ae-card-body">
                  <div className="ae-calendar">
                    <div className="ae-cal-head">
                      <strong>
                        {calendarData.monthLabel.charAt(0).toUpperCase() +
                          calendarData.monthLabel.slice(1)}
                      </strong>
                      <div className="ae-actions">
                        <button
                          type="button"
                          className="ae-mini-btn"
                          onClick={() =>
                            setFilterMonth(
                              new Date(filterMonth.getFullYear(), filterMonth.getMonth() - 1, 1),
                            )
                          }
                          title="Mês anterior"
                        >
                          <IconChevronLeft />
                        </button>
                        <button
                          type="button"
                          className="ae-mini-btn"
                          onClick={() =>
                            setFilterMonth(
                              new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                            )
                          }
                          title="Mês atual"
                        >
                          Hoje
                        </button>
                        <button
                          type="button"
                          className="ae-mini-btn"
                          onClick={() =>
                            setFilterMonth(
                              new Date(filterMonth.getFullYear(), filterMonth.getMonth() + 1, 1),
                            )
                          }
                          title="Próximo mês"
                        >
                          <IconChevronRight />
                        </button>
                      </div>
                    </div>
                    <div className="ae-legend">
                      <span className="ae-badge ae-badge-ok">Concluído</span>
                      <span className="ae-badge ae-badge-warn">Pendente</span>
                      <span className="ae-badge ae-badge-danger">Urgente</span>
                    </div>
                    <div className="ae-month-grid">
                      {dowLabels.map((d) => (
                        <div key={d} className="ae-dow">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="ae-month-grid">
                      {calendarData.cells.map((cell, idx) => (
                        <div
                          key={idx}
                          className={`ae-day ${cell.inMonth ? "" : "muted"}`}
                          title={cell.iso}
                        >
                          <div className="ae-day-num">{cell.dateNumber}</div>
                          {cell.eventCount > 0 ? (
                            <div className={`ae-badge ae-badge-${cell.highlight || "warn"}`}>
                              {cell.eventCount} {cell.eventCount === 1 ? "evt" : "evts"}
                            </div>
                          ) : (
                            <div className="ae-footer-note">&nbsp;</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </section>
        )}
      </div>

      {/* BOTÃO FLUTUANTE (FAB) PARA CELULAR */}
      <button
        type="button"
        className="ae-fab-btn"
        onClick={() => openModal(null)}
        title="Cadastrar Novo Evento"
      >
        <IconPlus />
      </button>

      {/* MODAL BOTTOM SHEET TOUCH FRIENDLY */}
      {isModalOpen && (
        <div className="ae-modal" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="ae-modal-card ae-modal-bottom-sheet">
            <div className="ae-card-head">
              <div>
                <h2>{editingId !== null ? "Editar Evento" : "Novo Evento"}</h2>
                <div className="ae-footer-note">Armazenado com segurança no navegador.</div>
              </div>
              <button type="button" className="ae-mini-btn" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="ae-modal-body">
              <div className="ae-form-grid">
                <div>
                  <label>Data</label>
                  <input
                    className="ae-field"
                    type="date"
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                  />
                </div>
                <div>
                  <label>Categoria</label>
                  <input
                    className="ae-field"
                    placeholder="Ex.: Campanha, Jurídico, Agenda"
                    value={fCategory}
                    onChange={(e) => setFCategory(e.target.value)}
                  />
                </div>
                <div className="full">
                  <label>Título</label>
                  <input
                    className="ae-field"
                    placeholder="Ex.: Último dia para convenção"
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                  />
                </div>
                <div className="full">
                  <label>Descrição / lembrete</label>
                  <textarea
                    className="ae-textarea"
                    placeholder="Detalhes, tarefas e observações"
                    value={fDesc}
                    onChange={(e) => setFDesc(e.target.value)}
                  />
                </div>
                <div>
                  <label>Responsável</label>
                  <input
                    className="ae-field"
                    placeholder="Ex.: Coordenação geral"
                    value={fResponsible}
                    onChange={(e) => setFResponsible(e.target.value)}
                  />
                </div>
                <div>
                  <label>Local</label>
                  <input
                    className="ae-field"
                    placeholder="Ex.: Arapongas"
                    value={fLocation}
                    onChange={(e) => setFLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label>Prioridade</label>
                  <select
                    className="ae-select"
                    value={String(fPriority)}
                    onChange={(e) => setFPriority(Number(e.target.value))}
                  >
                    <option value="1">Baixa</option>
                    <option value="2">Média</option>
                    <option value="3">Alta</option>
                  </select>
                </div>
                <div>
                  <label>Status</label>
                  <select
                    className="ae-select"
                    value={String(fDone)}
                    onChange={(e) => setFDone(e.target.value === "true")}
                  >
                    <option value="false">Pendente</option>
                    <option value="true">Concluído</option>
                  </select>
                </div>
                <div>
                  <label>Importante</label>
                  <select
                    className="ae-select"
                    value={String(fImportant)}
                    onChange={(e) => setFImportant(e.target.value === "true")}
                  >
                    <option value="false">Não</option>
                    <option value="true">Sim</option>
                  </select>
                </div>
                <div>
                  <label>Notificar antes</label>
                  <select
                    className="ae-select"
                    value={String(fReminder)}
                    onChange={(e) => setFReminder(Number(e.target.value))}
                  >
                    <option value="0">Sem lembrete</option>
                    <option value="1">1 dia antes</option>
                    <option value="3">3 dias antes</option>
                    <option value="7">7 dias antes</option>
                    <option value="15">15 dias antes</option>
                  </select>
                </div>
              </div>
              <div className="ae-actions" style={{ justifyContent: "flex-end", marginTop: "6px" }}>
                <button type="button" className="ae-btn" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="button" className="ae-btn ae-btn-primary" onClick={saveFromModal}>
                  Salvar evento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
