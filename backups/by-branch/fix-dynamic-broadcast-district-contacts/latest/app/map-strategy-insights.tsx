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

type InsightType =
  | "expand-voters"
  | "recruit-leaders"
  | "improve-mapping"
  | "balanced";

type Insight = {
  district: string;
  total: number;
  voters: number;
  leaders: number;
  mappedPercent: number;
  type: InsightType;
  title: string;
  description: string;
  score: number;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function classifyInsight(
  district: string,
  total: number,
  voters: number,
  leaders: number,
  mappedPercent: number,
): Insight {
  const leaderRatio = total ? leaders / total : 0;
  const voterRatio = total ? voters / total : 0;

  if (mappedPercent < 60) {
    return {
      district,
      total,
      voters,
      leaders,
      mappedPercent,
      type: "improve-mapping",
      title: "Reforçar geolocalização",
      description: "Há cadastros suficientes, mas muitos ainda não aparecem corretamente no mapa.",
      score: 100 - mappedPercent + total,
    };
  }

  if (leaders >= 2 && voterRatio < 0.7) {
    return {
      district,
      total,
      voters,
      leaders,
      mappedPercent,
      type: "expand-voters",
      title: "Expandir base de eleitores",
      description: "O bairro possui lideranças, mas ainda há espaço para ampliar a quantidade de eleitores vinculados.",
      score: leaders * 12 - voters,
    };
  }

  if (voters >= 5 && leaderRatio < 0.12) {
    return {
      district,
      total,
      voters,
      leaders,
      mappedPercent,
      type: "recruit-leaders",
      title: "Buscar novas lideranças",
      description: "Existe uma base de eleitores relevante, porém poucas lideranças para apoiar a expansão local.",
      score: voters - leaders * 8,
    };
  }

  return {
    district,
    total,
    voters,
    leaders,
    mappedPercent,
    type: "balanced",
    title: "Estrutura equilibrada",
    description: "A relação entre eleitores, lideranças e mapeamento está equilibrada neste bairro.",
    score: total + mappedPercent / 10,
  };
}

const labels: Record<InsightType, string> = {
  "expand-voters": "Expandir eleitores",
  "recruit-leaders": "Buscar lideranças",
  "improve-mapping": "Corrigir mapeamento",
  balanced: "Equilibrados",
};

export default function MapStrategyInsights() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<InsightType>("expand-voters");

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
        // Mantém os demais recursos do mapa disponíveis.
      }
    };

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
      if (open) void load();
    };

    window.addEventListener("voto-forte:strategy-insights-toggle", handleToggle);
    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:strategy-insights-toggle", handleToggle);
    };
  }, []);

  const insights = useMemo(() => {
    const grouped = new Map<
      string,
      { district: string; total: number; voters: number; leaders: number; mapped: number }
    >();

    for (const contact of contacts) {
      const district = String(contact.payload?.district || "").trim();
      if (!district) continue;
      const key = normalize(district);
      const current = grouped.get(key) || {
        district,
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

    return Array.from(grouped.values())
      .map((item) => {
        const mappedPercent = item.total
          ? Math.round((item.mapped / item.total) * 100)
          : 0;
        return classifyInsight(
          item.district,
          item.total,
          item.voters,
          item.leaders,
          mappedPercent,
        );
      })
      .sort((a, b) => b.score - a.score);
  }, [contacts]);

  const counts = useMemo(() => {
    return insights.reduce<Record<InsightType, number>>(
      (accumulator, insight) => {
        accumulator[insight.type] += 1;
        return accumulator;
      },
      {
        "expand-voters": 0,
        "recruit-leaders": 0,
        "improve-mapping": 0,
        balanced: 0,
      },
    );
  }, [insights]);

  const filtered = insights.filter((insight) => insight.type === active);

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
      new CustomEvent("voto-forte:strategy-insights-toggle", {
        detail: { open: false },
      }),
    );
  };

  return (
    <aside className="vf-strategy-insights" aria-label="Insights estratégicos">
      <header>
        <div>
          <small>PLANEJAMENTO DE CAMPANHA</small>
          <strong>Insights estratégicos</strong>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            window.dispatchEvent(
              new CustomEvent("voto-forte:strategy-insights-toggle", {
                detail: { open: false },
              }),
            );
          }}
        >
          Fechar
        </button>
      </header>

      <nav aria-label="Tipos de insight">
        {(Object.keys(labels) as InsightType[]).map((type) => (
          <button
            type="button"
            key={type}
            className={active === type ? "active" : ""}
            onClick={() => setActive(type)}
          >
            <span>{labels[type]}</span>
            <b>{counts[type]}</b>
          </button>
        ))}
      </nav>

      <div className="vf-strategy-insights-list">
        {filtered.length ? (
          filtered.map((insight) => (
            <button
              type="button"
              key={`${normalize(insight.district)}-${insight.type}`}
              className={`vf-insight-${insight.type}`}
              onClick={() => selectDistrict(insight.district)}
            >
              <div>
                <strong>{insight.district}</strong>
                <b>{insight.title}</b>
                <small>{insight.description}</small>
              </div>
              <span>
                <b>{insight.total}</b>
                <small>cadastros</small>
                <em>{insight.mappedPercent}% mapeado</em>
              </span>
            </button>
          ))
        ) : (
          <p>Nenhum bairro encontrado nesta categoria.</p>
        )}
      </div>
    </aside>
  );
}
