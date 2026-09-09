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

type RankingItem = {
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
  return Boolean(document.querySelector(".leaflet-container"));
}

export default function MapDistrictRanking() {
  const [visible, setVisible] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [expanded, setExpanded] = useState(false);

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
          setContacts((data.records || []).filter((item) => item.kind === "contact"));
        }
      } catch {
        // O mapa continua funcional mesmo se o ranking não carregar.
      }
    };

    const observer = new MutationObserver(() => void load());
    observer.observe(document.body, { childList: true, subtree: true });
    void load();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const ranking = useMemo(() => {
    const grouped = new Map<string, RankingItem>();
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

  if (!visible || !ranking.length) return null;

  const items = expanded ? ranking.slice(0, 15) : ranking.slice(0, 5);
  const maximum = ranking[0]?.total || 1;

  return (
    <aside className="vf-district-ranking">
      <div className="vf-ranking-head">
        <div>
          <small>COBERTURA TERRITORIAL</small>
          <strong>Ranking de bairros</strong>
        </div>
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Mostrar menos" : "Ver top 15"}
        </button>
      </div>

      <div className="vf-ranking-list">
        {items.map((item, index) => {
          const mappedPercent = item.total
            ? Math.round((item.mapped / item.total) * 100)
            : 0;
          const width = Math.max(8, Math.round((item.total / maximum) * 100));
          return (
            <button
              type="button"
              key={normalize(item.name)}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("voto-forte:district-selected", {
                    detail: { district: item.name },
                  }),
                );
                window.dispatchEvent(
                  new CustomEvent("voto-forte:district-filter-change", {
                    detail: { district: item.name },
                  }),
                );
              }}
            >
              <div className="vf-ranking-title">
                <span><b>{index + 1}</b>{item.name}</span>
                <strong>{item.total}</strong>
              </div>
              <div className="vf-ranking-bar"><i style={{ width: `${width}%` }} /></div>
              <small>
                {item.voters} eleitores · {item.leaders} lideranças · {mappedPercent}% mapeado
              </small>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
