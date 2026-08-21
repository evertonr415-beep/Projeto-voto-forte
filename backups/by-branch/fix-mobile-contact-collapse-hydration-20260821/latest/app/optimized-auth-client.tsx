"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import OptimizedDashboardClient from "./optimized-dashboard-client";
import type { CurrentUser } from "./dashboard-client";
import { apiFetch, supabase } from "./supabase-client";

const OFFICIAL_SITE_URL = "https://www.sistemavotoforte.com.br";

export default function OptimizedAuthClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setBusy(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
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
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${OFFICIAL_SITE_URL}/auth/reset-password`,
        });
        if (error) throw error;
        setMessage("Se o e-mail estiver cadastrado, você receberá o link de redefinição.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  if (busy && session && !account)
    return <main className="auth-page"><div className="auth-card">Carregando painel otimizado…</div></main>;

  if (account) return <OptimizedDashboardClient currentUser={account} />;

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <img src="/voto-forte-bandeira-icon.jpg" alt="VOTO FORTE PARANÁ" />
        <div>
          <small>VOTO FORTE PARANÁ</small>
          <h1>Gestão rápida para bases com mais de 100 mil contatos.</h1>
          <p>Paginação, busca no servidor e indicadores calculados sobre toda a base.</p>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <small>ACESSO À PLATAFORMA</small>
          <h2>{forgot ? "Redefinir senha" : "Bem-vindo"}</h2>
          <label>
            E-mail
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          {!forgot && (
            <label>
              Senha
              <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
          )}
          {message && <div className="auth-message" role="status">{message}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? "Aguarde…" : forgot ? "Enviar link" : "Entrar"}</button>
          <button type="button" className="auth-link" onClick={() => { setForgot((value) => !value); setMessage(""); }}>
            {forgot ? "Voltar para o acesso" : "Esqueci minha senha"}
          </button>
          <a className="auth-link" href="/sistema-completo">Abrir versão completa anterior</a>
        </form>
      </section>
    </main>
  );
}
