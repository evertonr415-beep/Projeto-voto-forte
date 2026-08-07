"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiFetch, supabase } from "../supabase-client";
import "./system-intelligence.css";

type Severity = "critical" | "high" | "medium" | "info";

type Finding = {
  id: string;
  category: string;
  severity: Severity;
  confidence: "high" | "medium";
  title: string;
  summary: string;
  impact: string;
  recommendation: string;
  evidence: string[];
  actionHref?: string;
  actionLabel?: string;
};

type IntelligenceData = {
  generatedAt: string;
  engine: {
    name: string;
    version: string;
    mode: "observer";
    autonomyLevel: number;
    autonomyLabel: string;
    analysisCoverage: number;
    limitations: string[];
  };
  health: {
    score: number;
    label: string;
    priorities: Record<Severity, number>;
  };
  signals: {
    totalContacts: number;
    pendingContacts: number;
    newContacts7Days: number;
    newContacts30Days: number;
    activeUsers: number;
    leaders: number;
    auditEvents30Days: number;
    navigationEvents30Days: number;
    operationalEvents30Days: number;
    backup: {
      exists: boolean;
      createdAt: string | null;
      createdBy: string | null;
      itemCount: number;
      ageHours: number | null;
    };
  };
  findings: Finding[];
};

function formatDate(value: string | null) {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function severityLabel(value: Severity) {
  return {
    critical: "Crítico",
    high: "Alta prioridade",
    medium: "Média prioridade",
    info: "Oportunidade",
  }[value];
}

function categoryLabel(value: string) {
  return (
    {
      performance: "Desempenho",
      data_quality: "Qualidade dos dados",
      continuity: "Continuidade",
      security: "Segurança",
      usage: "Uso do sistema",
      architecture: "Arquitetura",
    }[value] ?? value
  );
}

export default function SystemIntelligenceClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Severity>("all");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) window.location.replace("/contatos");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (!next) window.location.replace("/contatos");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    void apiFetch("/api/system-intelligence", { signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || "Falha ao analisar o sistema");
        setData(payload as IntelligenceData);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Falha ao analisar o sistema");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [session]);

  const visibleFindings = useMemo(
    () =>
      (data?.findings ?? []).filter((finding) =>
        filter === "all" ? true : finding.severity === filter,
      ),
    [data, filter],
  );

  if (busy || !data) {
    return (
      <main className="system-intelligence-state">
        <section className="system-intelligence-state-card" role="status">
          {!error && <div className="system-intelligence-spinner" aria-hidden="true" />}
          <strong>{error || "VOTO FORTE Neural está analisando o sistema…"}</strong>
          <p>
            {error
              ? "A análise não pôde ser concluída agora. Volte ao painel e tente novamente."
              : "Consolidando saúde dos dados, continuidade, arquitetura, uso e sinais de desempenho."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="system-intelligence-shell">
      <header className="system-intelligence-hero">
        <div>
          <span className="system-intelligence-eyebrow">INTELIGÊNCIA DO SISTEMA · MASTER</span>
          <h1>VOTO FORTE Neural</h1>
          <p>
            Observa a operação, identifica riscos e oportunidades, explica o impacto e recomenda o próximo passo. Nesta fase, não altera código, banco ou produção automaticamente.
          </p>
        </div>
        <div className="system-intelligence-actions">
          <a href="/inteligencia-equipe">Inteligência da Equipe</a>
          <a href="/contatos">Voltar ao painel</a>
        </div>
      </header>

      <section className="system-intelligence-overview">
        <article className="system-health-card">
          <span>SAÚDE DO SISTEMA</span>
          <div className="system-health-score">{data.health.score}</div>
          <strong>{data.health.label}</strong>
          <small>Última análise: {formatDate(data.generatedAt)}</small>
        </article>
        <article>
          <span>COBERTURA DA ANÁLISE</span>
          <b>{data.engine.analysisCoverage}%</b>
          <small>Dados, continuidade, uso, arquitetura e sinais operacionais.</small>
        </article>
        <article>
          <span>AUTONOMIA</span>
          <b>Nível {data.engine.autonomyLevel}</b>
          <small>{data.engine.autonomyLabel}</small>
        </article>
        <article>
          <span>PRIORIDADES</span>
          <b>{data.health.priorities.critical + data.health.priorities.high}</b>
          <small>Itens críticos ou de alta prioridade encontrados agora.</small>
        </article>
      </section>

      <section className="system-intelligence-signals">
        <div className="system-intelligence-section-head">
          <div>
            <span>LEITURA ATUAL</span>
            <h2>Sinais usados pela inteligência</h2>
          </div>
          <small>Somente leitura · sem mudanças automáticas</small>
        </div>
        <div className="system-signal-grid">
          <article><span>Base atual</span><b>{data.signals.totalContacts.toLocaleString("pt-BR")}</b><small>contatos</small></article>
          <article><span>Pendências</span><b>{data.signals.pendingContacts.toLocaleString("pt-BR")}</b><small>contatos para revisão</small></article>
          <article><span>Novos em 7 dias</span><b>{data.signals.newContacts7Days.toLocaleString("pt-BR")}</b><small>crescimento recente</small></article>
          <article><span>Usuários ativos</span><b>{data.signals.activeUsers.toLocaleString("pt-BR")}</b><small>{data.signals.leaders.toLocaleString("pt-BR")} líderes</small></article>
          <article><span>Eventos em 30 dias</span><b>{data.signals.auditEvents30Days.toLocaleString("pt-BR")}</b><small>auditoria analisada</small></article>
          <article><span>Último backup</span><b>{data.signals.backup.exists ? formatDate(data.signals.backup.createdAt) : "Não encontrado"}</b><small>{data.signals.backup.ageHours == null ? "sem idade calculada" : `${Math.round(data.signals.backup.ageHours)}h atrás`}</small></article>
        </div>
      </section>

      <section className="system-intelligence-findings">
        <div className="system-intelligence-section-head">
          <div>
            <span>DIAGNÓSTICOS</span>
            <h2>O que merece atenção</h2>
            <p>Cada item combina sinal, impacto e recomendação. Nenhuma ação destrutiva é executada.</p>
          </div>
          <div className="system-intelligence-filters" aria-label="Filtrar diagnósticos">
            {(["all", "critical", "high", "medium", "info"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
              >
                {value === "all" ? "Todos" : severityLabel(value)}
              </button>
            ))}
          </div>
        </div>

        <div className="system-findings-list">
          {visibleFindings.map((finding) => (
            <article className={`system-finding severity-${finding.severity}`} key={finding.id}>
              <div className="system-finding-meta">
                <span>{severityLabel(finding.severity)}</span>
                <small>{categoryLabel(finding.category)} · confiança {finding.confidence === "high" ? "alta" : "média"}</small>
              </div>
              <h3>{finding.title}</h3>
              <p>{finding.summary}</p>
              <div className="system-finding-columns">
                <div>
                  <strong>Impacto</strong>
                  <p>{finding.impact}</p>
                </div>
                <div>
                  <strong>Recomendação</strong>
                  <p>{finding.recommendation}</p>
                </div>
              </div>
              <details>
                <summary>Ver evidências</summary>
                <ul>
                  {finding.evidence.map((item, index) => <li key={`${finding.id}-${index}`}>{item}</li>)}
                </ul>
              </details>
              {finding.actionHref && (
                <a className="system-finding-action" href={finding.actionHref}>
                  {finding.actionLabel || "Abrir área relacionada"}
                </a>
              )}
            </article>
          ))}
          {!visibleFindings.length && (
            <article className="system-intelligence-empty">
              <strong>Nenhum diagnóstico neste filtro.</strong>
              <p>A inteligência continuará analisando os sinais disponíveis.</p>
            </article>
          )}
        </div>
      </section>

      <section className="system-intelligence-roadmap">
        <div>
          <span>PRÓXIMA CAMADA</span>
          <h2>O que ainda falta para a inteligência ficar realmente neural</h2>
        </div>
        <ul>
          {data.engine.limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p>
          A próxima evolução deve adicionar telemetria técnica própria para medir latência, erros e Web Vitals ao longo do tempo e, depois, memória diária dos diagnósticos.
        </p>
      </section>
    </main>
  );
}
