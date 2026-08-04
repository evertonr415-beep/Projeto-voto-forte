"use client";

import { useEffect, useState } from "react";

type Panel = "district" | "heatmap" | "mapping" | null;

function hasVisibleMap() {
  return Array.from(document.querySelectorAll<HTMLElement>(".leaflet-container")).some((map) => {
    const rect = map.getBoundingClientRect();
    const style = window.getComputedStyle(map);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  });
}

export default function MobileAnalyticsControls() {
  const [visible, setVisible] = useState(false);
  const [openPanel, setOpenPanel] = useState<Panel>(null);

  useEffect(() => {
    const refresh = () => {
      const nextVisible = hasVisibleMap();
      setVisible(nextVisible);
      if (!nextVisible) setOpenPanel(null);
    };

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, { passive: true });
    refresh();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.vfMobileAnalytics = openPanel || "closed";
    return () => {
      delete document.body.dataset.vfMobileAnalytics;
    };
  }, [openPanel]);

  if (!visible) return null;

  const toggle = (panel: Exclude<Panel, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  return (
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
        <button type="button" className="vf-mobile-analytics-close" onClick={() => setOpenPanel(null)} aria-label="Minimizar ferramentas">
          Minimizar
        </button>
      )}
    </nav>
  );
}
