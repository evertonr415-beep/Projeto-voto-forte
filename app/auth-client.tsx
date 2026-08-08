"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import NeutralDashboardClient from "./neutral-dashboard-client";
import { apiFetch, supabase } from "./supabase-client";

type Mode = "login" | "signup" | "forgot" | "recovery";

type CurrentUser = {
  email: string;
  name: string;
  role: string;
};

const OFFICIAL_SITE_URL = "https://www.sistemavotoforte.com.br";
const EMAIL_CONFIRMATION_URL = `${OFFICIAL_SITE_URL}/auth/confirm`;

export default function AuthClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      setMode("login");
      setMessage("E-mail confirmado com sucesso. Agora entre com seu e-mail e senha.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setBusy(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_, next) => {
      setSession(next);
      if (!next) {
        setAccount(null);
        setBusy(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setBusy(true);
    apiFetch("/api/session")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.ok) setAccount(data.user);
        else {
          setMessage(data.error || "Não foi possível validar esta conta.");
          void supabase.auth.signOut();
        }
      })
      .catch(() => setMessage("Não foi possível validar seu acesso agora."))
      .finally(() => setBusy(false));
  }, [session]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
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
          options: { data: { name }, emailRedirectTo: EMAIL_CONFIRMATION_URL },
        });
        if (error) throw error;
        setMessage(
          data.session
            ? "Conta criada com sucesso. Preparando seu ambiente…"
            : "Conta criada. Enviamos um link de confirmação para seu e-mail.",
        );
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${OFFICIAL_SITE_URL}/auth/reset-password`,
        });
        if (error) throw error;
        setMessage("Se o e-mail estiver cadastrado, você receberá o link seguro.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut();
        setMode("login");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  if (busy && session && !account)
    return <main className="auth-page"><div className="auth-card">Validando acesso protegido…</div></main>;
  if (account) return <NeutralDashboardClient currentUser={account} />;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <small>ACESSO À PLATAFORMA</small>
          <h2>{mode === "login" ? "Bem-vindo" : "Acesso"}</h2>
          {mode !== "recovery" && <label>E-mail<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
          {mode !== "forgot" && <label>Senha<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
          {mode === "signup" && <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>}
          {mode === "signup" && <label>Confirmar senha<input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} /></label>}
          {message && <div className="auth-message">{message}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? "Aguarde…" : "Continuar"}</button>
          <button type="button" className="auth-link" onClick={() => setMode(mode === "login" ? "forgot" : "login")}>{mode === "login" ? "Esqueci minha senha" : "Voltar"}</button>
        </form>
      </section>
    </main>
  );
}
