"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, supabase } from "./supabase-client";

type AccountSession = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  refreshedAt?: string | null;
  notAfter?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  aal?: string | null;
  current?: boolean;
};

type SessionPayload = {
  currentSessionId?: string | null;
  sessions?: AccountSession[];
  error?: string;
};

function deviceLabel(userAgent = "") {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Microsoft Edge"
    : ua.includes("chrome/") && !ua.includes("edg/")
      ? "Google Chrome"
      : ua.includes("firefox/")
        ? "Firefox"
        : ua.includes("safari/") && !ua.includes("chrome/")
          ? "Safari"
          : "Navegador";
  const device = ua.includes("iphone")
    ? "iPhone"
    : ua.includes("ipad")
      ? "iPad"
      : ua.includes("android")
        ? "Android"
        : ua.includes("windows")
          ? "Windows"
          : ua.includes("mac os") || ua.includes("macintosh")
            ? "Mac"
            : ua.includes("linux")
              ? "Linux"
              : "Dispositivo";
  return `${browser} em ${device}`;
}

function formatActivity(value?: string | null) {
  if (!value) return "Atividade não informada";
  const date = new Date(value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return "Atividade não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function AccountSessionSecurity() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/account-sessions", { cache: "no-store" });
      const data = (await response.json()) as SessionPayload;
      if (response.status === 403) {
        setAllowed(false);
        setSessions([]);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as sessões.");
      setAllowed(true);
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar as sessões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let currentHost: HTMLElement | null = null;

    const findHost = () => {
      const next = document.querySelector<HTMLElement>(".account-settings-content");
      if (next === currentHost) return;
      currentHost = next;
      setHost(next);
      if (next) void loadSessions();
    };

    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [loadSessions]);

  async function revoke(mode: "single" | "others" | "all", sessionId?: string) {
    const warning =
      mode === "all"
        ? "Isso encerrará esta sessão e todas as outras. Você precisará entrar novamente. Continuar?"
        : mode === "others"
          ? "Encerrar todas as outras sessões e manter apenas este dispositivo conectado?"
          : "Encerrar esta sessão em outro dispositivo?";
    if (!window.confirm(warning)) return;

    setBusyId(mode === "single" ? sessionId || "single" : mode);
    setMessage("");
    try {
      const response = await apiFetch("/api/account-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, sessionId: sessionId || null }),
      });
      const data = (await response.json()) as { revoked?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível encerrar a sessão.");

      if (mode === "all") {
        await supabase.auth.signOut({ scope: "local" });
        window.location.reload();
        return;
      }

      setMessage(
        mode === "others"
          ? "As outras sessões foram desconectadas."
          : "A sessão selecionada foi desconectada.",
      );
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    } finally {
      setBusyId("");
    }
  }

  if (!host || (!allowed && !loading && !message)) return null;

  return createPortal(
    <section className="account-settings-section account-session-security">
      <div className="account-session-heading">
        <div>
          <h3>Segurança e sessões ativas</h3>
          <p>Veja onde sua conta ADM está conectada e encerre acessos que você não reconhece.</p>
        </div>
        <button type="button" className="account-session-refresh" onClick={() => void loadSessions()} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {allowed && sessions.length > 0 && (
        <div className="account-session-list">
          {sessions.map((session) => {
            const activity = session.refreshedAt || session.updatedAt || session.createdAt;
            return (
              <article className={`account-session-card${session.current ? " current" : ""}`} key={session.id}>
                <div className="account-session-icon" aria-hidden="true">{session.userAgent?.toLowerCase().includes("mobile") || session.userAgent?.toLowerCase().includes("iphone") || session.userAgent?.toLowerCase().includes("android") ? "▯" : "▣"}</div>
                <div className="account-session-info">
                  <strong>{deviceLabel(session.userAgent || "")}</strong>
                  <span>{session.current ? "Esta sessão" : "Sessão ativa"}</span>
                  <small>Última atividade: {formatActivity(activity)}</small>
                  <small>IP: {session.ip || "não informado"}</small>
                </div>
                {!session.current && (
                  <button type="button" className="account-session-disconnect" disabled={Boolean(busyId)} onClick={() => void revoke("single", session.id)}>
                    {busyId === session.id ? "Desconectando…" : "Desconectar"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {allowed && !loading && sessions.length === 0 && (
        <p className="account-session-empty">Nenhuma sessão ativa foi encontrada.</p>
      )}

      {allowed && sessions.length > 0 && (
        <div className="account-session-actions">
          <button type="button" className="account-session-others" disabled={Boolean(busyId) || sessions.filter((item) => !item.current).length === 0} onClick={() => void revoke("others")}>
            {busyId === "others" ? "Desconectando…" : "Desconectar das outras sessões"}
          </button>
          <button type="button" className="account-session-all" disabled={Boolean(busyId)} onClick={() => void revoke("all")}>
            {busyId === "all" ? "Encerrando…" : "Sair de todos os dispositivos"}
          </button>
        </div>
      )}

      {message && <div className="account-session-message" role="status">{message}</div>}
    </section>,
    host,
  );
}
