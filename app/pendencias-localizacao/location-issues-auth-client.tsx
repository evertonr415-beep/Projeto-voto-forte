"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../supabase-client";
import LocationIssuesClient from "./location-issues-client";
import "./quality-readonly.css";

type CurrentUser = {
  email: string;
  name: string;
  role: string;
  accessRole?: string;
};

const QUALITY_ACCESS_ROLES = new Set(["adm", "gestor"]);

export default function LocationIssuesAuthClient() {
  const [account, setAccount] = useState<CurrentUser | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    setBusy(true);
    setMessage("");

    void apiFetch("/api/session", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok || !data.user) {
          window.location.replace("/");
          return;
        }

        const accessRole = String(data.user.accessRole || "").trim().toLowerCase();
        if (!QUALITY_ACCESS_ROLES.has(accessRole)) {
          window.location.replace("/");
          return;
        }

        setAccount({ ...data.user, accessRole });
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
        window.clearTimeout(timer);
        if (active) setBusy(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [retryKey]);

  useEffect(() => {
    const readOnly = account?.accessRole === "gestor";
    document.documentElement.classList.toggle("vf-quality-readonly", readOnly);
    return () => document.documentElement.classList.remove("vf-quality-readonly");
  }, [account]);

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
            <button type="button" onClick={() => window.location.assign("/")}>
              Voltar ao sistema
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="issues-shell">
      <section className="issues-panel issues-loading" role="status">
        {busy ? "Validando acesso à Central de Qualidade…" : "Redirecionando para o sistema…"}
      </section>
    </main>
  );
}
