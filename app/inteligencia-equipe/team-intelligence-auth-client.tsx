"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiFetch, supabase } from "../supabase-client";

type MetricUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  createdContacts: number;
  updatedContacts: number;
  pendingContacts: number;
  totalContacts: number;
  lastSeenAt: string | null;
  lastAction: {
    action: string;
    detail: string;
    createdAt: string;
  } | null;
  recentActions: {
    action: string;
    detail: string;
    createdAt: string;
  }[];
};

type Data = {
  summary: {
    users: number;
    createdContacts: number;
    updatedContacts: number;
    pendingContacts: number;
  };
  users: MetricUser[];
};

function formatDate(value: string | null) {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

export default function TeamIntelligenceAuthClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) window.location.replace("/contatos");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) window.location.replace("/contatos");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    void apiFetch("/api/team-intelligence")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || "Falha ao carregar inteligência da equipe");
        setData(data);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao carregar dados"))
      .finally(() => setBusy(false));
  }, [session]);

  if (busy || !data) {
    return (
      <main className="issues-shell">
        <section className="issues-panel issues-loading">{error || "Analisando a equipe…"}</section>
      </main>
    );
  }

  return (
    <main className="issues-shell">
      <header className="issues-header">
        <div className="issues-header-copy">
          <span className="issues-eyebrow">GESTÃO INTELIGENTE</span>
          <h1>Inteligência da equipe</h1>
          <p>Veja quem cadastrou, quem atualizou, última ação e pendências por usuário.</p>
        </div>
        <div className="issues-actions">
          <a href="/contatos">Voltar ao painel</a>
        </div>
      </header>

      <section className="issues-kpis">
        <article><span className="issues-kpi-label">Usuários</span><b>{data.summary.users}</b></article>
        <article><span className="issues-kpi-label">Cadastros</span><b>{data.summary.createdContacts.toLocaleString("pt-BR")}</b></article>
        <article><span className="issues-kpi-label">Atualizações</span><b>{data.summary.updatedContacts.toLocaleString("pt-BR")}</b></article>
        <article className="warning"><span className="issues-kpi-label">Pendências</span><b>{data.summary.pendingContacts.toLocaleString("pt-BR")}</b></article>
      </section>

      <section className="issues-panel">
        <div className="issues-toolbar-heading">
          <span className="issues-section-label">ACOMPANHAMENTO</span>
          <h2>Desempenho por usuário</h2>
          <p>Histórico baseado nas ações registradas pelo sistema.</p>
        </div>

        <div className="issues-table-wrap" style={{ marginTop: 18 }}>
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Cadastrou</th>
                <th>Atualizou</th>
                <th>Pendências</th>
                <th>Última ação</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Usuário"><b>{user.name}</b><small>{roleLabel(user.role)} · {user.email}</small></td>
                  <td data-label="Cadastrou"><b>{user.createdContacts.toLocaleString("pt-BR")}</b><small>{user.totalContacts.toLocaleString("pt-BR")} na base</small></td>
                  <td data-label="Atualizou"><b>{user.updatedContacts.toLocaleString("pt-BR")}</b></td>
                  <td data-label="Pendências"><b>{user.pendingContacts.toLocaleString("pt-BR")}</b></td>
                  <td data-label="Última ação"><b>{user.lastAction?.action || "Sem ação"}</b><small>{formatDate(user.lastAction?.createdAt ?? null)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
