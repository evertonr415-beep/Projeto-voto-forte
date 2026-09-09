"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";

type Summary = {
  total: number;
  voters: number;
  leaders: number;
  meetings: number;
  districtsReached: number;
};

type SessionUser = {
  email?: string;
  role?: string;
};

const ADMIN_ROLES = new Set(["master", "gestor", "lider", "admin"]);
const numberFormatter = new Intl.NumberFormat("pt-BR");
const REFRESH_INTERVAL_MS = 60_000;

function isLegacyDashboardPath() {
  return (
    window.location.pathname === "/" ||
    window.location.pathname.startsWith("/sistema-completo")
  );
}

export default function ExactLegacyMetrics() {
  const [fallbackScope, setFallbackScope] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const requestVersion = useRef(0);
  const activeScope = useRef("");

  useEffect(() => {
    if (!isLegacyDashboardPath()) return;
    let active = true;

    void apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active || !response.ok) return;
        const user = data.user as SessionUser | undefined;
        const email = String(user?.email ?? "").trim().toLowerCase();
        const role = String(user?.role ?? "").trim().toLowerCase();
        if (!email) return;
        setFallbackScope(ADMIN_ROLES.has(role) ? "all" : email);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const loadSummary = useCallback(async (scope: string) => {
    const version = ++requestVersion.current;
    try {
      const response = await apiFetch(
        `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as Partial<Summary> & { error?: string };
      if (!response.ok) throw new Error(data.error || "Falha ao carregar resumo");
      if (version !== requestVersion.current) return;
      setSummary({
        total: Number(data.total ?? 0),
        voters: Number(data.voters ?? 0),
        leaders: Number(data.leaders ?? 0),
        meetings: Number(data.meetings ?? 0),
        districtsReached: Number(data.districtsReached ?? 0),
      });
    } catch {
      // O painel legado permanece funcional com seus dados locais se o resumo falhar.
    }
  }, []);

  useEffect(() => {
    if (!fallbackScope || !isLegacyDashboardPath()) return;

    const getScope = () =>
      document.querySelector<HTMLSelectElement>(".scope-picker select")?.value ||
      fallbackScope;

    const refresh = (force = false) => {
      const nextScope = getScope();
      if (!nextScope || (!force && nextScope === activeScope.current)) return;
      activeScope.current = nextScope;
      void loadSummary(nextScope);
    };

    const handleChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      activeScope.current = "";
      refresh();
    };

    const handleRefresh = () => refresh(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh(true);
    };

    document.addEventListener("change", handleChange, true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("voto-forte:records-changed", handleRefresh);
    window.addEventListener("voto-forte:geocoding-complete", handleRefresh);

    refresh();
    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        handleRefresh();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("voto-forte:records-changed", handleRefresh);
      window.removeEventListener("voto-forte:geocoding-complete", handleRefresh);
    };
  }, [fallbackScope, loadSummary]);

  useEffect(() => {
    if (!summary || !isLegacyDashboardPath()) return;

    const patchKpis = () => {
      const exactValues = new Map<string, number>([
        ["Eleitores cadastrados", summary.voters],
        ["Lideranças ativas", summary.leaders],
        ["Bairros alcançados", summary.districtsReached],
        ["Reuniões agendadas", summary.meetings],
      ]);

      document.querySelectorAll<HTMLElement>(".kpis .kpi").forEach((card) => {
        const label = card.querySelector("b")?.textContent?.trim();
        if (!label) return;
        const exactValue = exactValues.get(label);
        if (exactValue === undefined) return;
        const valueNode = card.querySelector<HTMLElement>("strong");
        if (!valueNode) return;
        const formatted = numberFormatter.format(exactValue);
        if (valueNode.textContent !== formatted) valueNode.textContent = formatted;
      });

      document
        .querySelectorAll<HTMLElement>("[data-vf-total-contacts]")
        .forEach((node) => {
          const formatted = numberFormatter.format(summary.total);
          if (node.textContent !== formatted) node.textContent = formatted;
        });
    };

    const observeWorkspace = (workspace: HTMLElement) => {
      patchKpis();
      const observer = new MutationObserver(patchKpis);
      observer.observe(workspace, { childList: true, subtree: true });
      return observer;
    };

    const workspace = document.querySelector<HTMLElement>(".workspace");
    if (workspace) {
      const observer = observeWorkspace(workspace);
      return () => observer.disconnect();
    }

    let workspaceObserver: MutationObserver | null = null;
    const bodyObserver = new MutationObserver(() => {
      const nextWorkspace = document.querySelector<HTMLElement>(".workspace");
      if (!nextWorkspace) return;
      bodyObserver.disconnect();
      workspaceObserver = observeWorkspace(nextWorkspace);
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      bodyObserver.disconnect();
      workspaceObserver?.disconnect();
    };
  }, [summary]);

  return null;
}
