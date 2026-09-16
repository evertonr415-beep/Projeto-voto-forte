"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiFetch, supabase } from "../supabase-client";
import "./team-intelligence.css";

type AuditAction = {
  action: string;
  detail: string;
  createdAt: string;
};

type MetricUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "blocked";
  createdContacts: number;
  manualCreatedContacts: number;
  importedContacts: number;
  updatedContacts: number;
  pendingContacts: number;
  totalContacts: number;
  voterContacts: number;
  votersLast7Days: number;
  lastVoterCreatedAt: string | null;
  lastSeenAt: string | null;
  lastAction: AuditAction | null;
  recentActions: AuditAction[];
};

type Data = {
  generatedAt: string;
  period: { sevenDaysAgo: string };
  summary: {
    users: number;
    createdContacts: number;
    updatedContacts: number;
    pendingContacts: number;
    voterContacts: number;
    votersLast7Days: number;
    leaders: number;
    leadersWithoutRecentVoters: number;
  };
  users: MetricUser[];
};

function formatDate(value: string | null) {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function relativeActivity(value: string | null) {
  if (!value) return "Sem eleitor cadastrado";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(diff / (60 * 60 * 1000)));
  if (hours < 1) return "Último eleitor há menos de 1h";
  if (hours < 24) return `Último eleitor há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Último eleitor ontem";
  return `Último eleitor há ${days} dias`;
}

function roleLabel(role: string) {
  return (
    {
      master: "Master",
      gestor: "Gestor",
      lider: "Líder",
      liderado: "Liderado",
    }[role] ?? role
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "VF"
  );
}

function normalizeData(value: unknown): Data | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const summary = payload.summary as Record<string, unknown> | undefined;
  const period = payload.period as Record<string, unknown> | undefined;
  const rawUsers = Array.isArray(payload.users) ? payload.users : [];

  const users = rawUsers
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => {
      const recentActions = Array.isArray(item.recentActions)
        ? item.recentActions
            .filter((action): action is Record<string, unknown> => Boolean(action && typeof action === "object" && !Array.isArray(action)))
            .map((action) => ({
              action: String(action.action ?? "Ação registrada"),
              detail: String(action.detail ?? ""),
              createdAt: String(action.createdAt ?? ""),
            }))
        : [];
      const lastActionRaw = item.lastAction;
      const lastAction =
        lastActionRaw && typeof lastActionRaw === "object" && !Array.isArray(lastActionRaw)
          ? {
              action: String((lastActionRaw as Record<string, unknown>).action ?? "Ação registrada"),
              detail: String((lastActionRaw as Record<string, unknown>).detail ?? ""),
              createdAt: String((lastActionRaw as Record<string, unknown>).createdAt ?? ""),
            }
          : null;

      return {
        id: Number(item.id),
        name: String(item.name ?? "Usuário"),
        email: String(item.email ?? ""),
        role: String(item.role ?? "liderado"),
        status: item.status === "blocked" ? "blocked" : "active",
        createdContacts: Number(item.createdContacts) || 0,
        manualCreatedContacts: Number(item.manualCreatedContacts) || 0,
        importedContacts: Number(item.importedContacts) || 0,
        updatedContacts: Number(item.updatedContacts) || 0,
        pendingContacts: Number(item.pendingContacts) || 0,
        totalContacts: Number(item.totalContacts) || 0,
        voterContacts: Number(item.voterContacts) || 0,
        votersLast7Days: Number(item.votersLast7Days) || 0,
        lastVoterCreatedAt: item.lastVoterCreatedAt ? String(item.lastVoterCreatedAt) : null,
        lastSeenAt: item.lastSeenAt ? String(item.lastSeenAt) : null,
        lastAction,
        recentActions,
      } satisfies MetricUser;
    })
    .filter((user) => Number.isInteger(user.id) && user.id > 0);

  return {
    generatedAt: String(payload.generatedAt ?? new Date().toISOString()),
    period: {
      sevenDaysAgo: String(period?.sevenDaysAgo ?? new Date(Date.now() - 7 * 86400000).toISOString()),
    },
    summary: {
      users: Number(summary?.users) || users.length,
      createdContacts: Number(summary?.createdContacts) || 0,
      updatedContacts: Number(summary?.updatedContacts) || 0,
      pendingContacts: Number(summary?.pendingContacts) || 0,
      voterContacts: Number(summary?.voterContacts) || 0,
      votersLast7Days: Number(summary?.votersLast7Days) || 0,
      leaders: Number(summary?.leaders) || 0,
      leadersWithoutRecentVoters: Number(summary?.leadersWithoutRecentVoters) || 0,
    },
    users,
  };
}

export default function TeamIntelligenceAuthClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [showAllLeaders, setShowAllLeaders] = useState(false);

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

    void apiFetch("/api/team-intelligence", { signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || "Falha ao carregar inteligência da equipe");
        const normalized = normalizeData(payload);
        if (!normalized) throw new Error("Os dados da inteligência da equipe vieram em formato inválido.");
        setData(normalized);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Falha ao carregar dados");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });

    return () => controller.abort();
  }, [session]);

  const leadership = useMemo(
    () =>
      [...(data?.users ?? [])]
        .filter((user) => user.status === "active" && user.role === "lider")
        .sort(
          (a, b) =>
            b.votersLast7Days - a.votersLast7Days ||
            b.voterContacts - a.voterContacts ||
            a.name.localeCompare(b.name, "pt-BR"),
        ),
    [data],
  );

  const visibleLeadership = showAllLeaders ? leadership : leadership.slice(0, 6);

  if (busy || !data) {
    return (
      <main className="team-intelligence-state" aria-live="polite">
        <section className="team-intelligence-state-card" role="status">
          {!error && <div className="team-intelligence-spinner" aria-hidden="true" />}
          <strong>{error || "Analisando a equipe…"}</strong>
          <p>
            {error
              ? "Volte ao painel e tente novamente em alguns instantes."
              : "Consolidando cadastros, eleitores, atividade recente e pendências."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="team-intelligence-shell">
      <header className="team-intelligence-header">
        <div className="team-intelligence-header-copy">
          <span className="team-intelligence-eyebrow">GESTÃO INTELIGENTE</span>
          <h1>Inteligência da Equipe</h1>
          <p>
            Central única para acompanhar atividade administrativa e evolução das lideranças sem duplicar os registros brutos de auditoria do Sistema Completo.
          </p>
        </div>
        <div className="team-intelligence-header-actions">
          <a href="/pendencias-localizacao">Central de Qualidade</a>
          <a href="/contatos">Voltar ao painel</a>
        </div>
      </header>

      <section className="team-intelligence-kpis" aria-label="Resumo da equipe">
        <article>
          <span>Lideranças ativas</span>
          <b>{data.summary.leaders.toLocaleString("pt-BR")}</b>
          <small>Usuários com função de líder dentro da hierarquia visível.</small>
        </article>
        <article>
          <span>Eleitores nas bases</span>
          <b>{data.summary.voterContacts.toLocaleString("pt-BR")}</b>
          <small>Eleitores atualmente vinculados aos usuários acompanhados.</small>
        </article>
        <article>
          <span>Novos em 7 dias</span>
          <b>+{data.summary.votersLast7Days.toLocaleString("pt-BR")}</b>
          <small>Eleitores incluídos nas bases durante os últimos sete dias.</small>
        </article>
        <article className="warning">
          <span>Líderes sem novos eleitores</span>
          <b>{data.summary.leadersWithoutRecentVoters.toLocaleString("pt-BR")}</b>
          <small>Sem inclusão de eleitor nos últimos sete dias; indicador de atividade, não de qualidade.</small>
        </article>
      </section>

      <section className="team-intelligence-panel team-intelligence-leadership-panel">
        <div className="team-intelligence-panel-head">
          <div>
            <span className="team-intelligence-section-label">RADAR DAS LIDERANÇAS</span>
            <h2>Quem está ampliando a base</h2>
            <p>Lista viva por liderança: base atual de eleitores, evolução recente, pendências e recência do último eleitor.</p>
          </div>
          <span className="team-intelligence-updated">Atualizado em {formatDate(data.generatedAt)}</span>
        </div>

        <div className="team-intelligence-leadership-list">
          {visibleLeadership.map((user, index) => {
            const recent = user.votersLast7Days > 0;
            return (
              <article className="team-intelligence-leader" key={user.id}>
                <span className="team-intelligence-leader-position">{index + 1}</span>
                <span className="team-intelligence-avatar" aria-hidden="true">{initials(user.name)}</span>
                <div className="team-intelligence-leader-main">
                  <strong>{user.name}</strong>
                  <small>{relativeActivity(user.lastVoterCreatedAt)}</small>
                </div>
                <div className="team-intelligence-leader-metric">
                  <span>Eleitores</span>
                  <b>{user.voterContacts.toLocaleString("pt-BR")}</b>
                </div>
                <div className={`team-intelligence-leader-metric ${recent ? "is-positive" : "is-idle"}`}>
                  <span>Últimos 7 dias</span>
                  <b>{recent ? `+${user.votersLast7Days.toLocaleString("pt-BR")}` : "0"}</b>
                </div>
                <div className="team-intelligence-leader-metric">
                  <span>Pendências</span>
                  <b>{user.pendingContacts.toLocaleString("pt-BR")}</b>
                </div>
              </article>
            );
          })}
          {!leadership.length && (
            <div className="team-intelligence-empty-leaders">
              <strong>Nenhuma liderança ativa encontrada.</strong>
              <p>Quando houver usuários com função de líder, a evolução de suas bases aparecerá aqui.</p>
            </div>
          )}
        </div>
        {leadership.length > 6 && (
          <button className="team-intelligence-show-leaders" type="button" onClick={() => setShowAllLeaders((value) => !value)}>
            {showAllLeaders ? "Mostrar menos" : `Ver todas as lideranças (${leadership.length.toLocaleString("pt-BR")})`}
          </button>
        )}
        <p className="team-intelligence-note">
          A contagem usa os eleitores atualmente vinculados ao ambiente de cada líder. O período de 7 dias é calculado pela data de inclusão do registro e serve para indicar atividade recente.
        </p>
      </section>

      <section className="team-intelligence-panel team-intelligence-activity-panel">
        <div className="team-intelligence-panel-head">
          <div>
            <span className="team-intelligence-section-label">ACOMPANHAMENTO ADMINISTRATIVO</span>
            <h2>Atividade por usuário</h2>
            <p>Use esta tabela para rastrear cadastros, alterações, pendências e ações recentes. A auditoria bruta continua disponível no Sistema Completo.</p>
          </div>
        </div>

        <div className="team-intelligence-table-wrap">
          <table className="team-intelligence-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Cadastrou</th>
                <th>Atualizou</th>
                <th>Pendências</th>
                <th>Última ação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => {
                const expanded = expandedUserId === user.id;
                return [
                  <tr key={`user-${user.id}`}>
                    <td>
                      <div className="team-intelligence-user">
                        <span className="team-intelligence-avatar" aria-hidden="true">{initials(user.name)}</span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{roleLabel(user.role)} · {user.status === "active" ? "Ativo" : "Bloqueado"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="team-intelligence-number">{user.createdContacts.toLocaleString("pt-BR")}</span>
                      <small className="team-intelligence-sub">{user.totalContacts.toLocaleString("pt-BR")} contatos no ambiente</small>
                    </td>
                    <td><span className="team-intelligence-number">{user.updatedContacts.toLocaleString("pt-BR")}</span></td>
                    <td>
                      <span className={`team-intelligence-pending ${user.pendingContacts === 0 ? "zero" : ""}`}>
                        {user.pendingContacts.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="team-intelligence-last-action">
                      <strong>{user.lastAction?.action || "Sem ação registrada"}</strong>
                      <small>{formatDate(user.lastAction?.createdAt ?? null)}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="team-intelligence-detail-button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedUserId(expanded ? null : user.id)}
                      >
                        {expanded ? "Fechar" : "Detalhes"}
                      </button>
                    </td>
                  </tr>,
                  expanded ? (
                    <tr className="team-intelligence-detail-row" key={`detail-${user.id}`}>
                      <td colSpan={6}>
                        <div className="team-intelligence-detail">
                          <div className="team-intelligence-breakdown">
                            <div><span>Cadastro manual</span><b>{user.manualCreatedContacts.toLocaleString("pt-BR")}</b></div>
                            <div><span>Por importação</span><b>{user.importedContacts.toLocaleString("pt-BR")}</b></div>
                            <div><span>Eleitores atuais</span><b>{user.voterContacts.toLocaleString("pt-BR")}</b></div>
                            <div><span>Último acesso</span><b>{formatDate(user.lastSeenAt)}</b></div>
                          </div>
                          <div className="team-intelligence-timeline">
                            <h3>Ações recentes</h3>
                            {user.recentActions.length ? (
                              user.recentActions.map((action, index) => (
                                <div className="team-intelligence-timeline-item" key={`${action.createdAt}-${index}`}>
                                  <span className="team-intelligence-timeline-dot" aria-hidden="true" />
                                  <div>
                                    <strong>{action.action} · {formatDate(action.createdAt)}</strong>
                                    {action.detail && <small>{action.detail}</small>}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p>Nenhuma ação recente registrada para este usuário.</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
