"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type Municipality = {
  id: number;
  name: string;
  state: string;
  accessRole: string;
  isDefault: boolean;
};

type Context = {
  currentMunicipalityId: number;
  municipalities: Municipality[];
  isGeneralAdm: boolean;
  canSwitchMunicipality?: boolean;
};

type Overview = {
  id: number;
  name: string;
  state: string;
  contacts: number;
  users: number;
  lastActivity?: string | null;
};

export default function MunicipalityContextEnhancer() {
  const [context, setContext] = useState<Context | null>(null);
  const [overview, setOverview] = useState<Overview[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/municipality-context")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled || response.status === 401) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o município.");
        setContext(data.context || null);
        setOverview(Array.isArray(data.overview) ? data.overview : []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1000px)");

    const findHeaderHost = () => {
      if (!media.matches) {
        setHeaderHost(null);
        return;
      }
      const host = document.querySelector<HTMLElement>(
        ".top-actions, .optimized-hero-controls",
      );
      setHeaderHost((current) => current === host ? current : host);
    };

    findHeaderHost();
    const observer = new MutationObserver(findHeaderHost);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", findHeaderHost);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", findHeaderHost);
    };
  }, []);

  const current = useMemo(
    () => context?.municipalities.find((item) => Number(item.id) === Number(context.currentMunicipalityId)) || context?.municipalities[0],
    [context],
  );

  const desktopItems = useMemo<Overview[]>(() => {
    if (overview.length) return overview;
    return (context?.municipalities || []).map((item) => ({
      id: item.id,
      name: item.name,
      state: item.state,
      contacts: 0,
      users: 0,
    }));
  }, [context, overview]);

  async function switchMunicipality(value: string) {
    if (!context?.isGeneralAdm || context.canSwitchMunicipality === false) return;
    const municipalityId = Number(value);
    if (!Number.isInteger(municipalityId) || municipalityId === Number(context.currentMunicipalityId)) return;
    setBusy(true);
    setMessage("Trocando município…");
    try {
      const response = await apiFetch("/api/municipality-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ municipalityId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível trocar o município.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível trocar o município.");
      setBusy(false);
    }
  }

  if (!context || !current) return null;

  if (headerHost) {
    const headerControl = context.isGeneralAdm && desktopItems.length > 1 ? (
      <details className="vf-municipality-header-menu">
        <summary aria-label={`Município atual: ${current.name} - ${current.state}`}>
          <span>{current.name} - {current.state}</span>
          <i aria-hidden="true">⌄</i>
        </summary>
        <div className="vf-municipality-header-popover">
          <header>
            <small>VISÃO ESTADUAL</small>
            <b>{desktopItems.length} município(s)</b>
          </header>
          <div className="vf-municipality-header-list">
            {desktopItems.map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={busy || Number(item.id) === Number(context.currentMunicipalityId)}
                className={Number(item.id) === Number(context.currentMunicipalityId) ? "active" : ""}
                onClick={() => void switchMunicipality(String(item.id))}
              >
                <span><b>{item.name}</b><small>{item.state}</small></span>
                <span><b>{Number(item.contacts || 0).toLocaleString("pt-BR")}</b><small>contatos</small></span>
                <span><b>{Number(item.users || 0).toLocaleString("pt-BR")}</b><small>usuários</small></span>
              </button>
            ))}
          </div>
          {message && <small className="vf-municipality-header-message">{message}</small>}
        </div>
      </details>
    ) : (
      <div className="vf-municipality-header-badge" aria-label="Município atual">
        {current.name} - {current.state}
      </div>
    );

    return createPortal(headerControl, headerHost);
  }

  return (
    <aside className="vf-municipality-context" aria-label="Contexto municipal">
      <div className="vf-municipality-current">
        <small>{context.isGeneralAdm ? "CENTRAL VOTO FORTE" : "MUNICÍPIO"}</small>
        <strong>{current.name} - {current.state}</strong>
        {context.isGeneralAdm && context.municipalities.length > 1 && (
          <select
            aria-label="Trocar município"
            disabled={busy}
            value={context.currentMunicipalityId}
            onChange={(event) => void switchMunicipality(event.target.value)}
          >
            {context.municipalities.map((item) => (
              <option key={item.id} value={item.id}>{item.name} - {item.state}</option>
            ))}
          </select>
        )}
      </div>
      {context.isGeneralAdm && overview.length > 0 && (
        <details className="vf-municipality-overview">
          <summary>Visão estadual · {overview.length} município(s)</summary>
          <div>
            {overview.map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={busy}
                className={Number(item.id) === Number(context.currentMunicipalityId) ? "active" : ""}
                onClick={() => void switchMunicipality(String(item.id))}
              >
                <span><b>{item.name}</b><small>{item.state}</small></span>
                <span><b>{Number(item.contacts || 0).toLocaleString("pt-BR")}</b><small>contatos</small></span>
                <span><b>{Number(item.users || 0).toLocaleString("pt-BR")}</b><small>usuários</small></span>
              </button>
            ))}
          </div>
        </details>
      )}
      {message && <small className="vf-municipality-context-message">{message}</small>}
    </aside>
  );
}
