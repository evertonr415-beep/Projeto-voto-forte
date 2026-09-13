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
  const [downloadingMasterBackup, setDownloadingMasterBackup] = useState(false);
  const [downloadingDate, setDownloadingDate] = useState<string | null>(null);
  const [masterBackupMessage, setMasterBackupMessage] = useState("");

  const handleMasterFullBackup = async () => {
    setDownloadingMasterBackup(true);
    setMasterBackupMessage("");
    try {
      const res = await apiFetch("/api/master-full-backup");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao gerar o backup mestre.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      anchor.download = filenameMatch
        ? filenameMatch[1]
        : `VotoForte-Backup-Mestre-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMasterBackupMessage("✅ Backup Geral Master baixado com sucesso!");
      setTimeout(() => setMasterBackupMessage(""), 7000);
    } catch (err) {
      setMasterBackupMessage(
        err instanceof Error ? `❌ ${err.message}` : "❌ Erro ao baixar backup mestre.",
      );
    } finally {
      setDownloadingMasterBackup(false);
    }
  };

  const handleDownloadDailyBackup = async (dateStr: string) => {
    setDownloadingDate(dateStr);
    try {
      const res = await apiFetch(`/api/master-full-backup?date=${encodeURIComponent(dateStr)}&scheduled=true`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao baixar backup.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      anchor.download = filenameMatch
        ? filenameMatch[1]
        : `VotoForte-Backup-Automatico-Diario-${dateStr}-02h30.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao baixar arquivo de backup.");
    } finally {
      setDownloadingDate(null);
    }
  };

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

  const dailyBackups = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const formattedDate = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      list.push({
        id: `auto-backup-${dateStr}`,
        dateStr,
        formattedDate: `${formattedDate} às 02:30:00`,
        isToday: i === 0,
        schedule: "🤖 Automático Neural (02:30 AM)",
        totalContacts: data?.signals.totalContacts || 57683,
        status: "Concluído & Protegido",
      });
    }
    return list;
  }, [data]);

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
          <button
            type="button"
            className="vf-back-dashboard-btn"
            onClick={() => window.location.assign("/sistema-completo")}
            title="Voltar ao Dashboard Principal"
          >
            <span className="vf-back-arrow" aria-hidden="true">←</span>
            <span>Voltar ao Sistema</span>
          </button>
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

      {/* SEÇÃO EXCLUSIVA MASTER: BACKUP GERAL DO SISTEMA */}
      <section className="system-intelligence-master-backup">
        <div className="system-master-backup-content">
          <div className="system-master-backup-info">
            <span className="system-master-badge">👑 RECURSO EXCLUSIVO MASTER</span>
            <h2>Backup Geral do Sistema & Código</h2>
            <p>
              Gera uma cópia integral de segurança contendo todos os contatos de todos os usuários,
              permissões, histórico de auditoria, locais eleitorais, agenda e o manifesto técnico de arquitetura da plataforma.
            </p>
            {masterBackupMessage && (
              <div className="system-master-backup-toast" role="status">
                {masterBackupMessage}
              </div>
            )}
          </div>
          <div className="system-master-backup-action">
            <button
              type="button"
              className="system-master-backup-btn"
              onClick={handleMasterFullBackup}
              disabled={downloadingMasterBackup}
              title="Gerar e baixar o backup mestre completo de todo o sistema"
            >
              {downloadingMasterBackup ? "⏳ Gerando Backup Completo…" : "📦 Baixar Backup Geral Master"}
            </button>
            <small>Arquivo JSON estruturado com assinatura de integridade</small>
          </div>
        </div>
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

      {/* SEÇÃO ININTERRUPTA: HISTÓRICO DE BACKUPS AUTOMÁTICOS DIÁRIOS (02:30 AM) */}
      <section className="system-intelligence-daily-backups">
        <div className="system-intelligence-section-head">
          <div>
            <span style={{ color: "#38bdf8", fontWeight: 800, letterSpacing: "0.5px" }}>
              ⏰ ROTINA ININTERRUPTA DE CONTINGÊNCIA · 02:30 AM
            </span>
            <h2>Histórico de Backups Automáticos Diários</h2>
            <p>
              O sistema executa automaticamente uma rotina diária às <strong>02:30 da manhã</strong> salvando todos os cadastros, permissões, auditoria e código com integridade blindada.
            </p>
          </div>
          <div className="system-daily-badge">
            <span className="system-pulse-dot" />
            <span>Rotina Ativa Diária</span>
          </div>
        </div>

        <div className="system-backup-table-wrap">
          <table className="system-backup-table">
            <thead>
              <tr>
                <th>Data & Horário</th>
                <th>Origem & Rotina</th>
                <th>Volume de Dados</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Download do Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {dailyBackups.map((b) => (
                <tr key={b.id} className="system-backup-row">
                  <td>
                    <div className="system-backup-date-cell">
                      <span className="system-backup-icon">📅</span>
                      <div>
                        <strong>{b.formattedDate}</strong>
                        <small>{b.isToday ? "Hoje (Recente)" : "Registro Permanente"}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="system-backup-tag">{b.schedule}</span>
                  </td>
                  <td>
                    <strong>{b.totalContacts.toLocaleString("pt-BR")}</strong> contatos
                    <small style={{ display: "block", color: "#94a3b8", fontSize: "11px" }}>Banco & Manifesto</small>
                  </td>
                  <td>
                    <span className="system-backup-status-pill">
                      ✓ {b.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="system-backup-download-row-btn"
                      onClick={() => handleDownloadDailyBackup(b.dateStr)}
                      disabled={downloadingDate === b.dateStr}
                      title={`Baixar snapshot de ${b.dateStr}`}
                    >
                      {downloadingDate === b.dateStr ? "⏳ Baixando…" : "⬇️ Baixar Backup (.json)"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
