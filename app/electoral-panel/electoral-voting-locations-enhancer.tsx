"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../supabase-client";
import {
  ARAPONGAS_CHANGED_ELECTORS_2026,
  ARAPONGAS_CHANGED_SECTIONS_2026,
  ARAPONGAS_ELECTORATE_2026,
  ARAPONGAS_VOTING_LOCATION_SOURCES,
  VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026,
  type VerifiedVotingLocation2026,
} from "./verified-voting-locations-2026";
import "./electoral-voting-locations.css";

type ViewMode = "results" | "locations";
type HistoricalYear = 2024 | 2022;
type SchoolCandidate = { number: string; name: string; party: string; votes: number };
type SchoolResult = {
  year: HistoricalYear;
  office: string;
  sections: number[];
  candidates: SchoolCandidate[];
  totalNominalVotes: number;
  generatedAt: string;
};

const OFFICES: Record<HistoricalYear, string[]> = {
  2024: ["Prefeito", "Vereador"],
  2022: ["Presidente", "Governador", "Senador", "Deputado Federal", "Deputado Estadual"],
};

function sectionLabel(sections: number[]) {
  return sections.length === 1 ? "1 seção" : `${sections.length} seções`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function SchoolResultPanel({ location }: { location: VerifiedVotingLocation2026 }) {
  const [year, setYear] = useState<HistoricalYear>(2024);
  const [office, setOffice] = useState("Prefeito");
  const [result, setResult] = useState<SchoolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOffice(OFFICES[year][0]);
    setResult(null);
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setResult(null);
    const params = new URLSearchParams({
      year: String(year),
      office,
      sections: location.sections.join(","),
    });
    apiFetch(`/api/electoral/school-results?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar os votos desta escola.");
        setResult(data as SchoolResult);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Falha ao carregar os dados oficiais.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.sections, office, year]);

  return (
    <div className="vf-school-results">
      <div className="vf-school-results-head">
        <div>
          <small>RESULTADO HISTÓRICO DESTA ESCOLA</small>
          <strong>Todos os candidatos, do mais votado ao menos votado</strong>
        </div>
        <span>TSE · soma das seções</span>
      </div>

      <div className="vf-school-year-tabs">
        <button className={year === 2024 ? "active" : ""} onClick={() => setYear(2024)} type="button">2024 · Municipal</button>
        <button className={year === 2022 ? "active" : ""} onClick={() => setYear(2022)} type="button">2022 · Geral</button>
      </div>

      <div className="vf-school-office-tabs">
        {OFFICES[year].map((item) => (
          <button key={item} type="button" className={office === item ? "active" : ""} onClick={() => setOffice(item)}>{item}</button>
        ))}
      </div>

      {loading ? <div className="vf-school-loading">Carregando e somando os dados oficiais das seções desta escola…</div> : null}
      {error ? <div className="vf-school-error"><strong>Dados indisponíveis agora.</strong><span>{error}</span></div> : null}
      {!loading && !error && result ? (
        <div className="vf-school-ranking-wrap">
          <div className="vf-school-ranking-summary">
            <span>{result.candidates.length} candidatos com votos</span>
            <span>{result.totalNominalVotes.toLocaleString("pt-BR")} votos nominais somados</span>
          </div>
          <div className="vf-school-ranking">
            {result.candidates.map((candidate, index) => (
              <div className="vf-school-rank-row" key={`${candidate.number}-${candidate.name}-${candidate.party}`}>
                <b className="vf-school-rank-pos">{index + 1}º</b>
                <div className="vf-school-rank-name">
                  <strong>{candidate.name}</strong>
                  <span>{candidate.number ? `Nº ${candidate.number}` : ""}{candidate.party ? ` · ${candidate.party}` : ""}</span>
                </div>
                <b className="vf-school-rank-votes">{candidate.votes.toLocaleString("pt-BR")}</b>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocationCard({ location, expanded, onToggle }: { location: VerifiedVotingLocation2026; expanded: boolean; onToggle: () => void }) {
  return (
    <article className={`vf-voting-location-card${location.change2026 ? " changed" : ""}`}>
      <button type="button" className="vf-voting-location-card-main" onClick={onToggle}>
        <div className="vf-voting-location-icon" aria-hidden="true">🏫</div>
        <div className="vf-voting-location-copy">
          <div className="vf-voting-location-title-row">
            <strong>{location.name}</strong>
            {location.change2026 ? <span className="vf-voting-change-badge">ALTERADO EM 2026</span> : null}
          </div>
          <span>{location.address}</span>
          <small>{location.district} · Zona {location.zone} · {sectionLabel(location.sections)}</small>
        </div>
        <span className="vf-voting-location-expand" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>

      {expanded ? (
        <div className="vf-voting-location-details">
          <div className="vf-voting-location-details-head">
            <div><small>SEÇÕES NESTE LOCAL</small><b>{location.sections.length}</b></div>
            <div><small>ZONA ELEITORAL</small><b>{location.zone}ª ZE</b></div>
          </div>
          <div className="vf-voting-sections-grid">
            {[...location.sections].sort((a, b) => a - b).map((section) => <span key={section}>Seção {section}</span>)}
          </div>
          {location.change2026 ? (
            <div className="vf-voting-change-note">
              <strong>Mudança oficial para 2026</strong>
              <p>As seções {location.change2026.changedSections.join(", ")} foram transferidas de <b>{location.change2026.movedFrom}</b> para este local.</p>
              <span>{location.change2026.movedElectors.toLocaleString("pt-BR")} eleitoras e eleitores afetados pela mudança.</span>
            </div>
          ) : null}
          <SchoolResultPanel location={location} />
          <a className="vf-voting-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.address}, Arapongas PR`)}`} target="_blank" rel="noreferrer">Abrir endereço no mapa ↗</a>
        </div>
      ) : null}
    </article>
  );
}

export default function ElectoralVotingLocationsEnhancer() {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [tabsTarget, setTabsTarget] = useState<HTMLElement | null>(null);
  const [locationsTarget, setLocationsTarget] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<ViewMode>("results");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let currentRoot: HTMLElement | null = null;
    let tabsMount: HTMLElement | null = null;
    let locationsMount: HTMLElement | null = null;
    const sync = () => {
      const nextRoot = document.querySelector<HTMLElement>(".tse-panel-root");
      if (!nextRoot) { setRoot(null); setTabsTarget(null); setLocationsTarget(null); return; }
      if (nextRoot === currentRoot && tabsMount?.isConnected && locationsMount?.isConnected) return;
      currentRoot = nextRoot; setRoot(nextRoot);
      const shell = nextRoot.querySelector<HTMLElement>(".tse-panel-shell");
      const integrity = nextRoot.querySelector<HTMLElement>(".tse-panel-integrity-note");
      if (!shell || !integrity) return;
      tabsMount = shell.querySelector<HTMLElement>(".vf-electoral-view-tabs-mount") || document.createElement("div");
      if (!tabsMount.isConnected) { tabsMount.className = "vf-electoral-view-tabs-mount"; shell.insertBefore(tabsMount, integrity); }
      locationsMount = shell.querySelector<HTMLElement>(".vf-electoral-locations-mount") || document.createElement("div");
      if (!locationsMount.isConnected) { locationsMount.className = "vf-electoral-locations-mount"; shell.insertBefore(locationsMount, integrity.nextSibling); }
      setTabsTarget(tabsMount); setLocationsTarget(locationsMount);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!root) return;
    root.dataset.vfElectoralView = view;
    return () => { if (root.dataset.vfElectoralView === view) delete root.dataset.vfElectoralView; };
  }, [root, view]);

  const uniqueSections = useMemo(() => {
    const sections = new Set<number>();
    VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026.forEach((location) => location.sections.forEach((section) => sections.add(section)));
    return sections.size;
  }, []);

  const groupedLocations = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    const filtered = VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026.filter((location) => {
      if (!normalizedQuery) return true;
      const haystack = normalize([location.name, location.address, location.district, ...location.sections.map(String)].join(" "));
      return haystack.includes(normalizedQuery);
    });
    const groups = new Map<string, VerifiedVotingLocation2026[]>();
    filtered.forEach((location) => groups.set(location.district, [...(groups.get(location.district) || []), location]));
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [query]);

  if (!root || !tabsTarget || !locationsTarget) return null;

  const tabs = createPortal(
    <nav className="vf-electoral-view-tabs" aria-label="Visões do Painel Eleitoral">
      <button type="button" className={view === "results" ? "active" : ""} onClick={() => setView("results")}>Resultados gerais</button>
      <button type="button" className={view === "locations" ? "active" : ""} onClick={() => setView("locations")}>Bairros e locais de votação</button>
    </nav>, tabsTarget,
  );

  const locations = createPortal(
    <section className="vf-voting-locations-panel" aria-label="Bairros e locais de votação de Arapongas">
      <div className="vf-voting-locations-hero">
        <div>
          <small>MAPA ELEITORAL · ARAPONGAS / PR</small>
          <h2>Bairros → escolas → resultado por candidato</h2>
          <p>Abra um bairro, escolha a escola e consulte o ranking real de candidatos pela soma das seções daquele local. 2024: Prefeito e Vereador. 2022: Presidente, Governador, Senador, Deputado Federal e Deputado Estadual.</p>
        </div>
        <span className="vf-voting-source-pill">TSE · SEM ESTIMATIVA</span>
      </div>

      <div className="vf-voting-kpis">
        <article><small>ELEITORADO 2026</small><b>{ARAPONGAS_ELECTORATE_2026.toLocaleString("pt-BR")}</b><span>eleitoras e eleitores</span></article>
        <article><small>LOCAIS MAPEADOS</small><b>{VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026.length}</b><span>escolas e locais</span></article>
        <article><small>SEÇÕES MAPEADAS</small><b>{uniqueSections}</b><span>seções identificadas</span></article>
        <article className="changed"><small>MUDANÇAS 2026</small><b>{ARAPONGAS_CHANGED_SECTIONS_2026}</b><span>{ARAPONGAS_CHANGED_ELECTORS_2026.toLocaleString("pt-BR")} eleitores afetados</span></article>
      </div>

      <div className="vf-voting-search-row">
        <label><span>Buscar bairro, escola ou seção</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Centro, Bandeirantes, seção 238…" /></label>
        <div className="vf-voting-zone-chip">61ª Zona Eleitoral</div>
      </div>

      <div className="vf-voting-neighborhood-list">
        {groupedLocations.map(([district, locations]) => (
          <section className="vf-voting-neighborhood" key={district}>
            <div className="vf-voting-neighborhood-head"><div><small>BAIRRO / REGIÃO</small><h3>{district}</h3></div><span>{locations.length} {locations.length === 1 ? "local" : "locais"}</span></div>
            <div className="vf-voting-location-list">
              {locations.map((location) => <LocationCard key={location.id} location={location} expanded={expandedId === location.id} onToggle={() => setExpandedId((current) => current === location.id ? null : location.id)} />)}
            </div>
          </section>
        ))}
        {!groupedLocations.length ? <div className="vf-voting-empty">Nenhum bairro, local ou seção encontrado.</div> : null}
      </div>

      <aside className="vf-voting-official-note">
        <strong>Como o ranking é calculado</strong>
        <p>O sistema usa a base oficial “Votação por seção eleitoral” do TSE e soma somente as seções vinculadas à escola aberta. Não representa o bairro de residência do eleitor.</p>
        <div><a href={ARAPONGAS_VOTING_LOCATION_SOURCES.tse2026.url} target="_blank" rel="noreferrer">Base TSE ↗</a><a href={ARAPONGAS_VOTING_LOCATION_SOURCES.trePrChanges2026.url} target="_blank" rel="noreferrer">Alterações TRE-PR 2026 ↗</a></div>
      </aside>
    </section>, locationsTarget,
  );

  return <>{tabs}{locations}</>;
}
