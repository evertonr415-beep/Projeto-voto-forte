"use client";

import { useEffect, useMemo, useState } from "react";

type Contact = {
  id?: number;
  payload?: {
    name?: string;
    district?: string;
    kind?: string;
    latitude?: number;
    longitude?: number;
  };
};

type DistrictSummary = {
  name: string;
  total: number;
  voters: number;
  leaders: number;
  mapped: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function isMapView() {
  const heading = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((element) => element.textContent?.trim().toLowerCase() || "")
    .some((text) => text.includes("mapa eleitoral") || text.includes("mapa real"));
  return heading || Boolean(document.querySelector(".leaflet-container"));
}

export default function MapDistrictFilter() {
  const [visible, setVisible] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const onMap = isMapView();
      setVisible(onMap);
      if (!onMap) return;

      try {
        const response = await fetch("/api/records?owner=all", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: Contact[] };
        if (!cancelled) {
          setContacts((data.records || []).filter((record: any) => record.kind === "contact"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const observer = new MutationObserver(() => void load());
    observer.observe(document.body, { childList: true, subtree: true });
    void load();

    const handleSelected = (event: Event) => {
      const district = (event as CustomEvent<{ district?: string }>).detail?.district || "";
      if (district) {
        setSelected(district);
        setQuery(district);
      }
    };
    window.addEventListener("voto-forte:district-selected", handleSelected);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("voto-forte:district-selected", handleSelected);
    };
  }, []);

  const summaries = useMemo(() => {
    const grouped = new Map<string, DistrictSummary>();
    for (const contact of contacts) {
      const district = String(contact.payload?.district || "").trim();
      if (!district) continue;
      const key = normalize(district);
      const current = grouped.get(key) || {
        name: district,
        total: 0,
        voters: 0,
        leaders: 0,
        mapped: 0,
      };
      current.total += 1;
      if (normalize(contact.payload?.kind).includes("LIDER")) current.leaders += 1;
      else current.voters += 1;
      if (
        Number.isFinite(Number(contact.payload?.latitude)) &&
        Number.isFinite(Number(contact.payload?.longitude))
      ) {
        current.mapped += 1;
      }
      grouped.set(key, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [contacts]);

  const filteredSummaries = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return summaries;
    return summaries.filter((summary) => normalize(summary.name).includes(normalizedQuery));
  }, [query, summaries]);

  const selectedSummary = useMemo(
    () => summaries.find((summary) => normalize(summary.name) === normalize(selected)),
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

  function exportCsv() {
    if (!selected) return;
    const rows = contacts.filter(
      (contact) => normalize(contact.payload?.district) === normalize(selected),
    );
    const header = ["Nome", "Bairro", "Tipo", "Latitude", "Longitude"];
    const body = rows.map((contact) => [
      contact.payload?.name || "",
      contact.payload?.district || "",
      contact.payload?.kind || "",
      contact.payload?.latitude || "",
      contact.payload?.longitude || "",
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `voto-forte-${normalize(selected).toLowerCase().replace(/\s+/g, "-")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!visible) return null;

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
              className={normalize(selected) === normalize(summary.name) ? "active" : ""}
              onClick={() => selectDistrict(summary.name)}
            >
              <span>{summary.name}</span>
              <b>{summary.total}</b>
            </button>
          ))
        )}
      </div>

      {selectedSummary && (
        <section className="vf-district-summary">
          <strong>{selectedSummary.name}</strong>
          <div>
            <span><b>{selectedSummary.total}</b> cadastros</span>
            <span><b>{selectedSummary.voters}</b> eleitores</span>
            <span><b>{selectedSummary.leaders}</b> lideranças</span>
            <span><b>{selectedSummary.mapped}</b> mapeados</span>
          </div>
          <button type="button" onClick={exportCsv}>Exportar bairro em CSV</button>
        </section>
      )}
    </aside>
  );
}
