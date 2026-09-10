"use client";

import dynamic from "next/dynamic";
import React, { Component, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { CurrentUser } from "./dashboard-client";
import { apiFetch, supabase } from "./supabase-client";

type Mode = "login" | "signup" | "forgot" | "recovery";
type DashboardMode = "full" | "neutral";
type SessionAccessState =
  | "active"
  | "profile_inactive"
  | "email_unconfirmed"
  | "invitation_ready"
  | "awaiting_adm_activation";
type SessionAccessStatus = {
  state: SessionAccessState;
  message: string;
  suggestedAction?: string;
  canEnterApplication?: boolean;
  canClaimInvitation?: boolean;
  requiresAdmReview?: boolean;
  email?: string;
  emailConfirmed?: boolean;
};

type SessionResponse = {
  access?: SessionAccessStatus;
  user?: CurrentUser;
  error?: string;
};

class SafeDashboardBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("Dashboard caught by safe boundary:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const DashboardClient = dynamic(() => import("./dashboard-client"), {
  ssr: false,
  loading: () => (
    <main className="auth-page">
      <div className="auth-card">Preparando seu ambiente…</div>
    </main>
  ),
});

const NeutralDashboardClient = dynamic(() => import("./neutral-dashboard-client"), {
  ssr: false,
  loading: () => (
    <main className="auth-page">
      <div className="auth-card">Preparando seu ambiente…</div>
    </main>
  ),
});

const OFFICIAL_SITE_URL = "https://www.sistemavotoforte.com.br";
const EMAIL_CONFIRMATION_URL = `${OFFICIAL_SITE_URL}/auth/confirm`;
const SESSION_VALIDATION_TIMEOUT_MS = 15_000;
const SESSION_VALIDATION_MAX_ATTEMPTS = 3;
const SESSION_VALIDATION_RETRY_DELAYS_MS = [0, 700, 1_400] as const;

function isRetryableSessionStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function waitForSessionRetry(delayMs: number) {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

export default function AuthClient({
  dashboardMode = "full",
}: {
  dashboardMode?: DashboardMode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [accessStatus, setAccessStatus] = useState<SessionAccessStatus | null>(
    null,
  );
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const bootstrapSessionKey = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      setMode("login");
      setMessage("E-mail confirmado com sucesso. Agora entre com seu e-mail e senha.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("confirmation_error") === "1") {
      setMode("login");
      setMessage("Não foi possível confirmar o e-mail. Solicite um novo cadastro ou tente novamente.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("password_reset") === "1") {
      setMode("login");
      setMessage("Senha alterada com sucesso. Entre com sua nova senha.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applySessionState = (next: Session | null) => {
      setSession(next);
      if (!next) {
        setAccount(null);
        setAccessStatus(null);
        setBusy(false);
      } else {
        setAccount(null);
        setAccessStatus(null);
        setBusy(true);
      }
    };

    const applyBootstrapSession = (next: Session | null) => {
      const nextKey = next?.access_token || null;
      if (bootstrapSessionKey.current === nextKey) return;
      bootstrapSessionKey.current = nextKey;
      applySessionState(next);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        applyBootstrapSession(data.session);
      })
      .catch(() => {
        if (cancelled) return;
        setBusy(false);
        setMessage(
          "Não foi possível verificar sua sessão agora. Confira sua conexão e tente entrar novamente.",
        );
      });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
      if (event === "INITIAL_SESSION") {
        applyBootstrapSession(next);
        return;
      }
      applySessionState(next);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    let activeController: AbortController | null = null;

    setBusy(true);
    setMessage("");

    const validateSession = async () => {
      let lastFailureTimedOut = false;

      for (let attempt = 0; attempt < SESSION_VALIDATION_MAX_ATTEMPTS; attempt += 1) {
        const retryDelay = SESSION_VALIDATION_RETRY_DELAYS_MS[attempt] ?? 0;
        await waitForSessionRetry(retryDelay);
        if (cancelled) return;

        const controller = new AbortController();
        activeController = controller;
        let timedOut = false;
        const timeoutId = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, SESSION_VALIDATION_TIMEOUT_MS);

        try {
          const response = await apiFetch("/api/session", {
            signal: controller.signal,
            cache: "no-store",
          });
          const data = (await response
            .json()
            .catch(() => ({}))) as SessionResponse;

          if (cancelled) return;

          if (response.status === 401) {
            setMessage(data.error || "Sua sessão expirou. Entre novamente.");
            void supabase.auth.signOut();
            return;
          }

          if (!response.ok) {
            const canRetry =
              isRetryableSessionStatus(response.status) &&
              attempt < SESSION_VALIDATION_MAX_ATTEMPTS - 1;
            if (canRetry) continue;

            if (data.access) setAccessStatus(data.access);
            setMessage(data.error || "Não foi possível validar esta conta agora.");
            return;
          }

          if (data.access?.state === "active" && data.user) {
            setAccessStatus(data.access);
            setAccount(data.user);
            setMessage("");
            return;
          }

          setAccount(null);
          setAccessStatus(data.access || null);
          setMessage(data.access?.message || "Não foi possível liberar este acesso.");
          return;
        } catch {
          if (cancelled) return;
          lastFailureTimedOut = timedOut;

          if (attempt < SESSION_VALIDATION_MAX_ATTEMPTS - 1) {
            continue;
          }

          setMessage(
            lastFailureTimedOut
              ? "A validação demorou mais que o esperado mesmo após novas tentativas. Confira sua conexão e tente novamente."
              : "Sua conexão oscilou durante a validação. Tentamos novamente automaticamente, mas não foi possível concluir agora.",
          );
          return;
        } finally {
          window.clearTimeout(timeoutId);
          if (activeController === controller) activeController = null;
        }
      }
    };

    void validateSession().finally(() => {
      if (!cancelled) setBusy(false);
    });

    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [session, validationAttempt]);

  async function activateInvitation() {
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/session", { method: "POST" });
      const data = (await response.json()) as SessionResponse;
      if (response.status === 401) {
        setMessage(data.error || "Sua sessão expirou. Entre novamente.");
        await supabase.auth.signOut();
        return;
      }
      if (!response.ok) {
        if (data.access) setAccessStatus(data.access);
        setMessage(data.error || data.access?.message || "Não foi possível ativar o acesso.");
        return;
      }
      if (data.access?.state === "active" && data.user) {
        setAccessStatus(data.access);
        setAccount(data.user);
        setMessage("");
        return;
      }
      setAccessStatus(data.access || null);
      setMessage(data.access?.message || "O acesso ainda não foi liberado.");
    } catch {
      setMessage("Não foi possível ativar seu acesso agora.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setAccessStatus(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password !== passwordConfirmation)
          throw new Error("As senhas informadas não são iguais.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: EMAIL_CONFIRMATION_URL,
          },
        });
        if (error) throw error;
        setMessage(
          data.session
            ? "Conta criada com sucesso. Preparando seu ambiente…"
            : "Conta criada. Enviamos um link de confirmação para seu e-mail. Após confirmar, você será direcionado para a tela de login.",
        );
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${OFFICIAL_SITE_URL}/auth/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "Se o e-mail estiver cadastrado, você receberá um link seguro para redefinir a senha.",
        );
      } else {
        if (password.length < 8)
          throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut();
        setMode("login");
        setPassword("");
        setMessage("Senha alterada com sucesso. Entre novamente.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a solicitação.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (busy && session && !account)
    return (
      <main className="auth-page">
        <div className="auth-card">Validando acesso protegido…</div>
      </main>
    );

  if (account) {
    return dashboardMode === "neutral" ? (
      <NeutralDashboardClient currentUser={account} />
    ) : (
      <SafeDashboardBoundary fallback={<NeutralDashboardClient currentUser={account} />}>
        <DashboardClient currentUser={account} />
      </SafeDashboardBoundary>
    );
  }

  if (session && !accessStatus) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-card">
            <small>VALIDAÇÃO DO ACESSO</small>
            <h2>Não foi possível concluir a validação</h2>
            <p>
              Sua sessão continua protegida. Nenhum acesso ao sistema é liberado
              enquanto a validação não terminar com sucesso.
            </p>
            {message && (
              <div className="auth-message" role="status">
                {message}
              </div>
            )}
            <button
              type="button"
              className="auth-submit"
              onClick={() => setValidationAttempt((value) => value + 1)}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => void supabase.auth.signOut()}
            >
              Sair desta conta
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (session && accessStatus && accessStatus.state !== "active") {
    const accessTitle =
      accessStatus.state === "invitation_ready"
        ? "Acesso pronto para ativação"
        : accessStatus.state === "profile_inactive"
          ? "Acesso temporariamente inativo"
          : accessStatus.state === "email_unconfirmed"
            ? "Confirme seu e-mail"
            : "Aguardando habilitação do ADM";

    return (
      <main className="auth-page">
        <section className="auth-hero">
          <img src="/voto-forte-bandeira-icon.jpg" alt="VOTO FORTE PARANÁ" />
          <div>
            <small>VOTO FORTE PARANÁ</small>
            <h1>Seu login foi autenticado.</h1>
            <p>O acesso ao ambiente segue o vínculo e as permissões definidos no VOTO FORTE.</p>
          </div>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <small>STATUS DO ACESSO</small>
            <h2>{accessTitle}</h2>
            <p>{accessStatus.message}</p>
            {accessStatus.email && (
              <div className="auth-message" role="status">
                Conta autenticada: {accessStatus.email}
              </div>
            )}
            {message && message !== accessStatus.message && (
              <div className="auth-message" role="status">
                {message}
              </div>
            )}
            {accessStatus.state === "invitation_ready" && (
              <button
                type="button"
                className="auth-submit"
                disabled={busy}
                onClick={() => void activateInvitation()}
              >
                {busy ? "Ativando…" : "Ativar meu acesso"}
              </button>
            )}
            <button
              type="button"
              className="auth-link"
              onClick={() => void supabase.auth.signOut()}
            >
              Sair desta conta
            </button>
          </div>
        </section>
      </main>
    );
  }

  const title =
    mode === "login"
      ? "Bem-vindo"
      : mode === "signup"
        ? "Criar minha conta"
        : mode === "forgot"
          ? "Esqueci minha senha"
          : "Criar nova senha";

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <img src="/voto-forte-bandeira-icon.jpg" alt="VOTO FORTE PARANÁ" />
        <div>
          <small>VOTO FORTE PARANÁ</small>
          <h1>Gestão eleitoral segura e organizada.</h1>
          <p>
            Cada usuário acessa somente o próprio ambiente. Administradores acompanham a operação consolidada.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <small>ACESSO À PLATAFORMA</small>
          {(mode === "login" || mode === "signup") && (
            <div className="auth-tabs" role="tablist" aria-label="Escolha a forma de acesso">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                Criar conta
              </button>
            </div>
          )}
          <h2>{title}</h2>
          <p>
            {mode === "forgot"
              ? "Informe seu e-mail para receber o link temporário de redefinição."
              : mode === "recovery"
                ? "Digite uma nova senha segura para sua conta."
                : mode === "signup"
                  ? "Use exatamente o e-mail que recebeu acesso pela Administração e confirme-o para ativar seu vínculo no VOTO FORTE."
                  : "Acesse com seu e-mail e senha."}
          </p>
          {mode === "signup" && (
            <label>
              Nome completo
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          {mode !== "recovery" && (
            <label>
              E-mail
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              {mode === "recovery" ? "Nova senha" : "Senha"}
              <input
                required
                minLength={8}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Confirmar senha
              <input
                required
                minLength={8}
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          )}
          {message && (
            <div className="auth-message" role="status">
              {message}
            </div>
          )}
          <button className="auth-submit" disabled={busy}>
            {busy
              ? "Aguarde…"
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar minha conta"
                  : mode === "forgot"
                    ? "Enviar link seguro"
                    : "Salvar nova senha"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setMode("forgot");
                setMessage("");
              }}
            >
              Esqueci minha senha
            </button>
          )}
          {mode !== "login" && mode !== "signup" && mode !== "recovery" && (
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Voltar para o acesso
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
