"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSharedTerritorySummary } from "./territory-data-client";

type DistrictSummary = {
  name: string;
  total: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export default function MapDistrictFilter() {
  const [summaries, setSummaries] = useState<DistrictSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadSharedTerritorySummary()
      .then((summary) => {
        if (cancelled) return;
        setSummaries(
          summary.districts
            .filter((item) => item.district)
            .map((item) => ({ name: item.district, total: item.total }))
            .sort(
              (left, right) =>
                right.total - left.total ||
                left.name.localeCompare(right.name, "pt-BR"),
            ),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const handleSelected = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      if (!district) return;
      setSelected(district);
      setQuery(district);
    };

    window.addEventListener("voto-forte:district-selected", handleSelected);
    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:district-selected", handleSelected);
    };
  }, []);

  const filteredSummaries = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return summaries;
    return summaries.filter((summary) =>
      normalize(summary.name).includes(normalizedQuery),
    );
  }, [query, summaries]);

  const selectedSummary = useMemo(
    () =>
      summaries.find(
        (summary) => normalize(summary.name) === normalize(selected),
      ),
    [selected, summaries],
  );

  function selectDistrict(name: string) {
    setSelected(name);
    setQuery(name);
    window.dispatchEvent(
      new CustomEvent("voto-forte:district-filter-change", {
        detail: { district: name },
      }),
    );
    const toolbar = document.querySelector(".real-map-toolbar strong");
    if (toolbar) toolbar.textContent = `${name} · filtro territorial ativo`;
  }

  function clearFilter() {
    setSelected("");
    setQuery("");
    window.dispatchEvent(
      new CustomEvent("voto-forte:district-filter-change", {
        detail: { district: "" },
      }),
    );
    const toolbar = document.querySelector(".real-map-toolbar strong");
    if (toolbar) toolbar.textContent = "Todos os bairros · filtro removido";
  }

  return (
    <aside className="vf-district-filter">
      <div className="vf-district-filter-head">
        <div>
          <small>ANÁLISE TERRITORIAL</small>
          <strong>Filtrar por bairro</strong>
        </div>
        {selected && (
          <button type="button" onClick={clearFilter} className="vf-clear-filter">
            Limpar
          </button>
        )}
      </div>

      <input
        type="search"
        placeholder="Digite o nome do bairro"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="vf-district-list">
        {loading ? (
          <span>Carregando bairros…</span>
        ) : (
          filteredSummaries.slice(0, 12).map((summary) => (
            <button
              type="button"
              key={normalize(summary.name)}
              className={
                normalize(selected) === normalize(summary.name) ? "active" : ""
              }
              onClick={() => selectDistrict(summary.name)}
            >
              <span>{summary.name}</span>
              <b>{summary.total.toLocaleString("pt-BR")}</b>
            </button>
          ))
        )}
      </div>

      {selectedSummary && (
        <section className="vf-district-summary">
          <strong>{selectedSummary.name}</strong>
          <div>
            <span>
              <b>{selectedSummary.total.toLocaleString("pt-BR")}</b> cadastros
            </span>
          </div>
          <small>Total oficial do resumo agregado.</small>
        </section>
      )}
    </aside>
  );
}
