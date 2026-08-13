"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase-client";
import SystemIntelligenceClient from "./system-intelligence-client";
import NeuralBackNavigation from "./neural-back-navigation";

export default function SystemIntelligencePage() {
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
        <SystemIntelligenceClient />
      ) : (
        <main className="system-intelligence-state" aria-live="polite">
          <section className="system-intelligence-state-card" role="status">
            <div className="system-intelligence-spinner" aria-hidden="true" />
            <strong>Confirmando sessão…</strong>
            <p>Preparando o acesso à Inteligência do Sistema.</p>
          </section>
        </main>
      )}
      <NeuralBackNavigation />
    </>
  );
}
