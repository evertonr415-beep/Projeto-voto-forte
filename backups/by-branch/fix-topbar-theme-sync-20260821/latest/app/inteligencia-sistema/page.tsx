"use client";

import { useEffect, useState } from "react";
import { supabase } from "../supabase-client";
import SystemIntelligenceClient from "./system-intelligence-client";
import NeuralBackNavigation from "./neural-back-navigation";

export default function SystemIntelligencePage() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "INITIAL_SESSION") {
        if (session) {
          setSessionReady(true);
        } else {
          window.location.replace("/contatos");
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        window.location.replace("/contatos");
        return;
      }

      if (session) setSessionReady(true);
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
