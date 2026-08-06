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

export default function LocationIssuesAuthClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) {
        window.location.replace("/contatos");
      }
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
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    setBusy(true);
    setMessage("");

    void apiFetch("/api/session")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível validar esta conta.");
        setAccount(data.user);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Não foi possível validar seu acesso agora.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (account) return <LocationIssuesClient currentUser={account} />;

  return (
    <main className="issues-shell">
      <section className="issues-panel issues-loading" role="status">
        {message || (busy ? "Abrindo a Central de Qualidade…" : "Redirecionando para o acesso…")}
      </section>
    </main>
  );
}
