"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildTerritoryStatistics,
  type TerritoryRecord,
} from "./territory-statistics";
import {
  buildTerritoryRankings,
  type TerritoryRankingKey,
} from "./territory-rankings";

type DashboardSection =
  | "overview"
  | "growth"
  | "coverage"
  | "voters"
  | "leaders"
  | "unmapped";

const sectionLabels: Record<DashboardSection, string> = {
  overview: "Visão geral",
  growth: "Crescimento",
  coverage: "Cobertura",
  voters: "Eleitores",
  leaders: "Lideranças",
  unmapped: "Pendências",
};

const sectionRankingMap: Partial<
  Record<DashboardSection, TerritoryRankingKey>
> = {
  growth: "growth",
  coverage: "coverage",
  voters: "voters",
  leaders: "leaders",
  unmapped: "unmapped",
};

export default function ExecutiveDashboard() {
  const [records, setRecords] = useState<TerritoryRecord[]>([]);
  const [visible, setVisible] = useState(false);
  const [section, setSection] = useState<DashboardSection>("overview");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/records?owner=all", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: TerritoryRecord[] };
        if (!cancelled) setRecords(data.records || []);
      } catch {
        // Os demais recursos do sistema continuam disponíveis.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
      if (open) void load();
    };

    window.addEventListener("voto-forte:executive-dashboard-toggle", handleToggle);
    return () => {
      cancelled = true;
      window.removeEventListener(
        "voto-forte:executive-dashboard-toggle",
        handleToggle,
      );
    };
  }, []);

  const statistics = useMemo(
    () => buildTerritoryStatistics(records),
    [records],
  );
  const rankings = useMemo(
    () => buildTerritoryRankings(statistics, 8),
    [statistics],
  );

  if (!visible) return null;

  const rankingKey = sectionRankingMap[section];
  const ranking = rankingKey ? rankings[rankingKey] : [];

  const close = () => {
    setVisible(false);
    window.dispatchEvent(
      new CustomEvent("voto-forte:executive-dashboard-toggle", {
        detail: { open: false },
      }),
    );
  };

  const selectDistrict = (district: string) => {
    window.dispatchEvent(
      new CustomEvent("voto-forte:district-selected", {
        detail: { district },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("voto-forte:district-filter-change", {
        detail: { district },
      }),
    );
    close();
  };

  return (
    <aside className="vf-executive-dashboard" aria-label="Dashboard executivo">
      <header>
        <div>
          <small>GESTÃO TERRITORIAL</small>
          <strong>Dashboard Executivo</strong>
          <p>Indicadores consolidados da base de cadastros.</p>
        </div>
        <button type="button" onClick={close}>Fechar</button>
      </header>

      <nav aria-label="Seções do dashboard">
        {(Object.keys(sectionLabels) as DashboardSection[]).map((item) => (
          <button
            type="button"
            key={item}
            className={section === item ? "active" : ""}
            onClick={() => setSection(item)}
          >
            {sectionLabels[item]}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="vf-executive-loading">Atualizando indicadores...</div>
      ) : (
        <>
          <section className="vf-executive-kpis">
            <article>
              <small>Eleitores</small>
              <strong>{statistics.voters}</strong>
              <span>{statistics.total} cadastros totais</span>
            </article>
            <article>
              <small>Lideranças</small>
              <strong>{statistics.leaders}</strong>
              <span>{statistics.districtsReached} bairros alcançados</span>
            </article>
            <article>
              <small>Cobertura</small>
              <strong>{statistics.mappedPercent}%</strong>
              <span>{statistics.mapped} registros mapeados</span>
            </article>
            <article>
              <small>Pendências</small>
              <strong>{statistics.unmapped}</strong>
              <span>sem geolocalização</span>
            </article>
            <article>
              <small>Últimos 7 dias</small>
              <strong>{statistics.registrationsLast7Days}</strong>
              <span>{statistics.weeklyGrowth >= 0 ? "+" : ""}{statistics.weeklyGrowth}% de evolução</span>
            </article>
            <article>
              <small>Hoje</small>
              <strong>{statistics.registrationsToday}</strong>
              <span>novos registros</span>
            </article>
          </section>

          {section === "overview" ? (
            <section className="vf-executive-overview">
              <div>
                <small>COBERTURA TERRITORIAL</small>
                <strong>{statistics.mappedPercent}% da base mapeada</strong>
                <div className="vf-executive-progress">
                  <i style={{ width: `${statistics.mappedPercent}%` }} />
                </div>
              </div>
              <div>
                <small>CRESCIMENTO SEMANAL</small>
                <strong>{statistics.weeklyGrowth >= 0 ? "+" : ""}{statistics.weeklyGrowth}%</strong>
                <span>
                  {statistics.registrationsLast7Days} registros nesta semana contra {statistics.registrationsPrevious7Days} na anterior.
                </span>
              </div>
            </section>
          ) : (
            <section className="vf-executive-ranking">
              <h3>{sectionLabels[section]}</h3>
              {ranking.length ? (
                ranking.map((item, index) => (
                  <button
                    type="button"
                    key={`${section}-${item.district.key}`}
                    onClick={() => selectDistrict(item.district.name)}
                  >
                    <b>{index + 1}</b>
                    <span>
                      <strong>{item.district.name}</strong>
                      <small>{item.label}</small>
                    </span>
                    <em>{item.district.total}</em>
                  </button>
                ))
              ) : (
                <p>Não há dados suficientes para este ranking.</p>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
}
