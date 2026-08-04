"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Panel = "district" | "heatmap" | "mapping" | null;

function findVisibleMap() {
  return Array.from(document.querySelectorAll<HTMLElement>(".leaflet-container")).find((map) => {
    const rect = map.getBoundingClientRect();
    const style = window.getComputedStyle(map);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }) || null;
}

export default function MobileAnalyticsControls() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [openPanel, setOpenPanel] = useState<Panel>(null);

  useEffect(() => {
    let currentHost: HTMLElement | null = null;

    const refresh = () => {
      const map = findVisibleMap();
      if (!map) {
        setOpenPanel(null);
        setHost(null);
        currentHost?.remove();
        currentHost = null;
        return;
      }

      if (!currentHost || !currentHost.isConnected) {
        currentHost = document.createElement("div");
        currentHost.className = "vf-mobile-analytics-host";
        map.insertAdjacentElement("afterend", currentHost);
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
      currentHost?.remove();
    };
  }, []);

  useEffect(() => {
    document.body.dataset.vfMobileAnalytics = openPanel || "closed";
    return () => {
      delete document.body.dataset.vfMobileAnalytics;
    };
  }, [openPanel]);

  if (!host) return null;

  const toggle = (panel: Exclude<Panel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return createPortal(
    <nav className="vf-mobile-analytics-controls" aria-label="Ferramentas do mapa">
      <button type="button" className={openPanel === "district" ? "active" : ""} onClick={() => toggle("district")}>
        Análise territorial
      </button>
      <button type="button" className={openPanel === "heatmap" ? "active" : ""} onClick={() => toggle("heatmap")}>
        Mapa de calor
      </button>
      <button type="button" className={openPanel === "mapping" ? "active" : ""} onClick={() => toggle("mapping")}>
        Mapeamento
      </button>
      {openPanel && (
        <button type="button" className="vf-mobile-analytics-close" onClick={() => setOpenPanel(null)}>
          Minimizar
        </button>
      )}
    </nav>,
    host,
  );
}
