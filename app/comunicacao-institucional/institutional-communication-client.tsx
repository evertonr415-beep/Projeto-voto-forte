"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./institutional-communication.css";

const STORAGE_KEY = "pc_dashboard_state_v1";
const THEME_KEY = "pc_dashboard_theme_v1";

export type PriorityItem = {
  title: string;
  body: string;
};

export type AgendaItem = {
  date: string;
  type: string;
  desc: string;
  status: "Pendente" | "Em andamento" | "Confirmado" | "Concluído";
  owner: string;
};

export type TerritoryItem = {
  region: string;
  priority: "Alta" | "Média" | "Baixa";
  demands: string;
};

export type AudienceItem = {
  title: string;
  body: string;
};

export type ContentItem = {
  format: string;
  theme: string;
  objective: string;
  channel: string;
  due: string;
};

export type ComplianceItem = {
  text: string;
  ok: boolean;
};

export type InstitutionalState = {
  overviewGoal: string;
  overviewMessage: string;
  priorities: PriorityItem[];
  agenda: AgendaItem[];
  territory: TerritoryItem[];
  audiences: AudienceItem[];
  contents: ContentItem[];
  compliance: ComplianceItem[];
  cand1Name: string;
  cand1Role: string;
  cand1Bio: string;
  cand1Tone: string;
  cand2Name: string;
  cand2Role: string;
  cand2Bio: string;
  cand2Tone: string;
  msg1: string;
  msg2: string;
  editorNotes: string;
  theme: "dark" | "light";
  lastSaved: string | null;
};

const defaultState: InstitutionalState = {
  overviewGoal:
    "Organizar a comunicação institucional em um único painel visual, com foco em clareza, rotina editorial e prestação de informações ao público.",
  overviewMessage:
    "Mensagem central: presença pública consistente, linguagem acessível e documentação organizada das ações, agendas e conteúdos.",
  priorities: [
    {
      title: "Atualizar biografia e posicionamento",
      body: "Consolidar uma versão curta, uma média e uma longa para site, PDF e redes.",
    },
    {
      title: "Fechar calendário da semana",
      body: "Definir compromissos, publicações e entregas por dia, com responsáveis claros.",
    },
    {
      title: "Revisar conformidade",
      body: "Checar legenda, marcações obrigatórias, fontes e aprovação antes de publicar.",
    },
  ],
  agenda: [
    {
      date: "Seg 08:30",
      type: "Reunião",
      desc: "Alinhamento editorial da semana",
      status: "Em andamento",
      owner: "Coordenação",
    },
    {
      date: "Ter 14:00",
      type: "Conteúdo",
      desc: "Gravação de vídeo curto sobre prioridades",
      status: "Pendente",
      owner: "Comunicação",
    },
    {
      date: "Qua 19:00",
      type: "Território",
      desc: "Agenda pública com lideranças locais",
      status: "Confirmado",
      owner: "Agenda",
    },
  ],
  territory: [
    {
      region: "Núcleo urbano",
      priority: "Alta",
      demands: "Mobilidade, serviços, gestão e comunicação direta",
    },
    {
      region: "Distritos e bairros",
      priority: "Alta",
      demands: "Escuta, presença territorial e prestação de contas",
    },
    {
      region: "Setores produtivos",
      priority: "Média",
      demands: "Agenda econômica, emprego e infraestrutura",
    },
  ],
  audiences: [
    {
      title: "Lideranças locais",
      body: "Mapear interlocutores e manter fluxo de informação contínuo.",
    },
    {
      title: "Jovens e redes sociais",
      body: "Conteúdo objetivo, visual e explicativo, com linguagem simples.",
    },
    {
      title: "Setores organizados",
      body: "Notas técnicas, agenda temática e mensagens de prestação de contas.",
    },
  ],
  contents: [
    {
      format: "Vídeo curto",
      theme: "Resumo semanal",
      objective: "Atualização pública",
      channel: "Instagram / Reels",
      due: "Sex",
    },
    {
      format: "Card",
      theme: "Biografia",
      objective: "Apresentação institucional",
      channel: "Feed",
      due: "Qua",
    },
    {
      format: "Arte estática",
      theme: "Agenda",
      objective: "Divulgação de compromissos",
      channel: "WhatsApp / Feed",
      due: "Seg",
    },
  ],
  compliance: [
    {
      text: "Revisar ortografia, nomes e cargos antes de publicar.",
      ok: true,
    },
    {
      text: "Checar uso de imagem e autorização de terceiros.",
      ok: false,
    },
    {
      text: "Validar fontes e números citados em peças.",
      ok: true,
    },
    {
      text: "Garantir que a peça esteja coerente com a identidade visual.",
      ok: true,
    },
  ],
  cand1Name: "Deputado Estadual",
  cand1Role: "Mandato / comunicação pública",
  cand1Bio: "Espaço para biografia resumida, trajetória pública e foco de atuação.",
  cand1Tone: "Clareza, proximidade e linguagem objetiva.",
  cand2Name: "Deputado Federal",
  cand2Role: "Mandato / articulação nacional",
  cand2Bio: "Espaço para biografia resumida, atuação parlamentar e prioridades de agenda.",
  cand2Tone: "Institucional, técnico e acessível.",
  msg1: "A comunicação deve priorizar informação útil, transparência e organização de agenda, com texto simples e consistente.",
  msg2: "Cada peça precisa responder: o que aconteceu, por que importa e como o público acompanha a próxima etapa.",
  editorNotes: "• Revisar dados da próxima reunião\n• Ajustar textos de abertura\n• Subir imagens aprovadas\n• Preparar pacote semanal",
  theme: "dark",
  lastSaved: null,
};

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function fmtTag(value: string) {
  const map: Record<string, string> = {
    Alta: "red",
    Média: "orange",
    Baixa: "green",
    Confirmado: "green",
    Pendente: "orange",
    "Em andamento": "blue",
    Concluído: "green",
  };
  const cls = map[value] || "blue";
  return <span className={`pc-tag ${cls}`}>{value}</span>;
}

export default function InstitutionalCommunicationClient({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const [state, setState] = useState<InstitutionalState>(defaultState);
  const [activeTab, setActiveTab] = useState<
    "visao" | "perfil" | "agenda" | "territorio" | "conteudo" | "compliance" | "exportacao"
  >("visao");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const savedTheme = (localStorage.getItem(THEME_KEY) as "dark" | "light") || "dark";
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...clone(defaultState), ...parsed, theme: savedTheme });
      } else {
        setState((prev) => ({ ...prev, theme: savedTheme }));
      }
    } catch {
      // Fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveToStorage = useCallback((nextState: InstitutionalState) => {
    const timestamp = new Date().toLocaleString("pt-BR");
    const updated = { ...nextState, lastSaved: timestamp };
    setState(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(THEME_KEY, updated.theme);
    } catch {}
  }, []);

  const updateField = useCallback(
    <K extends keyof InstitutionalState>(field: K, value: InstitutionalState[K]) => {
      setState((prev) => {
        const next = { ...prev, [field]: value };
        saveToStorage(next);
        return next;
      });
    },
    [saveToStorage],
  );

  const toggleTheme = useCallback(() => {
    setState((prev) => {
      const nextTheme = prev.theme === "light" ? "dark" : "light";
      const next = { ...prev, theme: nextTheme };
      saveToStorage(next);
      return next;
    });
  }, [saveToStorage]);

  const resetToDefault = useCallback(() => {
    if (window.confirm("Deseja restaurar os dados de exemplo originais do painel institucional?")) {
      saveToStorage(clone(defaultState));
    }
  }, [saveToStorage]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "painel-comunicacao-institucional.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const pendingAlertsCount = useMemo(
    () => state.compliance.filter((c) => !c.ok).length,
    [state.compliance],
  );

  // Handlers de Prioridades
  const addPriority = () => {
    updateField("priorities", [
      ...state.priorities,
      { title: "Nova prioridade", body: "Descreva aqui a prioridade operacional." },
    ]);
  };
  const removePriority = (index: number) => {
    updateField(
      "priorities",
      state.priorities.filter((_, i) => i !== index),
    );
  };
  const editPriority = (index: number, key: keyof PriorityItem, val: string) => {
    const next = [...state.priorities];
    next[index] = { ...next[index], [key]: val };
    updateField("priorities", next);
  };

  // Handlers de Agenda
  const addAgendaItem = () => {
    updateField("agenda", [
      ...state.agenda,
      { date: "Nova data", type: "Atividade", desc: "Descreva a nova agenda", status: "Pendente", owner: "Equipe" },
    ]);
  };
  const removeAgendaItem = (index: number) => {
    updateField(
      "agenda",
      state.agenda.filter((_, i) => i !== index),
    );
  };
  const editAgendaItem = (index: number, key: keyof AgendaItem, val: string) => {
    const next = [...state.agenda];
    next[index] = { ...next[index], [key]: val };
    updateField("agenda", next);
  };

  // Handlers de Território
  const addTerritoryItem = () => {
    updateField("territory", [
      ...state.territory,
      { region: "Nova região", priority: "Alta", demands: "Descreva as demandas" },
    ]);
  };
  const removeTerritoryItem = (index: number) => {
    updateField(
      "territory",
      state.territory.filter((_, i) => i !== index),
    );
  };
  const editTerritoryItem = (index: number, key: keyof TerritoryItem, val: string) => {
    const next = [...state.territory];
    next[index] = { ...next[index], [key]: val };
    updateField("territory", next);
  };

  // Handlers de Audiência
  const addAudienceItem = () => {
    updateField("audiences", [
      ...state.audiences,
      { title: "Novo segmento", body: "Descreva o público ou interlocutor." },
    ]);
  };
  const removeAudienceItem = (index: number) => {
    updateField(
      "audiences",
      state.audiences.filter((_, i) => i !== index),
    );
  };
  const editAudienceItem = (index: number, key: keyof AudienceItem, val: string) => {
    const next = [...state.audiences];
    next[index] = { ...next[index], [key]: val };
    updateField("audiences", next);
  };

  // Handlers de Conteúdo
  const addContentItem = () => {
    updateField("contents", [
      ...state.contents,
      { format: "Novo formato", theme: "Tema", objective: "Objetivo", channel: "Canal", due: "Prazo" },
    ]);
  };
  const removeContentItem = (index: number) => {
    updateField(
      "contents",
      state.contents.filter((_, i) => i !== index),
    );
  };
  const editContentItem = (index: number, key: keyof ContentItem, val: string) => {
    const next = [...state.contents];
    next[index] = { ...next[index], [key]: val };
    updateField("contents", next);
  };

  // Handlers de Compliance
  const addComplianceItem = () => {
    updateField("compliance", [
      ...state.compliance,
      { text: "Novo item de revisão", ok: false },
    ]);
  };
  const toggleComplianceItem = (index: number) => {
    const next = [...state.compliance];
    next[index] = { ...next[index], ok: !next[index].ok };
    updateField("compliance", next);
  };
  const removeComplianceItem = (index: number) => {
    updateField(
      "compliance",
      state.compliance.filter((_, i) => i !== index),
    );
  };
  const editComplianceItem = (index: number, val: string) => {
    const next = [...state.compliance];
    next[index] = { ...next[index], text: val };
    updateField("compliance", next);
  };

  if (!isLoaded) {
    return (
      <div className="pc-app-wrapper" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--pc-muted)" }}>Carregando Painel de Comunicação Institucional…</p>
      </div>
    );
  }

  return (
    <div
      className={`pc-app-wrapper ${embedded ? "embedded" : ""} ${state.theme === "light" ? "pc-theme-light" : ""}`}
      data-pc-theme={state.theme}
    >
      <div className={`pc-shell ${embedded ? "embedded" : ""}`}>
        {/* TOPBAR */}
        <header className="pc-topbar">
          <div className="pc-brand">
            <div className="pc-logo">PC</div>
            <div>
              <h1>Painel de Comunicação Institucional</h1>
              <p>Organização de conteúdo, agenda, território e conformidade — visualização local.</p>
            </div>
          </div>
          <div className="pc-top-actions">
            <span className="pc-chip">
              ● {state.lastSaved ? "salvo localmente" : "pronto para edição"}
            </span>
            <button type="button" className="pc-btn ghost" onClick={toggleTheme}>
              Alternar tema
            </button>
            <button type="button" className="pc-btn" onClick={exportJson}>
              Exportar JSON
            </button>
            <button type="button" className="pc-btn success" onClick={resetToDefault}>
              Restaurar exemplo
            </button>
            {!embedded && (
              <Link href="/contatos" className="pc-btn primary">
                Sair
              </Link>
            )}
          </div>
        </header>

        {/* LAYOUT PRINCIPAL */}
        <div className="pc-layout">
          {/* SIDEBAR COM AS 7 SEÇÕES */}
          <aside className="pc-sidebar">
            <div className="pc-nav-title">
              <strong>Seções</strong>
              <span>7 blocos</span>
            </div>
            <nav className="pc-nav">
              <button
                type="button"
                className={`pc-tab ${activeTab === "visao" ? "active" : ""}`}
                onClick={() => setActiveTab("visao")}
              >
                Visão Geral
              </button>
              <button
                type="button"
                className={`pc-tab ${activeTab === "perfil" ? "active" : ""}`}
                onClick={() => setActiveTab("perfil")}
              >
                Perfil & Posicionamento
              </button>
              <button
                type="button"
                className={`pc-tab ${activeTab === "agenda" ? "active" : ""}`}
                onClick={() => setActiveTab("agenda")}
              >
                Agenda & Entregas
              </button>
              <button
                type="button"
                className={`pc-tab ${activeTab === "territorio" ? "active" : ""}`}
                onClick={() => setActiveTab("territorio")}
              >
                Território & Público
              </button>
              <button
                type="button"
                className={`pc-tab ${activeTab === "conteudo" ? "active" : ""}`}
                onClick={() => setActiveTab("conteudo")}
              >
                Conteúdo & Peças
              </button>
              <button
                type="button"
                className={`pc-tab ${activeTab === "compliance" ? "active" : ""}`}
                onClick={() => setActiveTab("compliance")}
              >
                Compliance
              </button>
              <button
                type="button"
                className={`pc-tab ${activeTab === "exportacao" ? "active" : ""}`}
                onClick={() => setActiveTab("exportacao")}
              >
                Exportação
              </button>
            </nav>
            <div className="note">
              <strong>Observação</strong>
              <br />
              Este layout foi desenhado como uma <em>base institucional</em>: ele organiza comunicação pública, não textos persuasivos específicos. Você pode adaptar os campos para biografia, prestação de contas, agenda e temas de interesse público.
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="pc-main">
            {/* 1. VISÃO GERAL */}
            {activeTab === "visao" && (
              <section>
                <div className="pc-hero">
                  <div className="pc-hero-banner">
                    <div className="pc-status">
                      <span className="dot" /> painel salvo localmente · pronto para edição
                    </div>
                    <h2>Comunicação clara, moderna e orientada a informação pública</h2>
                    <p>
                      Organize a presença digital em um único lugar: identidade, prioridades, agenda, peças de conteúdo,
                      cobertura territorial e checklist de conformidade. O painel foi pensado para visualizar a estrutura
                      do projeto antes de avançar para desenvolvimento real.
                    </p>
                    <div className="pc-hero-kpis">
                      <div className="pc-kpi">
                        <strong>2</strong>
                        <span>mandatos / frentes de atuação</span>
                      </div>
                      <div className="pc-kpi">
                        <strong>{state.agenda.length}</strong>
                        <span>itens de agenda desta semana</span>
                      </div>
                      <div className="pc-kpi">
                        <strong>{state.compliance.length}</strong>
                        <span>checagens de conformidade</span>
                      </div>
                    </div>
                  </div>
                  <div className="pc-hero-side">
                    <div className="pc-mini-stat">
                      <div className="label">Status do workspace</div>
                      <div className="value">Ativo e offline</div>
                    </div>
                    <div className="pc-mini-stat">
                      <div className="label">Último salvamento</div>
                      <div className="value">{state.lastSaved || "—"}</div>
                    </div>
                    <div className="pc-mini-stat">
                      <div className="label">Modo visual</div>
                      <div className="value">{state.theme === "light" ? "Claro" : "Escuro"}</div>
                    </div>
                  </div>
                </div>

                <div className="pc-grid-3">
                  <div className="pc-card">
                    <h4>Resumo estratégico</h4>
                    <div className="pc-field">
                      <label>Objetivo editorial</label>
                      <textarea
                        value={state.overviewGoal}
                        onChange={(e) => updateField("overviewGoal", e.target.value)}
                      />
                    </div>
                    <div className="pc-field">
                      <label>Mensagem central</label>
                      <textarea
                        value={state.overviewMessage}
                        onChange={(e) => updateField("overviewMessage", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pc-card">
                    <h4>Prioridades do período</h4>
                    <div className="pc-list">
                      {state.priorities.map((item, i) => (
                        <div key={i} className="pc-list-item">
                          <div style={{ flex: 1 }}>
                            <strong>
                              <input
                                value={item.title}
                                onChange={(e) => editPriority(i, "title", e.target.value)}
                                style={{
                                  width: "100%",
                                  font: "inherit",
                                  fontWeight: 800,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  color: "inherit",
                                  padding: 0,
                                  margin: "0 0 4px",
                                }}
                              />
                            </strong>
                            <p>
                              <textarea
                                value={item.body}
                                onChange={(e) => editPriority(i, "body", e.target.value)}
                                style={{
                                  width: "100%",
                                  minHeight: "58px",
                                  font: "inherit",
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  color: "var(--pc-muted)",
                                  resize: "vertical",
                                  padding: 0,
                                }}
                              />
                            </p>
                          </div>
                          <button
                            type="button"
                            className="pc-btn"
                            onClick={() => removePriority(i)}
                            style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="pc-btn"
                      style={{ marginTop: "12px" }}
                      onClick={addPriority}
                    >
                      + Nova prioridade
                    </button>
                  </div>

                  <div className="pc-card">
                    <h4>Ritmo da operação</h4>
                    <div className="pc-mini-stat">
                      <div className="label">Peças programadas</div>
                      <div className="value">{state.contents.length}</div>
                    </div>
                    <div className="pc-mini-stat" style={{ marginTop: "10px" }}>
                      <div className="label">Pautas em andamento</div>
                      <div className="value">{state.agenda.length}</div>
                    </div>
                    <div className="pc-mini-stat" style={{ marginTop: "10px" }}>
                      <div className="label">Alertas pendentes</div>
                      <div className="value">{pendingAlertsCount}</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 2. PERFIL & POSICIONAMENTO */}
            {activeTab === "perfil" && (
              <section>
                <div className="pc-section">
                  <div className="pc-section-head">
                    <div>
                      <h3>Perfil e posicionamento</h3>
                      <p>Campos para organizar biografia, atuação, tom e assinatura pública.</p>
                    </div>
                    <div className="meta">Editable localmente</div>
                  </div>
                  <div className="pc-profile-grid">
                    <div className="pc-card">
                      <h4>Frente 1 · Candidato(a) / mandato</h4>
                      <div className="pc-field">
                        <label>Nome de exibição</label>
                        <input
                          value={state.cand1Name}
                          onChange={(e) => updateField("cand1Name", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Esfera / cargo</label>
                        <input
                          value={state.cand1Role}
                          onChange={(e) => updateField("cand1Role", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Biografia resumida</label>
                        <textarea
                          value={state.cand1Bio}
                          onChange={(e) => updateField("cand1Bio", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Tom de comunicação</label>
                        <input
                          value={state.cand1Tone}
                          onChange={(e) => updateField("cand1Tone", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="pc-card">
                      <h4>Frente 2 · Candidato(a) / mandato</h4>
                      <div className="pc-field">
                        <label>Nome de exibição</label>
                        <input
                          value={state.cand2Name}
                          onChange={(e) => updateField("cand2Name", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Esfera / cargo</label>
                        <input
                          value={state.cand2Role}
                          onChange={(e) => updateField("cand2Role", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Biografia resumida</label>
                        <textarea
                          value={state.cand2Bio}
                          onChange={(e) => updateField("cand2Bio", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Tom de comunicação</label>
                        <input
                          value={state.cand2Tone}
                          onChange={(e) => updateField("cand2Tone", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pc-section" style={{ marginTop: "14px" }}>
                    <div className="pc-section-head">
                      <div>
                        <h3>Mensagens-chave</h3>
                        <p>Texto-base institucional, sem apelo persuasivo direcionado.</p>
                      </div>
                      <div className="meta">Use para site, PDF e redes</div>
                    </div>
                    <div className="pc-grid-2">
                      <div className="pc-field">
                        <label>Mensagem 1</label>
                        <textarea
                          value={state.msg1}
                          onChange={(e) => updateField("msg1", e.target.value)}
                        />
                      </div>
                      <div className="pc-field">
                        <label>Mensagem 2</label>
                        <textarea
                          value={state.msg2}
                          onChange={(e) => updateField("msg2", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 3. AGENDA & ENTREGAS */}
            {activeTab === "agenda" && (
              <section>
                <div className="pc-section">
                  <div className="pc-section-head">
                    <div>
                      <h3>Agenda & entregas</h3>
                      <p>Planejamento semanal de ações, publicações, compromissos e entregas editoriais.</p>
                    </div>
                    <div className="meta">Clique para adicionar itens no navegador</div>
                  </div>
                  <div className="pc-controls" style={{ marginBottom: "12px" }}>
                    <button type="button" className="pc-btn" onClick={addAgendaItem}>
                      + Nova agenda
                    </button>
                  </div>
                  <div className="pc-table-wrap">
                    <table className="pc-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Descrição</th>
                          <th>Status</th>
                          <th>Responsável</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.agenda.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                value={row.date}
                                onChange={(e) => editAgendaItem(i, "date", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <input
                                value={row.type}
                                onChange={(e) => editAgendaItem(i, "type", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <textarea
                                value={row.desc}
                                onChange={(e) => editAgendaItem(i, "desc", e.target.value)}
                                style={{ width: "100%", minHeight: "52px", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none", resize: "vertical" }}
                              />
                            </td>
                            <td>
                              <select
                                value={row.status}
                                onChange={(e) => editAgendaItem(i, "status", e.target.value as AgendaItem["status"])}
                                style={{ padding: "6px" }}
                              >
                                {["Pendente", "Em andamento", "Confirmado", "Concluído"].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                value={row.owner}
                                onChange={(e) => editAgendaItem(i, "owner", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="pc-btn"
                                onClick={() => removeAgendaItem(i)}
                                style={{ padding: "4px 8px", fontSize: "0.75rem", background: "rgba(255,107,139,0.15)", color: "#ff8ca3", borderColor: "rgba(255,107,139,0.3)" }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* 4. TERRITÓRIO & PÚBLICO */}
            {activeTab === "territorio" && (
              <section>
                <div className="pc-grid-2">
                  <div className="pc-section">
                    <div className="pc-section-head">
                      <div>
                        <h3>Território e público</h3>
                        <p>Mapa qualitativo de prioridades, regiões e grupos de interesse.</p>
                      </div>
                      <div className="meta">Visão macro</div>
                    </div>
                    <div className="pc-table-wrap">
                      <table className="pc-table">
                        <thead>
                          <tr>
                            <th>Região</th>
                            <th>Prioridade</th>
                            <th>Demandas</th>
                            <th style={{ width: "40px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.territory.map((row, i) => (
                            <tr key={i}>
                              <td>
                                <input
                                  value={row.region}
                                  onChange={(e) => editTerritoryItem(i, "region", e.target.value)}
                                  style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                                />
                              </td>
                              <td>
                                <select
                                  value={row.priority}
                                  onChange={(e) => editTerritoryItem(i, "priority", e.target.value as TerritoryItem["priority"])}
                                  style={{ padding: "6px" }}
                                >
                                  {["Alta", "Média", "Baixa"].map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <textarea
                                  value={row.demands}
                                  onChange={(e) => editTerritoryItem(i, "demands", e.target.value)}
                                  style={{ width: "100%", minHeight: "52px", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none", resize: "vertical" }}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="pc-btn"
                                  onClick={() => removeTerritoryItem(i)}
                                  style={{ padding: "4px 8px", fontSize: "0.75rem", background: "rgba(255,107,139,0.15)", color: "#ff8ca3", borderColor: "rgba(255,107,139,0.3)" }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pc-section">
                    <div className="pc-section-head">
                      <div>
                        <h3>Segmentos de atenção</h3>
                        <p>Organização por temas, setores e interlocutores públicos.</p>
                      </div>
                      <div className="meta">Atualização rápida</div>
                    </div>
                    <div className="pc-list">
                      {state.audiences.map((item, i) => (
                        <div key={i} className="pc-list-item">
                          <div style={{ flex: 1 }}>
                            <strong>
                              <input
                                value={item.title}
                                onChange={(e) => editAudienceItem(i, "title", e.target.value)}
                                style={{
                                  width: "100%",
                                  font: "inherit",
                                  fontWeight: 800,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  color: "inherit",
                                  padding: 0,
                                  margin: "0 0 4px",
                                }}
                              />
                            </strong>
                            <p>
                              <textarea
                                value={item.body}
                                onChange={(e) => editAudienceItem(i, "body", e.target.value)}
                                style={{
                                  width: "100%",
                                  minHeight: "58px",
                                  font: "inherit",
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  color: "var(--pc-muted)",
                                  resize: "vertical",
                                  padding: 0,
                                }}
                              />
                            </p>
                          </div>
                          <button
                            type="button"
                            className="pc-btn"
                            onClick={() => removeAudienceItem(i)}
                            style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="pc-btn"
                      style={{ marginTop: "12px" }}
                      onClick={addAudienceItem}
                    >
                      + Novo segmento
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* 5. CONTEÚDO & PEÇAS */}
            {activeTab === "conteudo" && (
              <section>
                <div className="pc-section">
                  <div className="pc-section-head">
                    <div>
                      <h3>Conteúdo & peças</h3>
                      <p>Calendário, formatos, temas e publicações em produção.</p>
                    </div>
                    <div className="meta">Editor rápido</div>
                  </div>
                  <div className="pc-controls" style={{ marginBottom: "12px" }}>
                    <button type="button" className="pc-btn" onClick={addContentItem}>
                      + Nova peça
                    </button>
                  </div>
                  <div className="pc-table-wrap">
                    <table className="pc-table">
                      <thead>
                        <tr>
                          <th>Formato</th>
                          <th>Tema</th>
                          <th>Objetivo</th>
                          <th>Canal</th>
                          <th>Prazo</th>
                          <th style={{ width: "40px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.contents.map((row, i) => (
                          <tr key={i}>
                            <td>
                              <input
                                value={row.format}
                                onChange={(e) => editContentItem(i, "format", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <input
                                value={row.theme}
                                onChange={(e) => editContentItem(i, "theme", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <input
                                value={row.objective}
                                onChange={(e) => editContentItem(i, "objective", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <input
                                value={row.channel}
                                onChange={(e) => editContentItem(i, "channel", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <input
                                value={row.due}
                                onChange={(e) => editContentItem(i, "due", e.target.value)}
                                style={{ width: "100%", font: "inherit", background: "transparent", border: "none", color: "inherit", outline: "none" }}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="pc-btn"
                                onClick={() => removeContentItem(i)}
                                style={{ padding: "4px 8px", fontSize: "0.75rem", background: "rgba(255,107,139,0.15)", color: "#ff8ca3", borderColor: "rgba(255,107,139,0.3)" }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* 6. COMPLIANCE */}
            {activeTab === "compliance" && (
              <section>
                <div className="pc-grid-2">
                  <div className="pc-section">
                    <div className="pc-section-head">
                      <div>
                        <h3>Checklist de conformidade</h3>
                        <p>Itens mínimos para revisão antes de publicar.</p>
                      </div>
                      <div className="meta">Marque o que estiver ok</div>
                    </div>
                    <div className="pc-list">
                      {state.compliance.map((item, i) => (
                        <div key={i} className="pc-list-item">
                          <div style={{ flex: 1 }}>
                            <strong>
                              <input
                                value={item.text}
                                onChange={(e) => editComplianceItem(i, e.target.value)}
                                style={{
                                  width: "100%",
                                  font: "inherit",
                                  fontWeight: 800,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  color: "inherit",
                                  padding: 0,
                                  margin: "0 0 4px",
                                }}
                              />
                            </strong>
                            <p>
                              Marcação:{" "}
                              {item.ok ? (
                                <span className="pc-tag green">ok</span>
                              ) : (
                                <span className="pc-tag orange">pendente</span>
                              )}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="pc-btn"
                              onClick={() => toggleComplianceItem(i)}
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
                              {item.ok ? "Desmarcar" : "Marcar ok"}
                            </button>
                            <button
                              type="button"
                              className="pc-btn"
                              onClick={() => removeComplianceItem(i)}
                              style={{ padding: "6px 8px", fontSize: "0.75rem", background: "rgba(255,107,139,0.15)", color: "#ff8ca3", borderColor: "rgba(255,107,139,0.3)" }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="pc-btn"
                      style={{ marginTop: "12px" }}
                      onClick={addComplianceItem}
                    >
                      + Novo item
                    </button>
                  </div>

                  <div className="pc-section">
                    <div className="pc-section-head">
                      <div>
                        <h3>Anotações editoriais</h3>
                        <p>Espaço para observações, ajustes e pendências da equipe.</p>
                      </div>
                      <div className="meta">Notas locais</div>
                    </div>
                    <div className="pc-field">
                      <label>Notas gerais</label>
                      <textarea
                        value={state.editorNotes}
                        onChange={(e) => updateField("editorNotes", e.target.value)}
                        style={{ minHeight: "360px" }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 7. EXPORTAÇÃO */}
            {activeTab === "exportacao" && (
              <section>
                <div className="pc-grid-2">
                  <div className="pc-section">
                    <div className="pc-section-head">
                      <div>
                        <h3>Exportação e backup</h3>
                        <p>Baixe os dados do painel e salve uma cópia da configuração atual.</p>
                      </div>
                      <div className="meta">Compatível com JSON</div>
                    </div>
                    <div className="pc-field">
                      <label>JSON do estado atual</label>
                      <textarea
                        value={JSON.stringify(state, null, 2)}
                        readOnly
                        style={{ minHeight: "360px", fontFamily: "monospace", fontSize: "0.82rem" }}
                      />
                    </div>
                  </div>

                  <div className="pc-section">
                    <div className="pc-section-head">
                      <div>
                        <h3>Ações rápidas</h3>
                        <p>Exportar, restaurar, alternar tema e reiniciar estado.</p>
                      </div>
                      <div className="meta">Fluxo simples</div>
                    </div>
                    <div className="pc-list">
                      <div className="pc-list-item">
                        <div>
                          <strong>Exportar JSON</strong>
                          <p>Baixa uma cópia completa do conteúdo do painel.</p>
                        </div>
                        <button type="button" className="pc-btn" onClick={exportJson}>
                          Baixar
                        </button>
                      </div>
                      <div className="pc-list-item">
                        <div>
                          <strong>Restaurar exemplo</strong>
                          <p>Recarrega os dados de demonstração originais.</p>
                        </div>
                        <button type="button" className="pc-btn" onClick={resetToDefault}>
                          Resetar
                        </button>
                      </div>
                      <div className="pc-list-item">
                        <div>
                          <strong>Trocar tema</strong>
                          <p>Alterna entre modo escuro e claro.</p>
                        </div>
                        <button type="button" className="pc-btn" onClick={toggleTheme}>
                          Alternar
                        </button>
                      </div>
                    </div>
                    <div className="pc-footer-note">
                      <strong>Nota de uso:</strong> este painel organiza comunicação pública, agenda, territórios e conformidade de forma estruturada e 100% offline.
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
