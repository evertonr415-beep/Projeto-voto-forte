"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

const ENHANCED_ATTR = "data-vf-district-filter-enhanced";

function findDistrictSelect() {
  return Array.from(
    document.querySelectorAll<HTMLSelectElement>(".wt-drawer .wt-select"),
  ).find((select) =>
    Array.from(select.options).some((option) =>
      option.textContent?.trim().toLocaleLowerCase("pt-BR").startsWith("todos os bairros"),
    ),
  );
}

async function loadCatalog() {
  const response = await apiFetch("/api/district-catalog", {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.districts) ? payload.districts : [];
}

export default function BroadcastNeighborhoodOptionsEnhancer() {
  useEffect(() => {
    let disposed = false;

    const applyCatalog = (districts: string[]) => {
      if (disposed) return;
      const select = findDistrictSelect();
      if (!select || select.dataset[ENHANCED_ATTR]) return;

      const current = select.value;
      select.replaceChildren();

      const all = document.createElement("option");
      all.value = "Todos";
      all.textContent = "Todos os Bairros";
      select.appendChild(all);

      districts.forEach((district) => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        select.appendChild(option);
      });

      select.value = Array.from(select.options).some((o) => o.value === current)
        ? current
        : "Todos";
      select.dataset[ENHANCED_ATTR] = "true";
    };

    const load = async () => {
      try {
        const districts = await loadCatalog();
        applyCatalog(districts);
      } catch {
        // Mantém o filtro original em caso de indisponibilidade.
      }
    };

    void load();

    return () => {
      disposed = true;
    };
  }, []);

  return null;
}
