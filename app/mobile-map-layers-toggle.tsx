"use client";

import { useEffect } from "react";

export default function MobileMapLayersToggle() {
  useEffect(() => {
    const enhanceMaps = () => {
      const maps = document.querySelectorAll<HTMLElement>(".full-map");

      maps.forEach((map) => {
        const legend = map.querySelector<HTMLElement>(".map-legend");
        if (!legend || map.querySelector("[data-vf-map-layers-toggle]")) return;

        legend.classList.remove("vf-map-legend-open");

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.vfMapLayersToggle = "true";
        button.className = "vf-map-layers-toggle";
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-label", "Mostrar camadas do mapa");
        button.textContent = "☰ Camadas";

        const setOpen = (open: boolean) => {
          legend.classList.toggle("vf-map-legend-open", open);
          button.setAttribute("aria-expanded", String(open));
          button.setAttribute(
            "aria-label",
            open ? "Ocultar camadas do mapa" : "Mostrar camadas do mapa",
          );
          button.textContent = open ? "✕ Ocultar" : "☰ Camadas";
        };

        button.addEventListener("click", () => {
          setOpen(!legend.classList.contains("vf-map-legend-open"));
        });

        map.appendChild(button);
      });
    };

    const observer = new MutationObserver(enhanceMaps);
    observer.observe(document.body, { childList: true, subtree: true });
    enhanceMaps();

    return () => observer.disconnect();
  }, []);

  return null;
}
