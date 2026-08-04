"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Panel = "district" | "heatmap" | "mapping" | null;
type Host = {
  root: HTMLElement;
  controls: HTMLElement;
  panel: HTMLElement;
};

const panelSelectors: Record<Exclude<Panel, null>, string> = {
  district: ".vf-district-filter",
  heatmap: ".vf-heatmap-control",
  mapping: ".vf-map-progress",
};

function findVisibleMap() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(".leaflet-container")).find((map) => {
      const rect = map.getBoundingClientRect();
      const style = window.getComputedStyle(map);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }) || null
  );
}

export default function MobileAnalyticsControls() {
  const [host, setHost] = useState<Host | null>(null);
  const [openPanel, setOpenPanel] = useState<Panel>(null);

  useEffect(() => {
    let currentHost: Host | null = null;

    const removeHost = () => {
      currentHost?.root.remove();
      currentHost = null;
      setHost(null);
    };

    const refresh = () => {
      const map = findVisibleMap();
      if (!map) {
        setOpenPanel(null);
        removeHost();
        return;
      }

      if (!currentHost || !currentHost.root.isConnected) {
        const root = document.createElement("section");
        root.className = "vf-mobile-analytics-host";

        const controls = document.createElement("div");
        controls.className = "vf-mobile-analytics-controls-slot";

        const panel = document.createElement("div");
        panel.className = "vf-mobile-analytics-panel-slot";

        root.append(controls, panel);
        map.insertAdjacentElement("afterend", root);
        currentHost = { root, controls, panel };
        setHost(currentHost);
      }
    };

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", refresh);
    refresh();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      removeHost();
    };
  }, []);

  useEffect(() => {
    document.body.dataset.vfMobileAnalytics = openPanel || "closed";
    return () => {
      delete document.body.dataset.vfMobileAnalytics;
    };
  }, [openPanel]);

  useEffect(() => {
    if (!host || !openPanel) return;

    let movedElement: HTMLElement | null = null;
    let originalParent: Node | null = null;
    let originalNextSibling: Node | null = null;

    const movePanel = () => {
      if (movedElement?.isConnected) return true;
      const element = document.querySelector<HTMLElement>(panelSelectors[openPanel]);
      if (!element) return false;

      movedElement = element;
      originalParent = element.parentNode;
      originalNextSibling = element.nextSibling;
      host.panel.appendChild(element);
      return true;
    };

    if (!movePanel()) {
      const observer = new MutationObserver(() => {
        if (movePanel()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }

    return () => {
      if (!movedElement || !originalParent) return;
      if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(movedElement, originalNextSibling);
      } else {
        originalParent.appendChild(movedElement);
      }
    };
  }, [host, openPanel]);

  if (!host) return null;

  const toggle = (panel: Exclude<Panel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return createPortal(
    <nav className="vf-mobile-analytics-controls" aria-label="Ferramentas do mapa">
      <button
        type="button"
        className={openPanel === "district" ? "active" : ""}
        onClick={() => toggle("district")}
      >
        Análise territorial
      </button>
      <button
        type="button"
        className={openPanel === "heatmap" ? "active" : ""}
        onClick={() => toggle("heatmap")}
      >
        Mapa de calor
      </button>
      <button
        type="button"
        className={openPanel === "mapping" ? "active" : ""}
        onClick={() => toggle("mapping")}
      >
        Mapeamento
      </button>
      {openPanel && (
        <button
          type="button"
          className="vf-mobile-analytics-close"
          onClick={() => setOpenPanel(null)}
        >
          Minimizar
        </button>
      )}
    </nav>,
    host.controls,
  );
}
