"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../supabase-client";

const LOGIN_URL = "https://www.sistemavotoforte.com.br/?confirmed=1";
const ERROR_URL = "https://www.sistemavotoforte.com.br/?confirmation_error=1";

export default function ConfirmEmailPage() {
  const [message, setMessage] = useState("Confirmando seu e-mail…");

  useEffect(() => {
    let cancelled = false;

    const finishConfirmation = async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const errorDescription = hash.get("error_description");
        if (errorDescription) throw new Error(errorDescription);

        // No fluxo implícito, o Supabase processa os tokens da URL e cria uma sessão.
        // Aguardamos brevemente esse processamento antes de encerrar a sessão.
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (data.session) {
            await supabase.auth.signOut();
            if (!cancelled) {
              setMessage("E-mail confirmado. Redirecionando para o login…");
              window.location.replace(LOGIN_URL);
            }
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }

        // Alguns modelos de e-mail confirmam a conta sem criar sessão local.
        if (!cancelled) window.location.replace(LOGIN_URL);
      } catch {
        if (!cancelled) window.location.replace(ERROR_URL);
      }
    };

    void finishConfirmation();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-card" role="status">
          <small>VOTO FORTE PARANÁ</small>
          <h2>Confirmação de cadastro</h2>
          <p>{message}</p>
        </div>
      </section>
    </main>
  );
}
