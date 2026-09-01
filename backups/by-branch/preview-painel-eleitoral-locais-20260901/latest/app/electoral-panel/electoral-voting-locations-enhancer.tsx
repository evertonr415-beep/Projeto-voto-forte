"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ARAPONGAS_CHANGED_ELECTORS_2026,
  ARAPONGAS_CHANGED_SECTIONS_2026,
  ARAPONGAS_ELECTORATE_2026,
  ARAPONGAS_VOTING_LOCATION_SOURCES,
  ARAPONGAS_ZONE,
  VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026,
  type VerifiedVotingLocation2026,
} from "./verified-voting-locations-2026";
import "./electoral-voting-locations.css";

type ViewMode = "results" | "locations";

function sectionLabel(sections: number[]) {
  return sections.length === 1 ? "1 seção" : `${sections.length} seções`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function LocationCard({
  location,
  expanded,
  onToggle,
}: {
  location: VerifiedVotingLocation2026;
  expanded: boolean;
  onToggle: () => void;
}) {
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
            <div>
              <small>SEÇÕES NESTE LOCAL</small>
              <b>{location.sections.length}</b>
            </div>
            <div>
              <small>ZONA ELEITORAL</small>
              <b>{location.zone}ª ZE</b>
            </div>
          </div>

          <div className="vf-voting-sections-grid">
            {[...location.sections].sort((a, b) => a - b).map((section) => (
              <span key={section}>Seção {section}</span>
            ))}
          </div>

          {location.change2026 ? (
            <div className="vf-voting-change-note">
              <strong>Mudança oficial para 2026</strong>
              <p>
                As seções {location.change2026.changedSections.join(", ")} foram transferidas de <b>{location.change2026.movedFrom}</b> para este local.
              </p>
              <span>{location.change2026.movedElectors.toLocaleString("pt-BR")} eleitoras e eleitores afetados pela mudança.</span>
            </div>
          ) : null}

          <a
            className="vf-voting-map-link"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.address}, Arapongas PR`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Abrir endereço no mapa ↗
          </a>
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
      if (!nextRoot) {
        setRoot(null);
        setTabsTarget(null);
        setLocationsTarget(null);
        return;
      }

      if (nextRoot === currentRoot && tabsMount?.isConnected && locationsMount?.isConnected) return;
      currentRoot = nextRoot;
      setRoot(nextRoot);

      const shell = nextRoot.querySelector<HTMLElement>(".tse-panel-shell");
      const integrity = nextRoot.querySelector<HTMLElement>(".tse-panel-integrity-note");
      if (!shell || !integrity) return;

      tabsMount = shell.querySelector<HTMLElement>(".vf-electoral-view-tabs-mount");
      if (!tabsMount) {
        tabsMount = document.createElement("div");
        tabsMount.className = "vf-electoral-view-tabs-mount";
        shell.insertBefore(tabsMount, integrity);
      }

      locationsMount = shell.querySelector<HTMLElement>(".vf-electoral-locations-mount");
      if (!locationsMount) {
        locationsMount = document.createElement("div");
        locationsMount.className = "vf-electoral-locations-mount";
        shell.insertBefore(locationsMount, integrity.nextSibling);
      }

      setTabsTarget(tabsMount);
      setLocationsTarget(locationsMount);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!root) return;
    root.dataset.vfElectoralView = view;
    return () => {
      if (root.dataset.vfElectoralView === view) delete root.dataset.vfElectoralView;
    };
  }, [root, view]);

  const uniqueSections = useMemo(() => {
    const sections = new Set<number>();
    VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026.forEach((location) => {
      location.sections.forEach((section) => sections.add(section));
    });
    return sections.size;
  }, []);

  const filteredLocations = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) return VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026;

    return VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026.filter((location) => {
      const haystack = normalize(
        [
          location.name,
          location.address,
          location.district,
          `zona ${location.zone}`,
          ...location.sections.map((section) => `secao ${section}`),
          ...location.sections.map(String),
        ].join(" "),
      );
      return haystack.includes(normalizedQuery);
    });
  }, [query]);

  if (!root || !tabsTarget || !locationsTarget) return null;

  const tabs = createPortal(
    <nav className="vf-electoral-view-tabs" aria-label="Visões do Painel Eleitoral">
      <button
        type="button"
        className={view === "results" ? "active" : ""}
        onClick={() => setView("results")}
      >
        Resultados eleitorais
      </button>
      <button
        type="button"
        className={view === "locations" ? "active" : ""}
        onClick={() => setView("locations")}
      >
        Locais de votação
      </button>
    </nav>,
    tabsTarget,
  );

  const locations = createPortal(
    <section className="vf-voting-locations-panel" aria-label="Locais de votação de Arapongas">
      <div className="vf-voting-locations-hero">
        <div>
          <small>ELEIÇÕES 2026 · ARAPONGAS / PR</small>
          <h2>Locais de votação e seções eleitorais</h2>
          <p>
            Relação consolidada para a 61ª Zona Eleitoral, com as alterações oficiais comunicadas pelo TRE-PR para 2026. Nenhum voto por local é estimado.
          </p>
        </div>
        <span className="vf-voting-source-pill">DADOS OFICIAIS / VERIFICADOS</span>
      </div>

      <div className="vf-voting-kpis">
        <article>
          <small>ELEITORADO 2026</small>
          <b>{ARAPONGAS_ELECTORATE_2026.toLocaleString("pt-BR")}</b>
          <span>eleitoras e eleitores em Arapongas</span>
        </article>
        <article>
          <small>LOCAIS MAPEADOS</small>
          <b>{VERIFIED_ARAPONGAS_VOTING_LOCATIONS_2026.length}</b>
          <span>locais na base consolidada</span>
        </article>
        <article>
          <small>SEÇÕES MAPEADAS</small>
          <b>{uniqueSections}</b>
          <span>seções identificadas na relação</span>
        </article>
        <article className="changed">
          <small>MUDANÇAS 2026</small>
          <b>{ARAPONGAS_CHANGED_SECTIONS_2026}</b>
          <span>{ARAPONGAS_CHANGED_ELECTORS_2026.toLocaleString("pt-BR")} eleitores afetados</span>
        </article>
      </div>

      <div className="vf-voting-search-row">
        <label>
          <span>Buscar local, bairro ou seção</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: Centro, seção 238, Irondi..."
          />
        </label>
        <div className="vf-voting-zone-chip">61ª Zona Eleitoral</div>
      </div>

      <div className="vf-voting-location-list">
        {filteredLocations.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            expanded={expandedId === location.id}
            onToggle={() => setExpandedId((current) => (current === location.id ? null : location.id))}
          />
        ))}
        {!filteredLocations.length ? (
          <div className="vf-voting-empty">Nenhum local ou seção encontrado para esta busca.</div>
        ) : null}
      </div>

      <aside className="vf-voting-official-note">
        <strong>Importante</strong>
        <p>
          O local individual de cada eleitor deve ser confirmado no e-Título ou na consulta oficial do TSE. Esta tela organiza a malha eleitoral de Arapongas e as mudanças divulgadas oficialmente para 2026.
        </p>
        <div>
          <a href={ARAPONGAS_VOTING_LOCATION_SOURCES.tse2026.url} target="_blank" rel="noreferrer">Base TSE 2026 ↗</a>
          <a href={ARAPONGAS_VOTING_LOCATION_SOURCES.trePrChanges2026.url} target="_blank" rel="noreferrer">Alterações TRE-PR 2026 ↗</a>
        </div>
      </aside>
    </section>,
    locationsTarget,
  );

  return <>{tabs}{locations}</>;
}
