"use client";

import { useEffect, useState } from "react";
import { apiFetch, supabase } from "../supabase-client";
import SystemIntelligenceClient from "./system-intelligence-client";
import NeuralBackNavigation from "./neural-back-navigation";

type SessionUser = {
  role?: string;
  accessRole?: string;
};

export default function SystemIntelligencePage() {
  const [accessReady, setAccessReady] = useState(false);

  useEffect(() => {
    let active = true;
    let validationInFlight = false;

    const validateAccess = async () => {
      if (!active || validationInFlight) return;
      validationInFlight = true;

      try {
        const response = await apiFetch("/api/session");
        const payload = (await response.json()) as { user?: SessionUser };
        if (!active) return;

        if (!response.ok || !payload.user) {
          window.location.replace("/contatos");
          return;
        }

        const role = String(payload.user.role ?? "");
        const accessRole = String(payload.user.accessRole ?? "");
        if (role !== "master" || accessRole === "gestor") {
          window.location.replace("/sistema-completo");
          return;
        }

        setAccessReady(true);
      } catch {
        if (active) window.location.replace("/contatos");
      } finally {
        validationInFlight = false;
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        window.location.replace("/contatos");
        return;
      }
      void validateAccess();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace("/contatos");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      {accessReady ? (
        <SystemIntelligenceClient />
      ) : (
        <main className="system-intelligence-state" aria-live="polite">
          <section className="system-intelligence-state-card" role="status">
            <div className="system-intelligence-spinner" aria-hidden="true" />
            <strong>Confirmando acesso ao VOTO FORTE Neural…</strong>
            <p>Validando sua sessão e o perfil Master antes de carregar a análise.</p>
          </section>
        </main>
      )}
      <NeuralBackNavigation />
    </>
  );
}
