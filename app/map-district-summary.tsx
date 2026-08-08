"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSharedTerritorySummary } from "./territory-data-client";

type Summary = {
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

export default function MapDistrictSummary() {
  const [districts, setDistricts] = useState<Summary[]>([]);
  const [selected, setSelected] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    loadSharedTerritorySummary()
      .then((summary) => {
        setDistricts(
          summary.districts.map((item) => ({
            name: item.district,
            total: item.total,
          })),
        );
      })
      .catch(() => undefined);

    const handleSelected = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      setSelected(district);
      setVisible(Boolean(district));
    };

    window.addEventListener("voto-forte:district-selected", handleSelected);
    window.addEventListener("voto-forte:district-filter-change", handleSelected);
    return () => {
      window.removeEventListener("voto-forte:district-selected", handleSelected);
      window.removeEventListener("voto-forte:district-filter-change", handleSelected);
    };
  }, []);

  const summary = useMemo(
    () =>
      districts.find(
        (district) => normalize(district.name) === normalize(selected),
      ),
    [districts, selected],
  );

  if (!visible || !summary) return null;

  return (
    <aside className="vf-district-summary-card" aria-live="polite">
      <div className="vf-district-summary-main">
        <small>BAIRRO SELECIONADO</small>
        <strong>{summary.name}</strong>
      </div>
      <div className="vf-district-summary-stats">
        <span>
          <b>{summary.total.toLocaleString("pt-BR")}</b> cadastros
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setSelected("");
          setVisible(false);
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
