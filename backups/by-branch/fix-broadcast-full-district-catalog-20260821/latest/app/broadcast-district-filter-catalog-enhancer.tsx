"use client";

import { useEffect } from "react";

export default function BroadcastDistrictFilterCatalogEnhancer() {
  useEffect(() => {
    let disposed = false;
    let loaded = false;

    const apply = async () => {
      if (disposed || loaded) return;
      const select = Array.from(document.querySelectorAll<HTMLSelectElement>(".wt-drawer .wt-select"))
        .find((item) => Array.from(item.options).some((o) => (o.textContent || "").includes("Todos os Bairros")));
      if (!select) return;

      try {
        const response = await fetch("/api/map-district-markers", { cache: "no-store" });
        const data = await response.json();
        const districts = Array.from(new Set((data?.districts || []).map((d: {district?: string}) => String(d.district || "").trim()).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, "pt-BR"));

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

        if (current) select.value = current;
        loaded = true;
      } catch {}
    };

    const observer = new MutationObserver(() => void apply());
    observer.observe(document.body, { childList: true, subtree: true });
    void apply();

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
