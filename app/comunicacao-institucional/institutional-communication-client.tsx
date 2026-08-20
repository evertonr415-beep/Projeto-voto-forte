"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./institutional-communication.css";

const STORAGE_KEY = "pc_dashboard_state_v2";
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
    "Consolidar a comunicação institucional e estratégica do mandato em Arapongas e no Norte do Paraná, com foco em prestação de contas, proximidade com a população, transparência de recursos públicos e fortalecimento das lideranças municipais.",
  overviewMessage:
    "Compromisso permanente com o desenvolvimento de Arapongas: valorização do polo moveleiro, investimentos contínuos na saúde regional (Honpar), segurança pública preventiva e infraestrutura urbana de qualidade para todos os bairros.",
  priorities: [
    {
      title: "Articulação de Recursos para o Hospital Honpar",
      body: "Acompanhar a liberação de R$ 8,5 milhões em emendas de custeio e novos leitos de UTI para atender Arapongas e mais 21 municípios da macrorregião Norte.",
    },
    {
      title: "Plano de Modernização e Apoio ao Polo Moveleiro",
      body: "Estruturar junto ao SIMA (Sindicato das Indústrias Moveleiras) e SENAI o programa de capacitação técnica, incentivos fiscais e escoamento logístico na PR-444.",
    },
    {
      title: "Giro nos Bairros e Escuta Popular (Arapongas Ativa)",
      body: "Intensificar a presença nos distritos de Aricanduva, Flamingos, Petrópolis e San Raphael para mapear demandas de recape asfáltico, drenagem e iluminação pública LED.",
    },
    {
      title: "Segurança Pública e Iluminação nos Bairros",
      body: "Fiscalizar o plano de expansão do videomonitoramento inteligente (Muralha Digital) integrado com as forças policiais e Guarda Municipal de Arapongas.",
    },
    {
      title: "Comunicação e Prestação de Contas Digital",
      body: "Publicar quinzenalmente o boletim oficial de ações e projetos votados na Assembleia Legislativa e na Câmara dos Deputados com linguagem clara e acessível.",
    },
  ],
  agenda: [
    {
      date: "Seg 08:00",
      type: "Reunião de Gabinete",
      desc: "Alinhamento semanal com a coordenação política, assessoria de imprensa e líderes comunitários de Arapongas.",
      status: "Concluído",
      owner: "Coordenação Geral",
    },
    {
      date: "Seg 14:30",
      type: "Gravação & Mídia",
      desc: "Gravação do podcast e vídeos informativos sobre as novas conquistas para a saúde e educação de Arapongas.",
      status: "Concluído",
      owner: "Equipe de Comunicação",
    },
    {
      date: "Ter 09:30",
      type: "Visita Técnica",
      desc: "Vistoria técnica nas obras de pavimentação asfáltica e drenagem nos bairros Flamingos e Jardim Petrópolis.",
      status: "Em andamento",
      owner: "Engenharia & Gabinete",
    },
    {
      date: "Ter 16:00",
      type: "Setor Produtivo",
      desc: "Reunião executiva na sede do SIMA com empresários do setor moveleiro e representantes da ACIA.",
      status: "Confirmado",
      owner: "Desenvolvimento Regional",
    },
    {
      date: "Qua 10:00",
      type: "Sessão Plenária",
      desc: "Votação em plenário do projeto de lei de apoio à inovação tecnológica industrial e incentivos ao Norte do Paraná.",
      status: "Confirmado",
      owner: "Assessoria Parlamentar",
    },
    {
      date: "Qua 19:30",
      type: "Plenária Comunitária",
      desc: "Encontro aberto com presidentes de associações de moradores e lideranças de bairros no Centro Social.",
      status: "Confirmado",
      owner: "Mobilização Popular",
    },
    {
      date: "Qui 08:30",
      type: "Entrevista de Rádio",
      desc: "Entrevista ao vivo na Rádio Arapongas e emissoras do Vale do Ivaí prestando contas das ações do mandato.",
      status: "Confirmado",
      owner: "Assessoria de Imprensa",
    },
    {
      date: "Qui 15:00",
      type: "Fiscalização",
      desc: "Visita ao canteiro de obras da nova Unidade Básica de Saúde (UBS) do Jardim Aeroporto.",
      status: "Pendente",
      owner: "Comissão de Saúde",
    },
    {
      date: "Sex 10:30",
      type: "Articulação Federal",
      desc: "Videoconferência com ministérios e secretarias estaduais para liberação de convênios de infraestrutura urbana.",
      status: "Pendente",
      owner: "Relações Institucionais",
    },
    {
      date: "Sex 17:00",
      type: "Relatório de Gestão",
      desc: "Fechamento e aprovação do boletim informativo quinzenal para envio por WhatsApp e listas de transmissão.",
      status: "Pendente",
      owner: "Comunicação Digital",
    },
    {
      date: "Sáb 09:00",
      type: "Ação de Campo",
      desc: "Caminhada e conversa com comerciantes, feirantes e moradores no Distrito de Aricanduva e feira do Centro.",
      status: "Confirmado",
      owner: "Equipe de Campo",
    },
  ],
  territory: [
    {
      region: "Núcleo Urbano & Centro Comercial",
      priority: "Alta",
      demands: "Revitalização do calçadão, segurança noturna reforçada, estacionamento rotativo moderno e apoio ao comércio lojista.",
    },
    {
      region: "Conjunto Flamingos & San Raphael",
      priority: "Alta",
      demands: "Ampliação dos horários de atendimento do posto de saúde, pavimentação das vias coletoras e reforma de praças esportivas.",
    },
    {
      region: "Vila Aparecida & Jardim Petrópolis",
      priority: "Alta",
      demands: "Obras de drenagem pluvial, regularização fundiária urbana, iluminação LED e policiamento preventivo nas escolas.",
    },
    {
      region: "Parque Industrial I, II, III & Polo Moveleiro",
      priority: "Alta",
      demands: "Melhorias nos acessos à PR-444, cursos técnicos gratuitos SENAI/SENAC, internet fibra rápida e incentivos fiscais.",
    },
    {
      region: "Distrito de Aricanduva & Zona Rural",
      priority: "Média",
      demands: "Patrulha rural ativa, cascalhamento de estradas vicinais, pontes seguras, transporte escolar eficiente e apoio aos produtores rurais.",
    },
    {
      region: "Jardim Aeroporto & Região Sul",
      priority: "Média",
      demands: "Aceleração da construção da nova UBS, linhas de ônibus circulares integradas e creches em período integral.",
    },
    {
      region: "Jardim Panorama & Interlagos",
      priority: "Média",
      demands: "Recape asfáltico completo, instalação de academia ao ar livre e ampliação de vagas nos centros de educação infantil.",
    },
  ],
  audiences: [
    {
      title: "Lideranças Comunitárias & Presidentes de Bairro",
      body: "Mapeamento permanente de mais de 80 líderes comunitários de Arapongas com canal de escuta ágil para encaminhamento de solicitações e fiscalização de obras.",
    },
    {
      title: "Setor Moveleiro, Comércio & Empresários (ACIA / SIMA)",
      body: "Diálogo mensal com industriais e comerciantes para defender pautas de desoneração, crédito produtivo e valorização do principal polo moveleiro do estado.",
    },
    {
      title: "Profissionais da Saúde & Servidores Públicos",
      body: "Apoio contínuo às equipes médicas do Honpar e postos de saúde, valorização das carreiras da enfermagem, professores e agentes comunitários.",
    },
    {
      title: "Juventude, Universitários & Primeiro Emprego",
      body: "Programas de incentivo a bolsas de estudo, hubs de tecnologia regional, qualificação em inteligência artificial e apoio a eventos esportivos e culturais.",
    },
    {
      title: "Terceira Idade & Aposentados",
      body: "Fortalecimento dos Centros de Convivência dos Idosos (CCI), oficinas de saúde preventiva, hidroginástica gratuita e mobilidade com calçadas acessíveis.",
    },
    {
      title: "Agricultores Familiares & Produtores Rurais",
      body: "Apoio à feira do produtor rural, cooperativismo, fornecimento de calcário, maquinário agrícola compartilhado e segurança no campo.",
    },
  ],
  contents: [
    {
      format: "Carrossel Informativo",
      theme: "Saúde Regional: Conquistas do Honpar",
      objective: "Apresentar prestação de contas com gráficos dos novos leitos e recursos federais/estaduais destinados a Arapongas.",
      channel: "Instagram / Facebook / WhatsApp",
      due: "Segunda",
    },
    {
      format: "Vídeo Curto (Reels / TikTok)",
      theme: "Giro nos Bairros: Obras no Flamingos",
      objective: "Mostrar o andamento do recapeamento asfáltico e ouvir depoimentos de moradores e comerciantes locais.",
      channel: "Reels / TikTok / Shorts",
      due: "Terça",
    },
    {
      format: "Card de Posicionamento",
      theme: "Votação na Assembleia: Incentivo ao Moveleiro",
      objective: "Explicar como o projeto de lei aprovado protege os empregos e a competitividade das indústrias de Arapongas.",
      channel: "Instagram / LinkedIn / X",
      due: "Quarta",
    },
    {
      format: "Infográfico em PDF",
      theme: "Relatório de Gestão Semestral",
      objective: "Documento oficial completo para download com todas as emendas, projetos e atendimentos realizados no período.",
      channel: "WhatsApp Listas / Site Oficial",
      due: "Quinta",
    },
    {
      format: "Vídeo Depoimento",
      theme: "A Força do Trabalhador de Arapongas",
      objective: "Série documental valorizando os operários, marceneiros e costureiras da indústria moveleira da nossa cidade.",
      channel: "YouTube / Instagram / Facebook",
      due: "Sexta",
    },
    {
      format: "Boletim de Áudio (Podcast)",
      theme: "Giro de Notícias do Norte do Paraná",
      objective: "Resumo em áudio de 3 minutos enviado diretamente para rádios comunitárias e lideranças do interior.",
      channel: "WhatsApp Broadcast / Rádio",
      due: "Sábado",
    },
    {
      format: "Stories com Enquete",
      theme: "Você Decide: Prioridades para 2027",
      objective: "Enquete interativa para a população votar nas áreas prioritárias de investimento no seu bairro.",
      channel: "Instagram Stories",
      due: "Domingo",
    },
  ],
  compliance: [
    {
      text: "Revisar rigorosamente ortografia, nomes de autoridades, siglas e cargos antes de qualquer publicação ou disparo.",
      ok: true,
    },
    {
      text: "Checar autorização de uso de imagem e termos de consentimento assinados com moradores e crianças em vídeos/fotos.",
      ok: true,
    },
    {
      text: "Validar valores exatos de emendas, convênios e números orçamentários com as secretarias competentes e Portal da Transparência.",
      ok: true,
    },
    {
      text: "Garantir aplicação fiel do manual de identidade visual institucional (paleta oficial, tipografia e contraste acessível).",
      ok: true,
    },
    {
      text: "Proibir termos e expressões de autopromoção vedadas pela legislação eleitoral e manter tom estritamente informativo e transparente.",
      ok: true,
    },
    {
      text: "Inserir créditos obrigatórios de fotografia, filmagem e fontes estatísticas oficiais (TSE, IBGE, IPARDES).",
      ok: true,
    },
    {
      text: "Respeitar rigorosamente a LGPD (Lei Geral de Proteção de Dados) na gestão da base de contatos e cadastros de lideranças.",
      ok: true,
    },
    {
      text: "Registrar e arquivar termos de homologação da assessoria jurídica antes de campanhas institucionais de rádio/TV.",
      ok: true,
    },
  ],
  cand1Name: "Deputado Estadual pelo Paraná",
  cand1Role: "Mandato Legislativo · Representação de Arapongas e Região Norte",
  cand1Bio: "Parlamentar com sólida trajetória de defesa dos municípios do Norte do Paraná e do Vale do Ivaí. Atuação destacada na destinação de recursos para a infraestrutura urbana, duplicação e segurança da PR-444, custeio do Hospital Honpar e fortalecimento do polo industrial moveleiro de Arapongas. Defensor da desburocratização, transparência pública e valorização dos servidores municipais.",
  cand1Tone: "Proximidade comunitária, clareza, prestação de contas objetiva e firmeza na defesa dos interesses regionais.",
  cand2Name: "Deputado Federal / Bancada Paranaense",
  cand2Role: "Congresso Nacional · Articulação Federal e Orçamento da União",
  cand2Bio: "Representante de Arapongas e do Paraná em Brasília, com foco na atração de verbas ministeriais para saúde de alta complexidade, saneamento básico, habitação popular e incentivo à exportação das empresas moveleiras e agrícolas paranaenses. Membro ativo das frentes parlamentares da indústria e da saúde.",
  cand2Tone: "Institucional, técnico, propositivo, fundamentado em dados e de fácil compreensão pelo cidadão comum.",
  msg1: "Arapongas merece representação forte, séria e comprometida com entregas reais. Cada recurso destinado ao nosso município transforma-se em atendimento digno na saúde, ruas asfaltadas e mais oportunidades de trabalho para as nossas famílias.",
  msg2: "O nosso mandato é construído ouvindo as pessoas em cada bairro e distrito. Transparência não é promessa, é dever diário: prestamos contas de cada projeto e de cada centavo investido no desenvolvimento da nossa terra.",
  editorNotes: "• CRONOGRAMA DA SEMANA:\n  - Segunda-feira: Disparo do relatório de saúde para as lideranças via WhatsApp.\n  - Terça-feira: Equipe de vídeo no Conjunto Flamingos às 09:00 para captar depoimentos sobre as novas obras.\n  - Quarta-feira: Acompanhamento da votação na ALEP às 14:30 com transmissão ao vivo.\n  - Quinta-feira: Envio de release à imprensa regional sobre as emendas do Honpar.\n  - Sexta-feira: Gravação no Parque Industrial com trabalhadores do setor moveleiro.\n  - Sábado: Cobertura da plenária de Aricanduva com fotos e lista de presença digital.\n\n• DIRETRIZES DA COORDENAÇÃO:\n  1. Manter tempo de resposta de no máximo 2 horas para mensagens de lideranças cadastradas.\n  2. Checar todos os dados com o portal da transparência antes de postar cards orçamentários.\n  3. Priorizar vídeos com depoimentos reais da comunidade em vez de discursos longos de gabinete.",
  theme: "dark",
  lastSaved: null,
};

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export default function InstitutionalCommunicationClient() {
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
    if (window.confirm("Deseja carregar a base de dados oficial completa de Arapongas e do mandato?")) {
      saveToStorage(clone(defaultState));
    }
  }, [saveToStorage]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "painel-comunicacao-arapongas.json";
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
      { title: "Nova prioridade estratégica", body: "Descreva aqui o objetivo e ações prioritárias." },
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
      { date: "Nova data/hora", type: "Compromisso", desc: "Descreva o compromisso ou pauta", status: "Pendente", owner: "Responsável" },
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
      { region: "Novo bairro ou região", priority: "Alta", demands: "Descreva as demandas levantadas" },
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
      { title: "Novo segmento ou interlocutor", body: "Descreva o público e a estratégia de diálogo." },
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
      { format: "Formato", theme: "Tema da peça", objective: "Objetivo", channel: "Canais", due: "Prazo" },
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
      { text: "Novo item de checagem jurídica e editorial", ok: false },
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
      <div className="pc-embedded-container" style={{ display: "grid", placeItems: "center", minHeight: "400px" }}>
        <p style={{ color: "var(--pc-muted)" }}>Carregando Painel Institucional…</p>
      </div>
    );
  }

  return (
    <div
      className={`pc-embedded-container ${state.theme === "light" ? "pc-theme-light" : ""}`}
      data-theme={state.theme}
    >
      {/* SUB-HEADER ELEGANTE */}
      <div className="pc-embedded-header">
        <div className="pc-embedded-title">
          <div className="pc-logo-mini">PC</div>
          <div>
            <h2>Painel de Comunicação & Gestão Institucional</h2>
            <p>Organização de conteúdo, agenda, território e conformidade — Arapongas e Paraná.</p>
          </div>
        </div>
        <div className="pc-embedded-actions">
          <span className="pc-chip">
            <span className="dot" /> {state.lastSaved ? `Salvo: ${state.lastSaved}` : "Base oficial ativa"}
          </span>
          <button type="button" className="pc-btn ghost" onClick={toggleTheme}>
            {state.theme === "light" ? "🌙 Modo Escuro" : "☀️ Modo Claro"}
          </button>
          <button type="button" className="pc-btn" onClick={exportJson}>
            📥 Exportar JSON
          </button>
          <button type="button" className="pc-btn success" onClick={resetToDefault}>
            🔄 Restaurar base oficial
          </button>
        </div>
      </div>

      {/* ABAS HORIZONTAIS DE ALTA USABILIDADE */}
      <nav className="pc-horizontal-tabs" role="tablist">
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "visao" ? "active" : ""}`}
          onClick={() => setActiveTab("visao")}
        >
          📊 Visão Geral ({state.priorities.length} prioridades)
        </button>
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "perfil" ? "active" : ""}`}
          onClick={() => setActiveTab("perfil")}
        >
          👤 Perfil & Mandatos
        </button>
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "agenda" ? "active" : ""}`}
          onClick={() => setActiveTab("agenda")}
        >
          📅 Agenda & Entregas ({state.agenda.length} itens)
        </button>
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "territorio" ? "active" : ""}`}
          onClick={() => setActiveTab("territorio")}
        >
          📍 Território & Bairros ({state.territory.length} regiões)
        </button>
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "conteudo" ? "active" : ""}`}
          onClick={() => setActiveTab("conteudo")}
        >
          🎬 Conteúdo & Peças ({state.contents.length} peças)
        </button>
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "compliance" ? "active" : ""}`}
          onClick={() => setActiveTab("compliance")}
        >
          ✅ Compliance {pendingAlertsCount > 0 ? `(${pendingAlertsCount} pendentes)` : "(100% OK)"}
        </button>
        <button
          type="button"
          className={`pc-tab-pill ${activeTab === "exportacao" ? "active" : ""}`}
          onClick={() => setActiveTab("exportacao")}
        >
          💾 Exportação & Backup
        </button>
      </nav>

      {/* ÁREA DE CONTEÚDO */}
      <div className="pc-tab-content-area">
        {/* 1. VISÃO GERAL */}
        {activeTab === "visao" && (
          <>
            <div className="pc-hero">
              <div className="pc-hero-banner">
                <div className="pc-status-tag">
                  <span className="dot" /> Arapongas e Norte do Paraná · Monitoramento em Tempo Real
                </div>
                <h3>Comunicação clara, moderna e orientada a informação pública</h3>
                <p>
                  Organização estratégica da presença pública: gestão de prioridades do mandato, agenda de fiscalização,
                  produção de conteúdo institucional e atendimento às demandas dos bairros de Arapongas.
                </p>
                <div className="pc-hero-kpis">
                  <div className="pc-kpi">
                    <strong>2</strong>
                    <span>Frentes Parlamentares Ativas</span>
                  </div>
                  <div className="pc-kpi">
                    <strong>{state.agenda.length}</strong>
                    <span>Compromissos na Semana</span>
                  </div>
                  <div className="pc-kpi">
                    <strong>{state.territory.length}</strong>
                    <span>Regiões & Bairros Mapeados</span>
                  </div>
                </div>
              </div>
              <div className="pc-hero-side">
                <div className="pc-mini-stat">
                  <div className="label">Status da Operação</div>
                  <div className="value" style={{ color: "var(--pc-accent-2)" }}>Ativo e Operacional</div>
                </div>
                <div className="pc-mini-stat">
                  <div className="label">Último salvamento</div>
                  <div className="value" style={{ fontSize: "0.92rem" }}>
                    {state.lastSaved || "Base oficial sincronizada"}
                  </div>
                </div>
                <div className="pc-mini-stat">
                  <div className="label">Conformidade Editorial</div>
                  <div className="value" style={{ color: pendingAlertsCount === 0 ? "var(--pc-success)" : "var(--pc-warning)" }}>
                    {pendingAlertsCount === 0 ? "100% Homologado" : `${pendingAlertsCount} pendências`}
                  </div>
                </div>
              </div>
            </div>

            <div className="pc-grid-3">
              <div className="pc-card">
                <h4>🎯 Resumo Estratégico do Mandato</h4>
                <div className="pc-field">
                  <label>Objetivo Editorial & Institucional</label>
                  <textarea
                    value={state.overviewGoal}
                    onChange={(e) => updateField("overviewGoal", e.target.value)}
                  />
                </div>
                <div className="pc-field">
                  <label>Mensagem Central e Posicionamento</label>
                  <textarea
                    value={state.overviewMessage}
                    onChange={(e) => updateField("overviewMessage", e.target.value)}
                  />
                </div>
              </div>

              <div className="pc-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <h4 style={{ margin: 0 }}>⚡ Prioridades do Período ({state.priorities.length})</h4>
                  <button
                    type="button"
                    className="pc-btn primary"
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    onClick={addPriority}
                  >
                    + Nova prioridade
                  </button>
                </div>
                <div className="pc-list">
                  {state.priorities.map((item, i) => (
                    <div key={i} className="pc-list-item">
                      <div className="pc-list-item-main">
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
                              minHeight: "54px",
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
                        className="pc-btn danger"
                        onClick={() => removePriority(i)}
                        style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pc-card">
                <h4>📈 Ritmo da Operação</h4>
                <div className="pc-mini-stat" style={{ marginBottom: "10px" }}>
                  <div className="label">Peças e Publicações Ativas</div>
                  <div className="value" style={{ color: "var(--pc-accent)" }}>
                    {state.contents.length} formatos
                  </div>
                </div>
                <div className="pc-mini-stat" style={{ marginBottom: "10px" }}>
                  <div className="label">Agendas e Vistorias Programadas</div>
                  <div className="value" style={{ color: "var(--pc-accent-2)" }}>
                    {state.agenda.length} ações
                  </div>
                </div>
                <div className="pc-mini-stat">
                  <div className="label">Conformidade e Checagens LGPD</div>
                  <div className="value" style={{ color: pendingAlertsCount > 0 ? "var(--pc-warning)" : "var(--pc-success)" }}>
                    {state.compliance.length} itens verificados
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2. PERFIL & POSICIONAMENTO */}
        {activeTab === "perfil" && (
          <div className="pc-section">
            <div className="pc-section-head">
              <div>
                <h3>Perfil e Posicionamento Parlamentar</h3>
                <p>Estrutura de biografia, atuação, tom de voz e alinhamento institucional.</p>
              </div>
              <span className="pc-tag blue">Base Oficial Paraná</span>
            </div>
            <div className="pc-profile-grid">
              <div className="pc-card">
                <h4>🏛️ Frente 1 · Mandato Estadual</h4>
                <div className="pc-field">
                  <label>Nome / Cargo</label>
                  <input
                    value={state.cand1Name}
                    onChange={(e) => updateField("cand1Name", e.target.value)}
                  />
                </div>
                <div className="pc-field">
                  <label>Esfera / Foco de Atuação</label>
                  <input
                    value={state.cand1Role}
                    onChange={(e) => updateField("cand1Role", e.target.value)}
                  />
                </div>
                <div className="pc-field">
                  <label>Biografia Resumida & Conquistas</label>
                  <textarea
                    value={state.cand1Bio}
                    onChange={(e) => updateField("cand1Bio", e.target.value)}
                    style={{ minHeight: "120px" }}
                  />
                </div>
                <div className="pc-field">
                  <label>Tom de Comunicação</label>
                  <input
                    value={state.cand1Tone}
                    onChange={(e) => updateField("cand1Tone", e.target.value)}
                  />
                </div>
              </div>

              <div className="pc-card">
                <h4>🏛️ Frente 2 · Mandato Federal</h4>
                <div className="pc-field">
                  <label>Nome / Cargo</label>
                  <input
                    value={state.cand2Name}
                    onChange={(e) => updateField("cand2Name", e.target.value)}
                  />
                </div>
                <div className="pc-field">
                  <label>Esfera / Foco de Atuação</label>
                  <input
                    value={state.cand2Role}
                    onChange={(e) => updateField("cand2Role", e.target.value)}
                  />
                </div>
                <div className="pc-field">
                  <label>Biografia Resumida & Conquistas</label>
                  <textarea
                    value={state.cand2Bio}
                    onChange={(e) => updateField("cand2Bio", e.target.value)}
                    style={{ minHeight: "120px" }}
                  />
                </div>
                <div className="pc-field">
                  <label>Tom de Comunicação</label>
                  <input
                    value={state.cand2Tone}
                    onChange={(e) => updateField("cand2Tone", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pc-section" style={{ marginTop: "16px" }}>
              <div className="pc-section-head">
                <div>
                  <h3>Mensagens-Chave Oficiais</h3>
                  <p>Texto-base institucional padronizado para entrevistas, site, PDF e redes sociais.</p>
                </div>
                <span className="pc-tag green">Diretriz de Discurso</span>
              </div>
              <div className="pc-grid-2">
                <div className="pc-field">
                  <label>Mensagem 1 · Compromisso com Arapongas</label>
                  <textarea
                    value={state.msg1}
                    onChange={(e) => updateField("msg1", e.target.value)}
                    style={{ minHeight: "100px" }}
                  />
                </div>
                <div className="pc-field">
                  <label>Mensagem 2 · Transparência e Prestação de Contas</label>
                  <textarea
                    value={state.msg2}
                    onChange={(e) => updateField("msg2", e.target.value)}
                    style={{ minHeight: "100px" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. AGENDA & ENTREGAS */}
        {activeTab === "agenda" && (
          <div className="pc-section">
            <div className="pc-section-head">
              <div>
                <h3>Agenda & Entregas da Semana ({state.agenda.length} compromissos)</h3>
                <p>Planejamento semanal de ações, visitas técnicas, sessões plenárias e entrevistas.</p>
              </div>
              <button type="button" className="pc-btn primary" onClick={addAgendaItem}>
                + Novo Compromisso
              </button>
            </div>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th style={{ width: "120px" }}>DATA/HORA</th>
                    <th style={{ width: "140px" }}>TIPO</th>
                    <th>DESCRIÇÃO DO COMPROMISSO</th>
                    <th style={{ width: "150px" }}>STATUS</th>
                    <th style={{ width: "160px" }}>RESPONSÁVEL</th>
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
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit", fontWeight: 700 }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.type}
                          onChange={(e) => editAgendaItem(i, "type", e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit" }}
                        />
                      </td>
                      <td>
                        <textarea
                          value={row.desc}
                          onChange={(e) => editAgendaItem(i, "desc", e.target.value)}
                          style={{ width: "100%", minHeight: "45px", background: "transparent", border: "none", color: "inherit", resize: "vertical" }}
                        />
                      </td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(e) => editAgendaItem(i, "status", e.target.value as AgendaItem["status"])}
                          style={{ padding: "6px 8px" }}
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
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit" }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pc-btn danger"
                          onClick={() => removeAgendaItem(i)}
                          style={{ padding: "4px 8px" }}
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
        )}

        {/* 4. TERRITÓRIO & PÚBLICO */}
        {activeTab === "territorio" && (
          <div className="pc-grid-2">
            <div className="pc-section">
              <div className="pc-section-head">
                <div>
                  <h3>Território & Bairros de Arapongas ({state.territory.length})</h3>
                  <p>Mapeamento de prioridades, bairros, distritos e demandas comunitárias.</p>
                </div>
                <button type="button" className="pc-btn primary" onClick={addTerritoryItem}>
                  + Adicionar Região
                </button>
              </div>
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>REGIÃO / BAIRRO</th>
                      <th style={{ width: "100px" }}>PRIORIDADE</th>
                      <th>DEMANDAS & REIVINDICAÇÕES</th>
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
                            style={{ width: "100%", background: "transparent", border: "none", color: "inherit", fontWeight: 700 }}
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
                            style={{ width: "100%", minHeight: "45px", background: "transparent", border: "none", color: "inherit", resize: "vertical" }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="pc-btn danger"
                            onClick={() => removeTerritoryItem(i)}
                            style={{ padding: "4px 8px" }}
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
                  <h3>Segmentos de Atenção & Interlocutores ({state.audiences.length})</h3>
                  <p>Organização estratégica de diálogo por setores da sociedade de Arapongas.</p>
                </div>
                <button type="button" className="pc-btn primary" onClick={addAudienceItem}>
                  + Novo Segmento
                </button>
              </div>
              <div className="pc-list">
                {state.audiences.map((item, i) => (
                  <div key={i} className="pc-list-item">
                    <div className="pc-list-item-main">
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
                            minHeight: "50px",
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
                      className="pc-btn danger"
                      onClick={() => removeAudienceItem(i)}
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. CONTEÚDO & PEÇAS */}
        {activeTab === "conteudo" && (
          <div className="pc-section">
            <div className="pc-section-head">
              <div>
                <h3>Conteúdo & Peças em Produção ({state.contents.length} publicações)</h3>
                <p>Planejamento de vídeos curtos, carrosséis, PDFs, podcasts e matérias de imprensa.</p>
              </div>
              <button type="button" className="pc-btn primary" onClick={addContentItem}>
                + Nova Peça
              </button>
            </div>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>FORMATO</th>
                    <th style={{ width: "200px" }}>TEMA DA PEÇA</th>
                    <th>OBJETIVO ESTRATÉGICO</th>
                    <th style={{ width: "170px" }}>CANAL DE DISTRIBUIÇÃO</th>
                    <th style={{ width: "110px" }}>PRAZO</th>
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
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit", fontWeight: 700 }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.theme}
                          onChange={(e) => editContentItem(i, "theme", e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit" }}
                        />
                      </td>
                      <td>
                        <textarea
                          value={row.objective}
                          onChange={(e) => editContentItem(i, "objective", e.target.value)}
                          style={{ width: "100%", minHeight: "45px", background: "transparent", border: "none", color: "inherit", resize: "vertical" }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.channel}
                          onChange={(e) => editContentItem(i, "channel", e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit" }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.due}
                          onChange={(e) => editContentItem(i, "due", e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "none", color: "inherit" }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pc-btn danger"
                          onClick={() => removeContentItem(i)}
                          style={{ padding: "4px 8px" }}
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
        )}

        {/* 6. COMPLIANCE */}
        {activeTab === "compliance" && (
          <div className="pc-grid-2">
            <div className="pc-section">
              <div className="pc-section-head">
                <div>
                  <h3>Checklist de Conformidade & LGPD ({state.compliance.length} itens)</h3>
                  <p>Normas editoriais, validação de fontes e verificação prévia de publicação.</p>
                </div>
                <button type="button" className="pc-btn primary" onClick={addComplianceItem}>
                  + Novo Item
                </button>
              </div>
              <div className="pc-list">
                {state.compliance.map((item, i) => (
                  <div key={i} className="pc-list-item">
                    <div className="pc-list-item-main">
                      <strong>
                        <input
                          value={item.text}
                          onChange={(e) => editComplianceItem(i, e.target.value)}
                          style={{
                            width: "100%",
                            font: "inherit",
                            fontWeight: 700,
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
                        Status da verificação:{" "}
                        {item.ok ? (
                          <span className="pc-tag green">✓ Homologado</span>
                        ) : (
                          <span className="pc-tag orange">⚠ Pendente de checagem</span>
                        )}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className={`pc-btn ${item.ok ? "ghost" : "success"}`}
                        onClick={() => toggleComplianceItem(i)}
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      >
                        {item.ok ? "Desmarcar" : "Marcar OK"}
                      </button>
                      <button
                        type="button"
                        className="pc-btn danger"
                        onClick={() => removeComplianceItem(i)}
                        style={{ padding: "6px 8px" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pc-section">
              <div className="pc-section-head">
                <div>
                  <h3>Anotações Editoriais da Coordenação</h3>
                  <p>Diretrizes semanais, pautas prioritárias e orientações para a equipe de campo.</p>
                </div>
                <span className="pc-tag blue">Gabinete Arapongas</span>
              </div>
              <div className="pc-field">
                <label>Notas Oficiais & Planejamento Operacional</label>
                <textarea
                  value={state.editorNotes}
                  onChange={(e) => updateField("editorNotes", e.target.value)}
                  style={{ minHeight: "380px", lineHeight: "1.6", fontFamily: "inherit" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. EXPORTAÇÃO */}
        {activeTab === "exportacao" && (
          <div className="pc-grid-2">
            <div className="pc-section">
              <div className="pc-section-head">
                <div>
                  <h3>Exportação e Backup Estratégico</h3>
                  <p>Baixe a base de dados completa em formato JSON seguro.</p>
                </div>
                <span className="pc-tag blue">Arapongas 2026</span>
              </div>
              <div className="pc-field">
                <label>Dados Estruturados em JSON</label>
                <textarea
                  value={JSON.stringify(state, null, 2)}
                  readOnly
                  style={{ minHeight: "360px", fontFamily: "monospace", fontSize: "0.82rem", color: "#69e2c4", background: "rgba(0,0,0,0.3)" }}
                />
              </div>
            </div>

            <div className="pc-section">
              <div className="pc-section-head">
                <div>
                  <h3>Ações Rápidas de Backup</h3>
                  <p>Download, restauração da base oficial e controle de tema.</p>
                </div>
              </div>
              <div className="pc-list">
                <div className="pc-list-item">
                  <div className="pc-list-item-main">
                    <strong>📥 Exportar JSON</strong>
                    <p>Gera um arquivo de backup completo com todas as abas e configurações.</p>
                  </div>
                  <button type="button" className="pc-btn primary" onClick={exportJson}>
                    Baixar Backup
                  </button>
                </div>
                <div className="pc-list-item">
                  <div className="pc-list-item-main">
                    <strong>🔄 Restaurar Base Oficial</strong>
                    <p>Recarrega todos os dados completos e oficiais de Arapongas e do mandato.</p>
                  </div>
                  <button type="button" className="pc-btn success" onClick={resetToDefault}>
                    Restaurar
                  </button>
                </div>
                <div className="pc-list-item">
                  <div className="pc-list-item-main">
                    <strong>🌓 Alternar Tema Visual</strong>
                    <p>Troca instantaneamente entre o modo escuro de alta legibilidade e o modo claro.</p>
                  </div>
                  <button type="button" className="pc-btn ghost" onClick={toggleTheme}>
                    Alternar Tema
                  </button>
                </div>
              </div>
              <div className="pc-footer-note">
                <strong>Base de Dados Voto Forte:</strong> Dados sincronizados localmente e protegidos de acordo com as normas de conformidade institucional e LGPD.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
