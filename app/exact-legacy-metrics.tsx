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

export default function ExactLegacyMetrics() {
  const [fallbackScope, setFallbackScope] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;

    void apiFetch("/api/session")
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
      // O painel legado continua disponível com seus dados locais se o resumo falhar.
    }
  }, []);

  useEffect(() => {
    if (!fallbackScope) return;

    let currentScope = "";
    const getScope = () =>
      document.querySelector<HTMLSelectElement>(".scope-picker select")?.value ||
      fallbackScope;

    const refresh = (force = false) => {
      const nextScope = getScope();
      if (!nextScope || (!force && nextScope === currentScope)) return;
      currentScope = nextScope;
      void loadSummary(nextScope);
    };

    const handleChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      currentScope = "";
      refresh();
    };

    const handleRecordsChanged = () => refresh(true);

    document.addEventListener("change", handleChange, true);
    window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
    window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);

    const observer = new MutationObserver(() => refresh());
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();

    return () => {
      observer.disconnect();
      document.removeEventListener("change", handleChange, true);
      window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
    };
  }, [fallbackScope, loadSummary]);

  useEffect(() => {
    if (!summary) return;

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
        if (valueNode) valueNode.textContent = numberFormatter.format(exactValue);
      });

      document
        .querySelectorAll<HTMLElement>("[data-vf-total-contacts]")
        .forEach((node) => {
          node.textContent = numberFormatter.format(summary.total);
        });
    };

    patchKpis();
    const observer = new MutationObserver(patchKpis);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [summary]);

  return null;
}
