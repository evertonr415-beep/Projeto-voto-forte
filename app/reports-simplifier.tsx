"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

type Summary = {
  total: number;
  voters: number;
  leaders: number;
  districtsReached: number;
};

type SessionUser = {
  email?: string;
  role?: string;
};

const ADMIN_ROLES = new Set(["master", "gestor", "lider"]);
const numberFormatter = new Intl.NumberFormat("pt-BR");

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

export default function ReportsSimplifier() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let fallbackScope = "";
    let requestVersion = 0;

    const getScope = () =>
      document.querySelector<HTMLSelectElement>(".scope-picker select")?.value ||
      fallbackScope;

    const renderSummary = (summary: Summary) => {
      const grid = document.querySelector<HTMLElement>(".report-grid");
      if (!grid) return false;

      const coverage = grid.querySelector<HTMLElement>(".coverage-card");
      const chart = grid.querySelector<HTMLElement>(".chart-card");
      if (!coverage || !chart) return false;

      const baseTotal = Math.max(1, summary.voters + summary.leaders);
      const voterPercent = Math.round((summary.voters / baseTotal) * 100);
      const leaderPercent = Math.round((summary.leaders / baseTotal) * 100);

      grid.dataset.vfSimplified = "true";
      chart.classList.add("vf-report-summary");
      chart.innerHTML = `
        <div class="vf-report-heading">
          <small>RESUMO DO AMBIENTE</small>
          <h3>Indicadores consolidados</h3>
          <p>Totais oficiais calculados na fonte agregada.</p>
        </div>
        <div class="vf-report-kpis">
          <article><span>👥</span><div><small>Total de contatos</small><b>${formatNumber(summary.total)}</b></div></article>
          <article><span>●</span><div><small>Eleitores</small><b>${formatNumber(summary.voters)}</b></div></article>
          <article><span>★</span><div><small>Lideranças</small><b>${formatNumber(summary.leaders)}</b></div></article>
          <article><span>⌖</span><div><small>Bairros alcançados</small><b>${formatNumber(summary.districtsReached)}</b></div></article>
        </div>
      `;

      coverage.classList.add("vf-report-composition");
      coverage.innerHTML = `
        <div class="vf-report-heading">
          <small>COMPOSIÇÃO DA BASE</small>
          <h3>Distribuição dos cadastros</h3>
          <p>Comparação entre os tipos de cadastro disponíveis.</p>
        </div>
        <div class="vf-composition-row">
          <div class="vf-composition-label"><span>Eleitores</span><b>${formatNumber(summary.voters)}</b></div>
          <div class="vf-progress"><i style="width:${voterPercent}%"></i></div>
          <small>${voterPercent}% da base classificada</small>
        </div>
        <div class="vf-composition-row leadership">
          <div class="vf-composition-label"><span>Lideranças</span><b>${formatNumber(summary.leaders)}</b></div>
          <div class="vf-progress"><i style="width:${leaderPercent}%"></i></div>
          <small>${leaderPercent}% da base classificada</small>
        </div>
        <div class="vf-report-note">
          <b>${formatNumber(summary.districtsReached)}</b>
          <span>bairros possuem cadastros neste ambiente.</span>
        </div>
      `;

      return true;
    };

    const enhance = async () => {
      const scope = getScope();
      if (!scope) return;
      const version = ++requestVersion;

      try {
        const response = await apiFetch(
          `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as Partial<Summary> & { error?: string };
        if (!response.ok) throw new Error(data.error || "Falha ao carregar resumo");
        if (cancelled || version !== requestVersion) return;

        renderSummary({
          total: finiteNumber(data.total),
          voters: finiteNumber(data.voters),
          leaders: finiteNumber(data.leaders),
          districtsReached: finiteNumber(data.districtsReached),
        });
      } catch {
        // O relatório legado permanece disponível caso o resumo agregado falhe.
      }
    };

    const handleChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      void enhance();
    };

    const handleRefresh = () => void enhance();

    document.addEventListener("change", handleChange, true);
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("voto-forte:records-changed", handleRefresh);

    observer = new MutationObserver((mutations) => {
      const reportAdded = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some(
          (node) =>
            node instanceof HTMLElement &&
            (node.matches(".report-grid") || Boolean(node.querySelector(".report-grid"))),
        ),
      );
      if (reportAdded) void enhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    void apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled || !response.ok) return;
        const user = data.user as SessionUser | undefined;
        const email = String(user?.email ?? "").trim().toLowerCase();
        const role = String(user?.role ?? "").trim().toLowerCase();
        if (!email) return;
        fallbackScope = ADMIN_ROLES.has(role) ? "all" : email;
        void enhance();
      })
      .catch(() => undefined);

    void enhance();

    return () => {
      cancelled = true;
      requestVersion += 1;
      observer?.disconnect();
      document.removeEventListener("change", handleChange, true);
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("voto-forte:records-changed", handleRefresh);
    };
  }, []);

  return null;
}
