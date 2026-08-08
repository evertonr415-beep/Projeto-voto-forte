"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";

type DashboardSection = "overview" | "coverage";

type Summary = {
  total: number;
  voters: number;
  leaders: number;
  meetings: number;
  districtsReached: number;
  districts: { district: string; total: number }[];
};

type DashboardRecord = {
  kind?: string;
  payload?: {
    district?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
};

type DashboardPayload = {
  records?: DashboardRecord[];
  mappedContactsTotal?: number;
  mappedContactsTruncated?: boolean;
};

const EMPTY_SUMMARY: Summary = {
  total: 0,
  voters: 0,
  leaders: 0,
  meetings: 0,
  districtsReached: 0,
  districts: [],
};

const sectionLabels: Record<DashboardSection, string> = {
  overview: "Visão geral",
  coverage: "Bairros",
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

export default function ExecutiveDashboard() {
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [mappedContacts, setMappedContacts] = useState(0);
  const [mappedContactsTruncated, setMappedContactsTruncated] = useState(false);
  const [visible, setVisible] = useState(false);
  const [section, setSection] = useState<DashboardSection>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const version = ++requestVersion.current;
      setLoading(true);
      setError("");
      try {
        const [summaryResponse, dashboardResponse] = await Promise.all([
          apiFetch("/api/contacts?mode=summary&owner=all", {
            headers: { accept: "application/json" },
            cache: "no-store",
          }),
          apiFetch("/api/records?owner=all&mode=dashboard", {
            headers: { accept: "application/json" },
            cache: "no-store",
          }),
        ]);

        const [summaryData, dashboardData] = (await Promise.all([
          summaryResponse.json(),
          dashboardResponse.json(),
        ])) as [
          Partial<Summary> & { error?: string },
          DashboardPayload & { error?: string },
        ];

        if (!summaryResponse.ok) {
          throw new Error(
            summaryData.error || "Falha ao carregar o resumo executivo.",
          );
        }
        if (!dashboardResponse.ok) {
          throw new Error(
            dashboardData.error || "Falha ao carregar os dados do mapa.",
          );
        }
        if (cancelled || version !== requestVersion.current) return;

        setSummary({
          total: finiteNumber(summaryData.total),
          voters: finiteNumber(summaryData.voters),
          leaders: finiteNumber(summaryData.leaders),
          meetings: finiteNumber(summaryData.meetings),
          districtsReached: finiteNumber(summaryData.districtsReached),
          districts: Array.isArray(summaryData.districts)
            ? summaryData.districts.map((item) => ({
                district: String(item.district || "").trim(),
                total: finiteNumber(item.total),
              }))
            : [],
        });
        setMappedContacts(finiteNumber(dashboardData.mappedContactsTotal));
        setMappedContactsTruncated(
          Boolean(dashboardData.mappedContactsTruncated),
        );
      } catch (loadError) {
        if (!cancelled && version === requestVersion.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível atualizar os indicadores agora.",
          );
        }
      } finally {
        if (!cancelled && version === requestVersion.current) setLoading(false);
      }
    };

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
      if (open) void load();
    };

    window.addEventListener(
      "voto-forte:executive-dashboard-toggle",
      handleToggle,
    );
    return () => {
      cancelled = true;
      requestVersion.current += 1;
      window.removeEventListener(
        "voto-forte:executive-dashboard-toggle",
        handleToggle,
      );
    };
  }, []);

  const topDistricts = useMemo(
    () =>
      summary.districts
        .filter((item) => item.district && item.total > 0)
        .sort(
          (left, right) =>
            right.total - left.total ||
            left.district.localeCompare(right.district, "pt-BR"),
        )
        .slice(0, 12),
    [summary.districts],
  );

  if (!visible) return null;

  const mapped = Math.min(summary.total, mappedContacts);
  const unmapped = Math.max(0, summary.total - mapped);
  const mappedPercent = summary.total
    ? Math.round((mapped / summary.total) * 100)
    : 0;

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
          <p>Indicadores consolidados diretamente do banco de dados.</p>
        </div>
        <button type="button" onClick={close}>
          Fechar
        </button>
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
      ) : error ? (
        <div className="vf-executive-loading">{error}</div>
      ) : (
        <>
          <section className="vf-executive-kpis">
            <article>
              <small>Eleitores</small>
              <strong>{formatNumber(summary.voters)}</strong>
              <span>{formatNumber(summary.total)} cadastros totais</span>
            </article>
            <article>
              <small>Lideranças</small>
              <strong>{formatNumber(summary.leaders)}</strong>
              <span>{formatNumber(summary.districtsReached)} bairros alcançados</span>
            </article>
            <article>
              <small>Cobertura</small>
              <strong>{mappedPercent}%</strong>
              <span>{formatNumber(mapped)} registros mapeados</span>
            </article>
            <article>
              <small>Pendências de mapa</small>
              <strong>{formatNumber(unmapped)}</strong>
              <span>sem geolocalização</span>
            </article>
            <article>
              <small>Bairros</small>
              <strong>{formatNumber(summary.districtsReached)}</strong>
              <span>com presença cadastrada</span>
            </article>
            <article>
              <small>Reuniões</small>
              <strong>{formatNumber(summary.meetings)}</strong>
              <span>no ambiente consolidado</span>
            </article>
          </section>

          {mappedContactsTruncated && (
            <div className="vf-executive-loading">
              A camada de pontos atingiu o limite de visualização; os totais acima
              continuam exatos.
            </div>
          )}

          {section === "overview" ? (
            <section className="vf-executive-overview">
              <div>
                <small>BASE CONSOLIDADA</small>
                <strong>{formatNumber(summary.total)} contatos</strong>
                <span>
                  {formatNumber(summary.voters)} eleitores e{" "}
                  {formatNumber(summary.leaders)} lideranças.
                </span>
              </div>
              <div>
                <small>COBERTURA TERRITORIAL</small>
                <strong>{mappedPercent}% da base com coordenadas</strong>
                <div className="vf-executive-progress">
                  <i style={{ width: `${mappedPercent}%` }} />
                </div>
                <span>
                  {formatNumber(summary.districtsReached)} bairros com presença
                  cadastrada.
                </span>
              </div>
            </section>
          ) : (
            <section className="vf-executive-ranking">
              <h3>Bairros com mais cadastros</h3>
              {topDistricts.length ? (
                topDistricts.map((item, index) => (
                  <button
                    type="button"
                    key={item.district}
                    onClick={() => selectDistrict(item.district)}
                  >
                    <b>{index + 1}</b>
                    <span>
                      <strong>{item.district}</strong>
                      <small>Cadastros no bairro</small>
                    </span>
                    <em>{formatNumber(item.total)}</em>
                  </button>
                ))
              ) : (
                <p>Não há dados territoriais disponíveis.</p>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
}
