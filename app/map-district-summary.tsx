"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSharedTerritoryContacts } from "./territory-data-client";

type Contact = {
  kind?: string;
  payload?: {
    district?: string;
    kind?: string;
    latitude?: number;
    longitude?: number;
  };
};

type Summary = {
  name: string;
  total: number;
  voters: number;
  leaders: number;
  mapped: number;
};

type CoverageLevel = {
  key: "critical" | "low" | "medium" | "high";
  label: string;
  priority: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function getCoverageLevel(total: number, mappedPercent: number): CoverageLevel {
  if (total === 0 || mappedPercent < 35) {
    return {
      key: "critical",
      label: "Cobertura crítica",
      priority: "Prioridade imediata",
    };
  }
  if (mappedPercent < 60) {
    return {
      key: "low",
      label: "Cobertura baixa",
      priority: "Requer reforço",
    };
  }
  if (mappedPercent < 85) {
    return {
      key: "medium",
      label: "Cobertura média",
      priority: "Acompanhar evolução",
    };
  }
  return {
    key: "high",
    label: "Cobertura alta",
    priority: "Manter presença",
  };
}

export default function MapDistrictSummary() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (contacts.length) return;
      setLoading(true);
      try {
        const records = await loadSharedTerritoryContacts();
        if (!cancelled) setContacts(records as Contact[]);
      } catch {
        // O mapa continua funcional mesmo sem o resumo.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const showDistrict = (district: string) => {
      setSelected(district);
      setVisible(Boolean(district));
      if (district) void load();
    };

    const handleSelected = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      showDistrict(district);
    };

    const handleFilter = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      showDistrict(district);
    };

    window.addEventListener("voto-forte:district-selected", handleSelected);
    window.addEventListener("voto-forte:district-filter-change", handleFilter);

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:district-selected", handleSelected);
      window.removeEventListener("voto-forte:district-filter-change", handleFilter);
    };
  }, [contacts.length]);

  const summary = useMemo<Summary | null>(() => {
    if (!selected) return null;
    const key = normalize(selected);
    let total = 0;
    let voters = 0;
    let leaders = 0;
    let mapped = 0;

    for (const contact of contacts) {
      if (normalize(contact.payload?.district) !== key) continue;
      total += 1;
      if (normalize(contact.payload?.kind).includes("LIDER")) leaders += 1;
      else voters += 1;
      if (
        Number.isFinite(Number(contact.payload?.latitude)) &&
        Number.isFinite(Number(contact.payload?.longitude))
      ) {
        mapped += 1;
      }
    }

    return { name: selected, total, voters, leaders, mapped };
  }, [contacts, selected]);

  if (!visible) return null;

  if (loading && !contacts.length) {
    return (
      <aside className="vf-district-summary-card" aria-live="polite">
        <div className="vf-district-summary-main">
          <small>BAIRRO SELECIONADO</small>
          <strong>{selected}</strong>
          <span>Carregando resumo...</span>
        </div>
      </aside>
    );
  }

  if (!summary) return null;

  const mappedPercent = summary.total
    ? Math.round((summary.mapped / summary.total) * 100)
    : 0;
  const coverage = getCoverageLevel(summary.total, mappedPercent);

  return (
    <aside
      className={`vf-district-summary-card vf-coverage-${coverage.key}`}
      aria-live="polite"
    >
      <div className="vf-district-summary-main">
        <small>BAIRRO SELECIONADO</small>
        <strong>{summary.name}</strong>
        <div className="vf-district-coverage-status">
          <span>{coverage.label}</span>
          <b>{coverage.priority}</b>
        </div>
      </div>
      <div className="vf-district-summary-stats">
        <span><b>{summary.total}</b> cadastros</span>
        <span><b>{summary.voters}</b> eleitores</span>
        <span><b>{summary.leaders}</b> lideranças</span>
        <span><b>{mappedPercent}%</b> mapeado</span>
      </div>
      <div className="vf-district-coverage-bar" aria-label={`${mappedPercent}% mapeado`}>
        <i style={{ width: `${mappedPercent}%` }} />
      </div>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setSelected("");
          window.dispatchEvent(
            new CustomEvent("voto-forte:district-filter-change", {
              detail: { district: "" },
            }),
          );
        }}
      >
        Fechar
      </button>
    </aside>
  );
}
