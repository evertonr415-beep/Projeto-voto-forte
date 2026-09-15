"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type AuditAction = {
  action: string;
  detail: string;
  createdAt: string;
};

type MetricUser = {
  id: number;
  name: string;
  role: string;
  status: "active" | "blocked";
  pendingContacts: number;
  voterContacts: number;
  votersLast7Days: number;
  lastVoterCreatedAt: string | null;
  lastAction: AuditAction | null;
};

type TeamData = {
  generatedAt: string;
  summary: {
    voterContacts: number;
    votersLast7Days: number;
    leaders: number;
    leadersWithoutRecentVoters: number;
  };
  users: MetricUser[];
};

type SessionPayload = {
  user?: {
    accessRole?: string;
  };
};

const CACHE_TTL_MS = 60_000;
let cachedTeamData: TeamData | null = null;
let cachedAt = 0;

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
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return "Último eleitor há menos de 1h";
  if (hours < 24) return `Último eleitor há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Último eleitor ontem" : `Último eleitor há ${days} dias`;
}

function roleLabel(role: string) {
  return ({ master: "Master", gestor: "Gestor", lider: "Líder", liderado: "Liderado" } as Record<string, string>)[role] ?? role;
}

function normalizeData(value: unknown): TeamData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const summary = payload.summary as Record<string, unknown> | undefined;
  const users = (Array.isArray(payload.users) ? payload.users : [])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => {
      const lastActionRaw = item.lastAction;
      const lastAction = lastActionRaw && typeof lastActionRaw === "object" && !Array.isArray(lastActionRaw)
        ? {
            action: String((lastActionRaw as Record<string, unknown>).action ?? "Ação registrada"),
            detail: String((lastActionRaw as Record<string, unknown>).detail ?? ""),
            createdAt: String((lastActionRaw as Record<string, unknown>).createdAt ?? ""),
          }
        : null;
      return {
        id: Number(item.id),
        name: String(item.name ?? "Usuário"),
        role: String(item.role ?? "liderado"),
        status: item.status === "blocked" ? "blocked" as const : "active" as const,
        pendingContacts: Number(item.pendingContacts) || 0,
        voterContacts: Number(item.voterContacts) || 0,
        votersLast7Days: Number(item.votersLast7Days) || 0,
        lastVoterCreatedAt: item.lastVoterCreatedAt ? String(item.lastVoterCreatedAt) : null,
        lastAction,
      };
    })
    .filter((user) => Number.isInteger(user.id) && user.id > 0);

  return {
    generatedAt: String(payload.generatedAt ?? new Date().toISOString()),
    summary: {
      voterContacts: Number(summary?.voterContacts) || 0,
      votersLast7Days: Number(summary?.votersLast7Days) || 0,
      leaders: Number(summary?.leaders) || 0,
      leadersWithoutRecentVoters: Number(summary?.leadersWithoutRecentVoters) || 0,
    },
    users,
  };
}

export default function TeamPerformanceAdminEnhancer() {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [tabs, setTabs] = useState<HTMLElement | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [active, setActive] = useState(false);
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;

    const detect = () => {
      const nextPanel = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      const nextTabs = nextPanel?.querySelector<HTMLElement>(".vf-access-tabs") ?? null;
      if (!nextPanel || !nextTabs) return false;
      setPanel(nextPanel);
      setTabs(nextTabs);
      observer?.disconnect();
      void apiFetch("/api/session")
        .then(async (response) => ({ response, payload: await response.json() as SessionPayload }))
        .then(({ response, payload }) => {
          if (!cancelled && response.ok) setAllowed(payload.user?.accessRole === "adm");
        })
        .catch(() => undefined);
      return true;
    };

    if (!detect()) {
      observer = new MutationObserver(detect);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!tabs || !active) return;
    const deactivate = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (button && !button.hasAttribute("data-vf-team-performance-tab")) setActive(false);
    };
    tabs.addEventListener("click", deactivate);
    return () => tabs.removeEventListener("click", deactivate);
  }, [active, tabs]);

  useEffect(() => {
    if (!panel) return;
    panel.classList.toggle("vf-team-performance-active", active);
    return () => panel.classList.remove("vf-team-performance-active");
  }, [active, panel]);

  const loadPerformance = useCallback(async (force = false) => {
    if (!force && cachedTeamData && Date.now() - cachedAt < CACHE_TTL_MS) {
      setData(cachedTeamData);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/team-intelligence");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o desempenho da equipe.");
      const normalized = normalizeData(payload);
      if (!normalized) throw new Error("Os dados da equipe vieram em formato inválido.");
      cachedTeamData = normalized;
      cachedAt = Date.now();
      setData(normalized);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o desempenho da equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && !data && !loading) void loadPerformance();
  }, [active, data, loadPerformance, loading]);

  const leaders = useMemo(
    () => (data?.users ?? [])
      .filter((user) => user.status === "active" && user.role === "lider")
      .sort((a, b) => b.votersLast7Days - a.votersLast7Days || b.voterContacts - a.voterContacts || a.name.localeCompare(b.name, "pt-BR")),
    [data],
  );

  if (!allowed || !panel || !tabs) return null;

  return (
    <>
      {createPortal(
        <button
          type="button"
          data-vf-team-performance-tab="true"
          className={active ? "active" : ""}
          onClick={() => setActive(true)}
        >
          Desempenho da Equipe
        </button>,
        tabs,
      )}
      {active ? createPortal(
        <section className="vf-team-performance-panel" aria-live="polite">
          <header className="vf-team-performance-head">
            <div>
              <small>GESTÃO DE PESSOAS</small>
              <h4>Desempenho da Equipe</h4>
              <p>Indicadores gerenciais por liderança e usuário. Os dados só são consultados quando esta aba é aberta.</p>
            </div>
            <button type="button" disabled={loading} onClick={() => void loadPerformance(true)}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </header>

          {error ? <div className="vf-team-performance-error">{error}</div> : null}
          {loading && !data ? <div className="vf-team-performance-loading">Carregando desempenho da equipe…</div> : null}

          {data ? (
            <>
              <div className="vf-team-performance-kpis">
                <article><small>Lideranças ativas</small><b>{data.summary.leaders.toLocaleString("pt-BR")}</b></article>
                <article><small>Eleitores nas bases</small><b>{data.summary.voterContacts.toLocaleString("pt-BR")}</b></article>
                <article><small>Novos em 7 dias</small><b>+{data.summary.votersLast7Days.toLocaleString("pt-BR")}</b></article>
                <article><small>Sem novos eleitores</small><b>{data.summary.leadersWithoutRecentVoters.toLocaleString("pt-BR")}</b></article>
              </div>

              <section className="vf-team-performance-card">
                <div className="vf-team-performance-title">
                  <div><small>RADAR DAS LIDERANÇAS</small><h5>Quem está ampliando a base</h5></div>
                  <span>Atualizado em {formatDate(data.generatedAt)}</span>
                </div>
                <div className="vf-team-performance-leaders">
                  {leaders.length ? leaders.map((user, index) => (
                    <article key={user.id}>
                      <strong>{index + 1}. {user.name}</strong>
                      <span>{user.voterContacts.toLocaleString("pt-BR")} eleitores</span>
                      <span className={user.votersLast7Days > 0 ? "positive" : "idle"}>+{user.votersLast7Days.toLocaleString("pt-BR")} em 7 dias</span>
                      <span>{user.pendingContacts.toLocaleString("pt-BR")} pendências</span>
                      <small>{relativeActivity(user.lastVoterCreatedAt)}</small>
                    </article>
                  )) : <p>Nenhuma liderança ativa encontrada.</p>}
                </div>
              </section>

              <section className="vf-team-performance-card">
                <div className="vf-team-performance-title"><div><small>ACOMPANHAMENTO</small><h5>Atividade por usuário</h5></div></div>
                <div className="vf-team-performance-table-wrap">
                  <table>
                    <thead><tr><th>Usuário</th><th>Perfil</th><th>Eleitores</th><th>7 dias</th><th>Pendências</th><th>Última ação</th></tr></thead>
                    <tbody>
                      {data.users.map((user) => (
                        <tr key={user.id}>
                          <td><strong>{user.name}</strong></td>
                          <td>{roleLabel(user.role)}</td>
                          <td>{user.voterContacts.toLocaleString("pt-BR")}</td>
                          <td>+{user.votersLast7Days.toLocaleString("pt-BR")}</td>
                          <td>{user.pendingContacts.toLocaleString("pt-BR")}</td>
                          <td>{user.lastAction ? `${user.lastAction.action} · ${formatDate(user.lastAction.createdAt)}` : "Sem ação recente"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </section>,
        panel,
      ) : null}
    </>
  );
}
