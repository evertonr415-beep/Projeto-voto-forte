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

type Priority = "critical" | "attention" | "evolution" | "consolidated";

type DistrictItem = {
  name: string;
  total: number;
  mapped: number;
  voters: number;
  leaders: number;
  mappedPercent: number;
  priority: Priority;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function classify(total: number, mappedPercent: number): Priority {
  if (total === 0 || mappedPercent < 35) return "critical";
  if (mappedPercent < 60) return "attention";
  if (mappedPercent < 85) return "evolution";
  return "consolidated";
}

const labels: Record<Priority, string> = {
  critical: "Críticos",
  attention: "Atenção",
  evolution: "Em evolução",
  consolidated: "Consolidados",
};

export default function MapPriorityPanel() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<Priority>("critical");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/records?owner=all&kind=contact", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: Contact[] };
        if (!cancelled) setContacts(data.records || []);
      } catch {
        // Mantém a navegação principal disponível.
      }
    };

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
      if (open) void load();
    };

    window.addEventListener("voto-forte:priority-panel-toggle", handleToggle);
    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:priority-panel-toggle", handleToggle);
    };
  }, []);

  const districts = useMemo(() => {
    const grouped = new Map<string, DistrictItem>();

    for (const contact of contacts) {
      const district = String(contact.payload?.district || "").trim();
      if (!district) continue;
      const key = normalize(district);
      const current = grouped.get(key) || {
        name: district,
        total: 0,
        mapped: 0,
        voters: 0,
        leaders: 0,
        mappedPercent: 0,
        priority: "critical" as Priority,
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

    return Array.from(grouped.values())
      .map((item) => {
        const mappedPercent = item.total
          ? Math.round((item.mapped / item.total) * 100)
          : 0;
        return {
          ...item,
          mappedPercent,
          priority: classify(item.total, mappedPercent),
        };
      })
      .sort((a, b) => a.mappedPercent - b.mappedPercent || b.total - a.total);
  }, [contacts]);

  const counts = useMemo(() => {
    return districts.reduce<Record<Priority, number>>(
      (accumulator, district) => {
        accumulator[district.priority] += 1;
        return accumulator;
      },
      { critical: 0, attention: 0, evolution: 0, consolidated: 0 },
    );
  }, [districts]);

  const filtered = districts.filter((district) => district.priority === active);

  if (!visible) return null;

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
    setVisible(false);
    window.dispatchEvent(
      new CustomEvent("voto-forte:priority-panel-toggle", {
        detail: { open: false },
      }),
    );
  };

  return (
    <aside className="vf-priority-panel" aria-label="Prioridades territoriais">
      <header>
        <div>
          <small>INTELIGÊNCIA TERRITORIAL</small>
          <strong>Painel de prioridades</strong>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            window.dispatchEvent(
              new CustomEvent("voto-forte:priority-panel-toggle", {
                detail: { open: false },
              }),
            );
          }}
        >
          Fechar
        </button>
      </header>

      <nav aria-label="Níveis de prioridade">
        {(Object.keys(labels) as Priority[]).map((priority) => (
          <button
            type="button"
            key={priority}
            className={active === priority ? "active" : ""}
            onClick={() => setActive(priority)}
          >
            <span>{labels[priority]}</span>
            <b>{counts[priority]}</b>
          </button>
        ))}
      </nav>

      <div className="vf-priority-list">
        {filtered.length ? (
          filtered.map((district) => (
            <button
              type="button"
              key={normalize(district.name)}
              className={`vf-priority-${district.priority}`}
              onClick={() => selectDistrict(district.name)}
            >
              <div>
                <strong>{district.name}</strong>
                <small>
                  {district.voters} eleitores · {district.leaders} lideranças
                </small>
              </div>
              <span>
                <b>{district.mappedPercent}%</b>
                <small>{district.total} cadastros</small>
              </span>
            </button>
          ))
        ) : (
          <p>Nenhum bairro nesta classificação.</p>
        )}
      </div>
    </aside>
  );
}
