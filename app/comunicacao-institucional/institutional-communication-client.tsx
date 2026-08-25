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

const IconLocation = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconUser = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
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

const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
const ELECTION_DATE = new Date("2026-10-04T08:00:00-03:00").getTime();

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
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase();
}

function monthShortLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
}

function dayNumber(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return String(d.getDate()).padStart(2, "0");
}

function isoToDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getTime();
}

function getCategoryColor(category: string) {
  if (category.includes("FASE 1")) return { bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.3)", text: "#fcd34d" };
  if (category.includes("FASE 2")) return { bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)", text: "#38bdf8" };
  if (category.includes("Jurídico") || category.includes("Propaganda")) return { bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.3)", text: "#c084fc" };
  if (category.includes("Eleição") || category.includes("Diplomação") || category.includes("Posse")) return { bg: "rgba(99, 102, 241, 0.12)", border: "rgba(99, 102, 241, 0.3)", text: "#818cf8" };
  return { bg: "rgba(52, 211, 153, 0.12)", border: "rgba(52, 211, 153, 0.3)", text: "#34d399" };
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
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("dateAsc");
  const [filterMonth, setFilterMonth] = useState<Date>(new Date("2026-08-01T00:00:00"));

  // VISÕES E NAVEGAÇÃO
  const [viewMode, setViewMode] = useState<"list" | "kanban" | "calendar">("list");
  const [activeMobileTab, setActiveMobileTab] = useState<"agenda" | "calendario" | "resumo">("agenda");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // MODAIS
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

  // CONTAGEM REGRESSIVA PARA 04 DE OUTUBRO DE 2026
  const [countdown, setCountdown] = useState(getInitialElectionCountdown);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);

  const handleBackToDashboard = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
      return;
    }
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getInitialElectionCountdown());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // CARREGAR DADOS SALVOS NO LOCALSTORAGE
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed);
        }
      }
    } catch {}
  }, []);

  // FECHAR MENU DE FERRAMENTAS AO CLICAR FORA
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        setFilterDate(null);
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
      const okDate = !filterDate || ev.date === filterDate;
      const okStatus =
        filterStatus === "all" ||
        (filterStatus === "pending" && !ev.done) ||
        (filterStatus === "done" && ev.done) ||
        (filterStatus === "important" && ev.important);
      return okQ && okCat && okDate && okStatus;
    });

    list.sort((a, b) => {
      if (sortBy === "dateDesc") return isoToDate(b.date) - isoToDate(a.date);
      if (sortBy === "title") return a.title.localeCompare(b.title, "pt-BR");
      if (sortBy === "priority")
        return b.priority - a.priority || isoToDate(a.date) - isoToDate(b.date);
      return isoToDate(a.date) - isoToDate(b.date);
    });

    return list;
  }, [events, search, filterCategory, filterDate, filterStatus, sortBy]);

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
    
    const pendingUpcoming = [...events]
      .filter((e) => !e.done)
      .sort((a, b) => isoToDate(a.date) - isoToDate(b.date));
    
    const next = pendingUpcoming[0] || null;
    const nextDays = next ? daysUntil(next.date) : null;

    return { total, pending, done, next, nextDays };
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

  const openModal = (ev?: CampaignEvent | null) => {
    if (ev) {
      setEditingId(ev.id);
      setFDate(ev.date);
      setFCategory(ev.category);
      setFTitle(ev.title);
      setFDesc(ev.desc);
      setFResponsible(ev.responsible);
      setFLocation(ev.location);
      setFPriority(ev.priority);
      setFDone(ev.done);
      setFImportant(ev.important);
      setFReminder(ev.reminder);
    } else {
      setEditingId(null);
      setFDate(new Date().toISOString().slice(0, 10));
      setFCategory("FASE 1 — Alinhamento interno");
      setFTitle("");
      setFDesc("");
      setFResponsible("Coordenação geral");
      setFLocation("Arapongas");
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

  return (
    <div className={`ae-root ${theme === "light" ? "light-mode" : ""}`} data-theme={theme}>
      <div className="ae-shell">
        {/* TOPBAR EXECUTIVA DE ALTO IMPACTO */}
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
              <h1 className="ae-title">Agenda Inteligente — Pedro Lupion & Sérgio Onofre</h1>
              <div className="ae-subtitle">
                Cronograma operacional da campanha • Arapongas — PR • Pressione `/` busca, `N` novo evento.
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

            <button
              type="button"
              className="ae-btn ae-btn-primary"
              onClick={() => openModal(null)}
              title="Cadastrar novo compromisso na agenda (N)"
            >
              <IconPlus />
              <span>+ Novo Evento</span>
            </button>

            {/* MENU DROPDOWN DE FERRAMENTAS E OPÇÕES */}
            <div className="ae-dropdown-wrap" ref={toolsMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="ae-btn"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                title="Ferramentas e Opções da Agenda"
              >
                <IconSettings />
                <span>Opções</span>
                <IconChevronDown />
              </button>
              {isToolsOpen && (
                <div className="ae-dropdown-menu">
                  <button type="button" onClick={() => { exportIcal(events); setIsToolsOpen(false); }}>
                    <IconDownload /> Agenda iCal (.ics)
                  </button>
                  <button type="button" onClick={() => { fileInputRef.current?.click(); setIsToolsOpen(false); }}>
                    <Icons.Upload size={14} /> Importar JSON
                  </button>
                  <button type="button" onClick={() => { exportJson(); setIsToolsOpen(false); }}>
                    <IconDownload /> Exportar JSON
                  </button>
                  <button type="button" onClick={() => { window.print(); setIsToolsOpen(false); }}>
                    <IconPrinter /> Imprimir Cronograma
                  </button>
                  <button type="button" onClick={() => { toggleTheme(); setIsToolsOpen(false); }}>
                    {theme === "light" ? <IconMoon /> : <IconSun />} {theme === "light" ? "Modo Escuro" : "Modo Claro"}
                  </button>
                  <div className="ae-dropdown-divider" />
                  <button type="button" onClick={() => { resetBase(); setIsToolsOpen(false); }} style={{ color: "var(--ae-danger)" }}>
                    <IconTrash /> Resetar Modelo Inicial
                  </button>
                </div>
              )}
            </div>

            <button type="button" className="ae-btn ae-btn-ghost" onClick={handleBackToDashboard} title="Voltar para a Visão Geral">
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

        {/* UNIFIED HERO BANNER: CONTAGEM REGRESSIVA + 4 CARTÕES DE MÉTRICAS */}
        <section className="ae-hero-banner">
          <div className="ae-hero-countdown">
            <div className="ae-hero-badge">🗳️ ELEIÇÕES 2026 — 1º TURNO</div>
            <div className="ae-hero-target">
              Votação Geral: <strong>04 de Outubro de 2026</strong>
            </div>
            <div className="ae-countdown-boxes">
              <div className="ae-cbox">
                <strong>{countdown.days}</strong>
                <small>DIAS</small>
              </div>
              <div className="ae-cbox-sep">:</div>
              <div className="ae-cbox">
                <strong>{String(countdown.hours).padStart(2, "0")}</strong>
                <small>HORAS</small>
              </div>
              <div className="ae-cbox-sep">:</div>
              <div className="ae-cbox">
                <strong>{String(countdown.minutes).padStart(2, "0")}</strong>
                <small>MINUTOS</small>
              </div>
              <div className="ae-cbox-sep">:</div>
              <div className="ae-cbox">
                <strong>{String(countdown.seconds).padStart(2, "0")}</strong>
                <small>SEGUNDOS</small>
              </div>
            </div>
          </div>

          <div className="ae-hero-metrics">
            <div className="ae-hstat">
              <div className="ae-hstat-label">Total de Eventos</div>
              <div className="ae-hstat-val" style={{ color: "#38bdf8" }}>{stats.total}</div>
              <div className="ae-hstat-sub">marcos operacionais</div>
            </div>
            <div className="ae-hstat">
              <div className="ae-hstat-label">Pendentes</div>
              <div className="ae-hstat-val" style={{ color: "#fbbf24" }}>{stats.pending}</div>
              <div className="ae-hstat-sub">exigem ação</div>
            </div>
            <div className="ae-hstat">
              <div className="ae-hstat-label">Concluídos</div>
              <div className="ae-hstat-val" style={{ color: "#34d399" }}>{stats.done}</div>
              <div className="ae-hstat-sub">finalizados</div>
            </div>
            <div className="ae-hstat">
              <div className="ae-hstat-label">Próximo Marco</div>
              <div className="ae-hstat-val" style={{ fontSize: "1.25rem", color: "#f8fafc" }}>
                {stats.nextDays !== null
                  ? stats.nextDays < 0
                    ? `Há ${Math.abs(stats.nextDays)}d`
                    : stats.nextDays === 0
                      ? "Hoje"
                      : `${stats.nextDays} dias`
                  : "Concluído"}
              </div>
              <div className="ae-hstat-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stats.next ? stats.next.title : "Sem pendências"}
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
                    <div className="ae-empty-sm">Nenhum evento registrado</div>
                  ) : (
                    groupEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`ae-kcard ${ev.done ? "done" : ""} ${selectedEvent?.id === ev.id ? "selected" : ""}`}
                        onClick={() => setSelectedEventId(ev.id)}
                      >
                        <div className="ae-kcard-head">
                          <span className="ae-badge" style={{ background: getCategoryColor(ev.category).bg, color: getCategoryColor(ev.category).text, borderColor: getCategoryColor(ev.category).border }}>
                            {dateLabel(ev.date)}
                          </span>
                          {ev.important && <span style={{ color: "#fbbf24" }}><IconStar /></span>}
                        </div>
                        <h4 className="ae-kcard-title">{ev.title}</h4>
                        <p className="ae-kcard-desc">{ev.desc}</p>
                        <div className="ae-kcard-foot">
                          <span className="ae-badge">{ev.location}</span>
                          <button
                            type="button"
                            className="ae-mini-btn"
                            onClick={(e) => { e.stopPropagation(); toggleDone(ev.id); }}
                          >
                            {ev.done ? <IconUndo /> : <IconCheck />}
                            <span>{ev.done ? "Desfazer" : "Concluir"}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* MODO CALENDÁRIO MÊS COMPLETO */}
        {viewMode === "calendar" && (
          <section className="ae-card" style={{ padding: "20px" }}>
            <div className="ae-cal-head" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>{calendarData.monthLabel}</h2>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    className="ae-mini-btn"
                    onClick={() => setFilterMonth(new Date(filterMonth.getFullYear(), filterMonth.getMonth() - 1, 1))}
                  >
                    ‹ Anterior
                  </button>
                  <button
                    type="button"
                    className="ae-mini-btn"
                    onClick={() => setFilterMonth(new Date())}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    className="ae-mini-btn"
                    onClick={() => setFilterMonth(new Date(filterMonth.getFullYear(), filterMonth.getMonth() + 1, 1))}
                  >
                    Próximo ›
                  </button>
                </div>
              </div>
              <div className="ae-legend">
                <span className="ae-badge ae-badge-ok">Concluído</span>
                <span className="ae-badge ae-badge-warn">Pendente</span>
                <span className="ae-badge ae-badge-danger">Importante</span>
              </div>
            </div>

            <div className="ae-month-grid">
              {dowLabels.map((dow) => (
                <div key={dow} className="ae-dow">{dow}</div>
              ))}
              {calendarData.cells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`ae-day ${cell.inMonth ? "" : "muted"} ${filterDate === cell.iso ? "selected" : ""}`}
                  onClick={() => setFilterDate(filterDate === cell.iso ? null : cell.iso)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="ae-day-num">{cell.dateNumber}</div>
                  {cell.eventCount > 0 && (
                    <span className={`ae-badge ${cell.highlight === "ok" ? "ae-badge-ok" : cell.highlight === "danger" ? "ae-badge-danger" : "ae-badge-warn"}`}>
                      {cell.eventCount} {cell.eventCount === 1 ? "evento" : "eventos"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* VISÃO LISTA MASTER-DETAIL (PADRÃO) */}
        {viewMode === "list" && (
          <div className={`ae-layout ${activeMobileTab === "agenda" ? "ae-show-mobile-agenda" : activeMobileTab === "calendario" ? "ae-show-mobile-calendario" : "ae-show-mobile-resumo"}`}>
            {/* COLUNA ESQUERDA: FILTROS + TIMELINE DE COMPROMISSOS */}
            <div className="ae-col-main ae-grid">
              <section className="ae-card">
                <div className="ae-card-head">
                  <div>
                    <h2>Agenda de Compromissos</h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--ae-muted)" }}>
                      Pressione <kbd className="ae-kbd">/</kbd> para pesquisar ou <kbd className="ae-kbd">N</kbd> para novo evento.
                    </p>
                  </div>
                  {filterDate && (
                    <button type="button" className="ae-mini-btn ae-btn-trash" onClick={() => setFilterDate(null)}>
                      <IconClose /> Limpar Filtro por Data ({dateLabel(filterDate)})
                    </button>
                  )}
                </div>
                <div className="ae-card-body">
                  {/* BARRA DE CONTROLES E PESQUISA */}
                  <div className="ae-controls">
                    <div className="ae-searchwrap">
                      <div className="ae-searchicon"><IconSearch /></div>
                      <input
                        ref={searchInputRef}
                        type="text"
                        className="ae-search"
                        placeholder="Pesquisar por título, responsável, local ou descrição…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      className="ae-select"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="all">Todas as Categorias ({categories.length})</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select
                      className="ae-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="dateAsc">Data (mais antiga ➔ recente)</option>
                      <option value="dateDesc">Data (mais recente ➔ antiga)</option>
                      <option value="priority">Prioridade</option>
                      <option value="title">Título A-Z</option>
                    </select>
                  </div>

                  {/* PÍLULAS DE FILTRO RÁPIDO */}
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
                      ★ Importantes ({events.filter((e) => e.important).length})
                    </button>
                  </div>

                  {/* TIMELINE DE COMPROMISSOS (REPROJETADA) */}
                  <div className="ae-timeline-list">
                    {filteredEvents.length === 0 ? (
                      <div className="ae-empty">
                        Nenhum compromisso encontrado para os filtros selecionados.
                      </div>
                    ) : (
                      filteredEvents.map((ev) => {
                        const catStyle = getCategoryColor(ev.category);
                        const isSelected = selectedEvent?.id === ev.id;

                        return (
                          <div
                            key={ev.id}
                            className={`ae-timeline-item ${ev.done ? "done" : ""} ${isSelected ? "selected" : ""}`}
                            onClick={() => setSelectedEventId(ev.id)}
                          >
                            {/* BADGE DE DATA TIMELINE COM COR DA FASE */}
                            <div className="ae-date-block" style={{ background: catStyle.bg, borderColor: catStyle.border }}>
                              <div className="ae-date-day" style={{ color: catStyle.text }}>{dayNumber(ev.date)}</div>
                              <div className="ae-date-month">{monthShortLabel(ev.date)}</div>
                              <div className="ae-date-dow">{weekdayLabel(ev.date)}</div>
                            </div>

                            {/* CONTEÚDO PRINCIPAL DO CARD */}
                            <div className="ae-event-content">
                              <div className="ae-event-top">
                                <span className="ae-cat-badge" style={{ background: catStyle.bg, color: catStyle.text, borderColor: catStyle.border }}>
                                  {ev.category}
                                </span>
                                {ev.important && (
                                  <span className="ae-important-star" title="Compromisso prioritário/importante">
                                    <IconStar /> Importante
                                  </span>
                                )}
                              </div>

                              <h3 className="ae-event-title">{ev.title}</h3>
                              <p className="ae-event-desc">{ev.desc}</p>

                              <div className="ae-event-meta">
                                {ev.location && (
                                  <span className="ae-meta-item">
                                    <IconLocation /> {ev.location}
                                  </span>
                                )}
                                {ev.responsible && (
                                  <span className="ae-meta-item">
                                    <IconUser /> {ev.responsible}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* AÇÕES NO CARD */}
                            <div className="ae-event-actions">
                              <button
                                type="button"
                                className={`ae-mini-btn ${ev.done ? "" : "ae-btn-primary"}`}
                                onClick={(e) => { e.stopPropagation(); toggleDone(ev.id); }}
                                title={ev.done ? "Marcar como pendente" : "Marcar como concluído"}
                              >
                                {ev.done ? <IconUndo /> : <IconCheck />}
                                <span>{ev.done ? "Desfazer" : "Concluir"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* COLUNA DIREITA: INSPECTOR MASTER-DETAIL + CALENDÁRIO */}
            <div className="ae-col-side ae-sidebar-panel">
              {/* CARTÃO DO EVENTO SELECIONADO (INSPECTOR) */}
              {selectedEvent && (
                <section className="ae-card ae-inspector-card">
                  <div className="ae-card-head">
                    <div className="ae-badge" style={{ background: getCategoryColor(selectedEvent.category).bg, color: getCategoryColor(selectedEvent.category).text, borderColor: getCategoryColor(selectedEvent.category).border }}>
                      {selectedEvent.category}
                    </div>
                    <span className={`ae-badge ${selectedEvent.done ? "ae-badge-ok" : "ae-badge-warn"}`}>
                      {selectedEvent.done ? "✓ Concluído" : "⏱ Pendente"}
                    </span>
                  </div>
                  <div className="ae-card-body">
                    <div className="ae-inspector-title">
                      <h2>{selectedEvent.title}</h2>
                    </div>
                    <p className="ae-inspector-desc">{selectedEvent.desc}</p>

                    <div className="ae-inspector-grid">
                      <div className="ae-inspector-item">
                        <span className="label"><IconCalendar /> Data</span>
                        <span className="val"><strong>{dateLabel(selectedEvent.date)}</strong> ({weekdayLabel(selectedEvent.date)})</span>
                      </div>
                      <div className="ae-inspector-item">
                        <span className="label"><IconLocation /> Local</span>
                        <span className="val">{selectedEvent.location || "Arapongas"}</span>
                      </div>
                      <div className="ae-inspector-item">
                        <span className="label"><IconUser /> Responsável</span>
                        <span className="val">{selectedEvent.responsible || "Coordenação"}</span>
                      </div>
                      <div className="ae-inspector-item">
                        <span className="label"><IconStar /> Prioridade</span>
                        <span className="val">P{selectedEvent.priority} {selectedEvent.important ? "· Importante" : ""}</span>
                      </div>
                    </div>

                    <div className="ae-inspector-actions">
                      <button
                        type="button"
                        className="ae-btn ae-btn-primary"
                        onClick={() => toggleDone(selectedEvent.id)}
                      >
                        {selectedEvent.done ? <IconUndo /> : <IconCheck />}
                        <span>{selectedEvent.done ? "Reabrir Evento" : "Marcar como Concluído"}</span>
                      </button>
                      <button
                        type="button"
                        className="ae-btn"
                        onClick={() => openModal(selectedEvent)}
                      >
                        <IconEdit /> Editar
                      </button>
                      <button
                        type="button"
                        className="ae-btn"
                        onClick={() => duplicateEvent(selectedEvent.id)}
                      >
                        <IconCopy /> Duplicar
                      </button>
                      <button
                        type="button"
                        className="ae-btn ae-btn-trash"
                        onClick={() => deleteEvent(selectedEvent.id)}
                      >
                        <IconTrash /> Excluir
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* CALENDÁRIO MENSAUL INTERATIVO */}
              <section className="ae-card">
                <div className="ae-card-head">
                  <h3>Calendário Mensal</h3>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      className="ae-mini-btn"
                      onClick={() => setFilterMonth(new Date(filterMonth.getFullYear(), filterMonth.getMonth() - 1, 1))}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="ae-mini-btn"
                      onClick={() => setFilterMonth(new Date())}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      className="ae-mini-btn"
                      onClick={() => setFilterMonth(new Date(filterMonth.getFullYear(), filterMonth.getMonth() + 1, 1))}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="ae-card-body" style={{ padding: "12px" }}>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, marginBottom: "8px", textTransform: "capitalize", color: "var(--ae-text)" }}>
                    {calendarData.monthLabel}
                  </div>

                  <div className="ae-month-grid">
                    {dowLabels.map((dow) => (
                      <div key={dow} className="ae-dow">{dow}</div>
                    ))}
                    {calendarData.cells.map((cell, idx) => (
                      <div
                        key={idx}
                        className={`ae-day ${cell.inMonth ? "" : "muted"} ${filterDate === cell.iso ? "selected" : ""}`}
                        onClick={() => setFilterDate(filterDate === cell.iso ? null : cell.iso)}
                        style={{ cursor: "pointer", position: "relative" }}
                        title={cell.eventCount > 0 ? `${cell.eventCount} eventos nesta data` : ""}
                      >
                        <div className="ae-day-num">{cell.dateNumber}</div>
                        {cell.eventCount > 0 && (
                          <div
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: cell.highlight === "ok" ? "#34d399" : cell.highlight === "danger" ? "#f87171" : "#fbbf24",
                              margin: "2px auto 0 auto",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* BOTÃO FLUTUANTE (FAB) PARA CADASTRAR EM MOBILE */}
        <button
          type="button"
          className="ae-fab-btn"
          onClick={() => openModal(null)}
          title="Cadastrar compromisso (+)"
        >
          <IconPlus />
        </button>

        {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
        {isModalOpen && (
          <div className="ae-modal">
            <div className="ae-modal-card ae-modal-bottom-sheet">
              <div className="ae-card-head">
                <h2>{editingId !== null ? "Editar Compromisso" : "Novo Compromisso"}</h2>
                <button type="button" className="ae-mini-btn" onClick={closeModal}><IconClose /></button>
              </div>
              <div className="ae-modal-body">
                <div className="ae-form-grid">
                  <div>
                    <label>Data *</label>
                    <input
                      type="date"
                      className="ae-field"
                      value={fDate}
                      onChange={(e) => setFDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Categoria / Fase *</label>
                    <input
                      type="text"
                      className="ae-field"
                      list="categories-list"
                      placeholder="Ex: FASE 1 — Alinhamento interno"
                      value={fCategory}
                      onChange={(e) => setFCategory(e.target.value)}
                    />
                    <datalist id="categories-list">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div className="full">
                    <label>Título do Compromisso *</label>
                    <input
                      type="text"
                      className="ae-field"
                      placeholder="Ex: Reunião com lideranças de bairro"
                      value={fTitle}
                      onChange={(e) => setFTitle(e.target.value)}
                    />
                  </div>
                  <div className="full">
                    <label>Descrição Operacional</label>
                    <textarea
                      className="ae-textarea"
                      placeholder="Detalhes, horários, pauta da reunião…"
                      value={fDesc}
                      onChange={(e) => setFDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Localização</label>
                    <input
                      type="text"
                      className="ae-field"
                      placeholder="Ex: Arapongas"
                      value={fLocation}
                      onChange={(e) => setFLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Responsável</label>
                    <input
                      type="text"
                      className="ae-field"
                      placeholder="Ex: Coordenação"
                      value={fResponsible}
                      onChange={(e) => setFResponsible(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Prioridade</label>
                    <select
                      className="ae-select"
                      value={fPriority}
                      onChange={(e) => setFPriority(Number(e.target.value))}
                    >
                      <option value={1}>P1 — Baixa</option>
                      <option value={2}>P2 — Média</option>
                      <option value={3}>P3 — Alta</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "18px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={fImportant}
                        onChange={(e) => setFImportant(e.target.checked)}
                      />
                      <span>Compromisso Importante (★)</span>
                    </label>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "14px" }}>
                  <button type="button" className="ae-btn" onClick={closeModal}>Cancelar</button>
                  <button type="button" className="ae-btn ae-btn-primary" onClick={saveFromModal}>
                    {editingId !== null ? "Salvar Alterações" : "Cadastrar Evento"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
