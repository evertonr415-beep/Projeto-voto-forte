"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function weekdayLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long" });
}

function isoToDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getTime();
}

export default function InstitutionalCommunicationClient() {
  const [events, setEvents] = useState<CampaignEvent[]>(baseEvents);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("dateAsc");
  const [filterMonth, setFilterMonth] = useState<Date>(new Date("2026-08-01T00:00:00"));

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inicialização e Carregamento LocalStorage
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

  // Estatísticas com visualização clara
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

  // Lembretes próximos
  const upcomingReminders = useMemo(() => {
    return events
      .filter(
        (ev) =>
          !ev.done &&
          daysUntil(ev.date) >= 0 &&
          daysUntil(ev.date) <= Math.max(1, ev.reminder || 0),
      )
      .slice(0, 4);
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
    }
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

  return (
    <div className={`ae-root ${theme === "light" ? "light-mode" : ""}`} data-theme={theme}>
      <div className="ae-shell">
        {/* TOPBAR ROBUSTA COM CLASSES ISOLADAS */}
        <header className="ae-topbar">
          <div className="ae-brand">
            <div className="ae-logo">🗳️</div>
            <div>
              <h1 className="ae-title">Agenda Eleitoral — Pedro Lupion e Sérgio Onofre</h1>
              <div className="ae-subtitle">
                Cronograma operacional da campanha • Arapongas — 2026 • busca, lembretes, contagem regressiva e persistência no navegador.
              </div>
            </div>
          </div>
          <div className="ae-toolbar">
            <button type="button" className="ae-btn ae-btn-ghost" onClick={toggleTheme}>
              {theme === "light" ? "🌙 Modo Escuro" : "☀️ Modo Claro"}
            </button>
            <button
              type="button"
              className="ae-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              ⬆️ Importar JSON
            </button>
            <button type="button" className="ae-btn" onClick={exportJson}>
              ⬇️ Exportar JSON
            </button>
            <button type="button" className="ae-btn" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
            <button type="button" className="ae-btn ae-btn-good" onClick={resetBase}>
              ↺ Restaurar modelo
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

        {/* STATS BAR DE ALTO CONTRASTE */}
        <section className="ae-stats">
          <div className="ae-stat">
            <div className="ae-stat-label">Total de eventos</div>
            <div className="ae-stat-value" style={{ color: "var(--ae-accent)" }}>{stats.total}</div>
            <div className="ae-stat-hint">marcos no calendário</div>
          </div>
          <div className="ae-stat">
            <div className="ae-stat-label">Pendentes</div>
            <div className="ae-stat-value" style={{ color: "var(--ae-warn)" }}>{stats.pending}</div>
            <div className="ae-stat-hint">ainda exigem acompanhamento</div>
          </div>
          <div className="ae-stat">
            <div className="ae-stat-label">Concluídos</div>
            <div className="ae-stat-value" style={{ color: "var(--ae-ok)" }}>{stats.done}</div>
            <div className="ae-stat-hint">marcados como finalizados</div>
          </div>
          <div className="ae-stat">
            <div className="ae-stat-label">Próximo marco</div>
            <div className="ae-stat-value" style={{ color: "var(--ae-text)" }}>
              {stats.nextDays !== null
                ? stats.nextDays < 0
                  ? `Há ${Math.abs(stats.nextDays)} dias`
                  : stats.nextDays === 0
                    ? "Hoje!"
                    : `${stats.nextDays} dia${stats.nextDays === 1 ? "" : "s"}`
                : "Tudo em dia!"}
            </div>
            <div className="ae-stat-hint">
              {stats.next ? `${stats.next.title} • ${dateLabel(stats.next.date)}` : "Nenhum evento pendente"}
            </div>
          </div>
        </section>

        {/* LAYOUT PRINCIPAL */}
        <section className="ae-layout">
          {/* COLUNA ESQUERDA: TABELA & CONTROLES */}
          <div className="ae-grid">
            <article className="ae-card">
              <div className="ae-card-head">
                <div>
                  <h2>Agenda de Compromissos</h2>
                  <div className="ae-footer-note">
                    Use os filtros, marque como concluído, edite eventos e adicione novos marcos eleitorais.
                  </div>
                </div>
                <div className="ae-split">
                  <button
                    type="button"
                    className="ae-btn ae-btn-primary"
                    onClick={() => openModal(null)}
                  >
                    ＋ Novo evento
                  </button>
                </div>
              </div>
              <div className="ae-card-body">
                <div className="ae-controls">
                  <div className="ae-searchwrap">
                    <input
                      className="ae-search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Pesquisar por data, título, categoria, nota..."
                    />
                  </div>
                  <select
                    className="ae-select"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="all">Todas as categorias</option>
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
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendentes</option>
                    <option value="done">Concluídos</option>
                    <option value="important">Importantes</option>
                  </select>
                  <select
                    className="ae-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="dateAsc">Ordenar por data ↑</option>
                    <option value="dateDesc">Ordenar por data ↓</option>
                    <option value="priority">Prioridade</option>
                    <option value="title">Título</option>
                  </select>
                </div>

                <div className="ae-table-wrap">
                  <table className="ae-table">
                    <thead>
                      <tr>
                        <th className="ae-th" style={{ width: "13%" }}>Data</th>
                        <th className="ae-th" style={{ width: "19%" }}>Categoria</th>
                        <th className="ae-th">Título</th>
                        <th className="ae-th" style={{ width: "11%" }}>Contagem</th>
                        <th className="ae-th" style={{ width: "11%" }}>Status</th>
                        <th className="ae-th" style={{ width: "12%" }}>Responsável</th>
                        <th className="ae-th" style={{ width: "11%" }}>Local</th>
                        <th className="ae-th" style={{ width: "13%" }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.length === 0 ? (
                        <tr>
                          <td className="ae-td" colSpan={8}>
                            <div className="ae-empty">Nenhum evento encontrado com esses filtros.</div>
                          </td>
                        </tr>
                      ) : (
                        filteredEvents.map((ev) => {
                          const d = daysUntil(ev.date);
                          return (
                            <tr key={ev.id} className={ev.done ? "ae-row-done" : ""}>
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
                                  {ev.important && <span className="ae-badge ae-badge-danger">★ importante</span>}
                                </div>
                                <div className="ae-footer-note">{ev.desc}</div>
                              </td>
                              <td className="ae-td" data-label="Contagem">
                                {ev.done ? (
                                  <span className="ae-badge ae-badge-ok">✓ concluído</span>
                                ) : d < 0 ? (
                                  <span className="ae-badge ae-badge-danger">atrasado ({Math.abs(d)}d)</span>
                                ) : d === 0 ? (
                                  <span className="ae-badge ae-badge-danger">hoje</span>
                                ) : d <= 7 ? (
                                  <span className="ae-badge ae-badge-danger">{d} dia{d === 1 ? "" : "s"}</span>
                                ) : d <= 30 ? (
                                  <span className="ae-badge ae-badge-warn">{d} dias</span>
                                ) : (
                                  <span className="ae-badge">{d} dias</span>
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
                                    onClick={() => toggleDone(ev.id)}
                                  >
                                    {ev.done ? "↩ Reabrir" : "✓ Concluir"}
                                  </button>
                                  <button
                                    type="button"
                                    className="ae-mini-btn"
                                    onClick={() => openModal(ev)}
                                  >
                                    ✎ Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="ae-mini-btn"
                                    onClick={() => duplicateEvent(ev.id)}
                                  >
                                    ⧉ Copiar
                                  </button>
                                  <button
                                    type="button"
                                    className="ae-mini-btn"
                                    onClick={() => deleteEvent(ev.id)}
                                  >
                                    🗑 Excluir
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

          {/* COLUNA DIREITA: RESUMO RÁPIDO & CALENDÁRIO */}
          <div className="ae-sidebar-panel">
            <article className="ae-card">
              <div className="ae-card-head">
                <div>
                  <h3>Resumo Rápido</h3>
                  <div className="ae-footer-note">Próximos marcos, visão geral e calendário mensal.</div>
                </div>
              </div>
              <div className="ae-card-body ae-sidebar-panel">
                {/* CONTAGEM REGRESSIVA */}
                <div className="ae-card" style={{ background: "var(--ae-card-solid)", borderColor: "var(--ae-line)" }}>
                  <div className="ae-card-body">
                    <div className="ae-countdown">
                      {upcomingCountdowns.map((ev) => {
                        const d = daysUntil(ev.date);
                        return (
                          <div key={ev.id} className="ae-countbox">
                            <div className="ae-countbox-big">
                              {ev.done
                                ? "OK"
                                : d < 0
                                  ? `-${Math.abs(d)}d`
                                  : d === 0
                                    ? "Hoje"
                                    : `${d}d`}
                            </div>
                            <div className="ae-countbox-small">
                              <strong style={{ color: "var(--ae-text)" }}>{ev.title}</strong>
                              <br />
                              {dateLabel(ev.date)} · {ev.category}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* CALENDÁRIO MENSAL */}
                <div className="ae-card" style={{ background: "var(--ae-card-solid)", borderColor: "var(--ae-line)" }}>
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
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="ae-mini-btn"
                            onClick={() =>
                              setFilterMonth(
                                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                              )
                            }
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
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                      <div className="ae-legend">
                        <span className="ae-badge ae-badge-ok">● concluído</span>
                        <span className="ae-badge ae-badge-warn">● pendente</span>
                        <span className="ae-badge ae-badge-danger">● hoje / urgente</span>
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
                                {cell.eventCount} evento{cell.eventCount === 1 ? "" : "s"}
                              </div>
                            ) : (
                              <div className="ae-footer-note">&nbsp;</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* NOTAS E ORIENTAÇÕES */}
                <div className="ae-card" style={{ background: "var(--ae-card-solid)", borderColor: "var(--ae-line)" }}>
                  <div className="ae-card-body">
                    <h3 style={{ marginBottom: "10px" }}>Notas e Orientações</h3>
                    <div className="ae-footer-note">
                      <div>
                        <strong>Agenda pronta para uso offline:</strong> os dados ficam no seu navegador. Você pode editar, importar e exportar sem internet.
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <strong>Observação:</strong> confira sempre o calendário oficial do TSE/TRE-PR para validação final de prazos.
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <strong>Atalhos:</strong> usar busca para localizar temas, marcar concluído, e imprimir para levar ao campo.
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <strong>Conteúdo carregado:</strong> Fase 1 — alinhamento interno; Fase 2 — início da campanha; lançamento oficial; adesivaço; Café da Manhã no Comércio.
                      </div>
                      {upcomingReminders.length > 0 && (
                        <div style={{ marginTop: "10px", color: "var(--ae-warn)" }}>
                          <strong>Eventos próximos:</strong>{" "}
                          {upcomingReminders
                            .map(
                              (e) =>
                                `${e.title} (${daysUntil(e.date)} dia${daysUntil(e.date) === 1 ? "" : "s"})`,
                            )
                            .join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      {/* MODAL DE ADICIONAR / EDITAR EVENTO */}
      {isModalOpen && (
        <div className="ae-modal" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="ae-modal-card">
            <div className="ae-card-head">
              <div>
                <h2>{editingId !== null ? "Editar evento" : "Novo evento"}</h2>
                <div className="ae-footer-note">Os dados ficam salvos localmente no navegador.</div>
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
