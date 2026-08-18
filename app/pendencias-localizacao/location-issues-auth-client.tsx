"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiFetch, supabase } from "../supabase-client";
import LocationIssuesClient from "./location-issues-client";

type CurrentUser = {
  email: string;
  name: string;
  role: string;
};

const SESSION_TIMEOUT_MS = 15_000;

function timeoutAfter<T>(promise: Promise<T>, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), SESSION_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default function LocationIssuesAuthClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setMessage("");

    void timeoutAfter(
      supabase.auth.getSession(),
      "A sessão demorou para responder. Verifique sua conexão e tente novamente.",
    )
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (!data.session) window.location.replace("/contatos");
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível abrir sua sessão agora.");
        setBusy(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setAccount(null);
        window.location.replace("/contatos");
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [retryKey]);

  useEffect(() => {
    if (!session) return;

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);
    setBusy(true);
    setMessage("");

    void apiFetch("/api/session", { signal: controller.signal })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível validar esta conta.");
        setAccount(data.user);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? "A validação do acesso demorou para responder. Verifique sua conexão e tente novamente."
            : error instanceof Error
              ? error.message
              : "Não foi possível validar seu acesso agora.",
        );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setBusy(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [session]);

  if (account) return <LocationIssuesClient currentUser={account} />;

  if (message && !busy) {
    return (
      <main className="issues-shell">
        <section className="issues-panel issues-empty" role="alert">
          <b>Não foi possível abrir a Central de Qualidade</b>
          <p>{message}</p>
          <div>
            <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
              Tentar novamente
            </button>{" "}
            <button type="button" onClick={() => window.location.assign("/contatos")}>
              Voltar aos contatos
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="issues-shell">
      <section className="issues-panel issues-loading" role="status">
        {busy ? "Abrindo a Central de Qualidade…" : "Redirecionando para o acesso…"}
      </section>
    </main>
  );
}
