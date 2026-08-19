"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase-client";

const LOGIN_URL = "https://www.sistemavotoforte.com.br/?password_reset=1";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("Validando o link seguro…");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const validateRecovery = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const errorDescription = hash.get("error_description") || query.get("error_description");

      if (errorDescription) {
        if (!cancelled) {
          setInvalid(true);
          setMessage("Este link de recuperação é inválido ou expirou.");
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session && !cancelled) {
        setReady(true);
        setMessage("Digite e confirme sua nova senha.");
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session && !cancelled) {
          setReady(true);
          setMessage("Digite e confirme sua nova senha.");
        }
      });

      window.setTimeout(async () => {
        if (cancelled) return;
        const { data: latest } = await supabase.auth.getSession();
        if (!latest.session) {
          setInvalid(true);
          setMessage("Este link de recuperação é inválido ou expirou.");
        }
      }, 5000);

      return () => listener.subscription.unsubscribe();
    };

    const cleanupPromise = validateRecovery();
    return () => {
      cancelled = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas informadas não são iguais.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.replace(LOGIN_URL);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar a senha. Solicite um novo link.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <img src="/parana-icon-small.jpg" alt="Mapa do Paraná" />
        <div>
          <small>VOTO FORTE PARANÁ</small>
          <h1>Redefinição segura de senha.</h1>
          <p>Crie uma nova senha para recuperar o acesso ao seu ambiente.</p>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <small>RECUPERAÇÃO DE ACESSO</small>
          <h2>Criar nova senha</h2>
          <p>{message}</p>

          {ready && !invalid && (
            <>
              <label>
                Nova senha
                <input
                  required
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <label>
                Confirmar nova senha
                <input
                  required
                  minLength={8}
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                />
              </label>

              <button className="auth-submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar nova senha"}
              </button>
            </>
          )}

          {invalid && (
            <a className="auth-submit" href="https://www.sistemavotoforte.com.br">
              Solicitar novo link
            </a>
          )}
        </form>
      </section>
    </main>
  );
}
