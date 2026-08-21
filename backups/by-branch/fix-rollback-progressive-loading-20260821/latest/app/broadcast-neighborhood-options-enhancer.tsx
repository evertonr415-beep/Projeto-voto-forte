"use client";

import { useEffect } from "react";

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
  const response = await fetch("/api/district-catalog", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.districts) ? payload.districts : [];
}

export default function BroadcastNeighborhoodOptionsEnhancer() {
  useEffect(() => {
    let disposed = false;
    let loaded = false;
    let districts: string[] = [];

    const sync = () => {
      if (disposed) return;
      const select = findDistrictSelect();
      if (!select || !loaded || select.dataset[ENHANCED_ATTR]) return;

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
        districts = await loadCatalog();
        loaded = true;
        sync();
      } catch {
        // Mantém o filtro original em caso de indisponibilidade.
      }
    };

    void load();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
