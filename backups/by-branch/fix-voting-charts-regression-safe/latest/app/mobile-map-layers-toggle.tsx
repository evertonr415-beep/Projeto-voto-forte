"use client";

import { useEffect } from "react";

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function isMapFilterOpen() {
  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [aria-modal="true"], .modal, .dialog, .fixed.inset-0',
    ),
  );

  return dialogs.some((dialog) => {
    if (!isVisible(dialog)) return false;
    const text = dialog.textContent?.toLowerCase() || "";
    return text.includes("filtros do mapa") || text.includes("limites oficiais de bairros");
  });
}

export default function MobileMapLayersToggle() {
  useEffect(() => {
    const syncButtonsWithModal = () => {
      const modalOpen = isMapFilterOpen();
      document
        .querySelectorAll<HTMLButtonElement>("[data-vf-map-layers-toggle]")
        .forEach((button) => {
          button.hidden = modalOpen;
          button.setAttribute("aria-hidden", String(modalOpen));
          button.tabIndex = modalOpen ? -1 : 0;
        });
    };

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

      syncButtonsWithModal();
    };

    const appShell = document.querySelector<HTMLElement>(".app-shell");
    const observer = appShell
      ? new MutationObserver(() => {
          syncButtonsWithModal();
        })
      : null;

    if (observer && appShell) {
      observer.observe(appShell, {
        childList: true,
        subtree: false,
      });
    }

    enhanceMaps();
    syncButtonsWithModal();

    return () => observer?.disconnect();
  }, []);

  return null;
}
