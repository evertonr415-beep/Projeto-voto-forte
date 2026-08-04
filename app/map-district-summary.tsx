"use client";

import { useEffect, useMemo, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/records?owner=all", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: Contact[] };
        if (!cancelled) {
          setContacts((data.records || []).filter((record) => record.kind === "contact"));
        }
      } catch {
        // O mapa continua funcional mesmo sem o resumo.
      }
    };

    const handleSelected = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      setSelected(district);
      setVisible(Boolean(district));
    };

    const handleFilter = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      setSelected(district);
      setVisible(Boolean(district));
    };

    void load();
    window.addEventListener("voto-forte:district-selected", handleSelected);
    window.addEventListener("voto-forte:district-filter-change", handleFilter);

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:district-selected", handleSelected);
      window.removeEventListener("voto-forte:district-filter-change", handleFilter);
    };
  }, []);

  const summary = useMemo<Summary | null>(() => {
    if (!selected) return null;
    const key = normalize(selected);
    const items = contacts.filter(
      (contact) => normalize(contact.payload?.district) === key,
    );
    if (!items.length) {
      return { name: selected, total: 0, voters: 0, leaders: 0, mapped: 0 };
    }
    return {
      name: selected,
      total: items.length,
      voters: items.filter(
        (contact) => !normalize(contact.payload?.kind).includes("LIDER"),
      ).length,
      leaders: items.filter((contact) =>
        normalize(contact.payload?.kind).includes("LIDER"),
      ).length,
      mapped: items.filter(
        (contact) =>
          Number.isFinite(Number(contact.payload?.latitude)) &&
          Number.isFinite(Number(contact.payload?.longitude)),
      ).length,
    };
  }, [contacts, selected]);

  if (!visible || !summary) return null;

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
