"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase-client";
import TeamIntelligenceAuthClient from "./team-intelligence-auth-client";
import TeamBackNavigation from "./team-back-navigation";

export default function TeamIntelligencePage() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setSessionReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      {sessionReady ? (
        <TeamIntelligenceAuthClient />
      ) : (
        <main className="team-intelligence-state" aria-live="polite">
          <section className="team-intelligence-state-card" role="status">
            <div className="team-intelligence-spinner" aria-hidden="true" />
            <strong>Confirmando sessão…</strong>
            <p>Preparando o acesso à Inteligência da Equipe.</p>
          </section>
        </main>
      )}
      <TeamBackNavigation />
    </>
  );
}
