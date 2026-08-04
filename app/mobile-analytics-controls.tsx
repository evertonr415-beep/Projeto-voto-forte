"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Panel =
  | "district"
  | "heatmap"
  | "mapping"
  | "priority"
  | "strategy"
  | "dashboard"
  | null;

type Host = {
  root: HTMLElement;
  controls: HTMLElement;
  panel: HTMLElement;
};

const panelSelectors: Record<Exclude<Panel, null>, string> = {
  district: ".vf-district-filter",
  heatmap: ".vf-heatmap-control",
  mapping: ".vf-map-progress",
  priority: ".vf-priority-panel",
  strategy: ".vf-strategy-insights",
  dashboard: ".vf-executive-dashboard",
};

const panelLabels: Record<Exclude<Panel, null>, string> = {
  district: "Análise territorial",
  heatmap: "Mapa de calor",
  mapping: "Mapeamento",
  priority: "Prioridades",
  strategy: "Insights estratégicos",
  dashboard: "Dashboard Executivo",
};

function findVisibleMap() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(".leaflet-container")).find(
      (map) => {
        const rect = map.getBoundingClientRect();
        const style = window.getComputedStyle(map);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      },
    ) || null
  );
}

export default function MobileAnalyticsControls() {
  const [host, setHost] = useState<Host | null>(null);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
        setMenuOpen(false);
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
        panel.id = "vf-mobile-analytics-panel";

        root.append(controls, panel);
        map.insertAdjacentElement("afterend", root);
        currentHost = { root, controls, panel };
        setHost(currentHost);
      }
    };

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    window.addEventListener("resize", refresh);
    window.addEventListener("popstate", refresh);
    refresh();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("popstate", refresh);
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
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menuOpen) setMenuOpen(false);
      else closePanel();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  });

  useEffect(() => {
    if (!host || !openPanel) return;

    let movedElement: HTMLElement | null = null;
    let originalParent: Node | null = null;
    let originalNextSibling: Node | null = null;

    const movePanel = () => {
      if (movedElement?.isConnected) return true;
      const element = document.querySelector<HTMLElement>(
        panelSelectors[openPanel],
      );
      if (!element) return false;

      movedElement = element;
      originalParent = element.parentNode;
      originalNextSibling = element.nextSibling;
      host.panel.appendChild(element);
      window.setTimeout(() => {
        host.panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
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
      if (
        originalNextSibling &&
        originalNextSibling.parentNode === originalParent
      ) {
        originalParent.insertBefore(movedElement, originalNextSibling);
      } else {
        originalParent.appendChild(movedElement);
      }
    };
  }, [host, openPanel]);

  useEffect(() => {
    const syncClose = (panel: Panel) => (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      if (!open && openPanel === panel) setOpenPanel(null);
    };

    const handlePriorityClose = syncClose("priority");
    const handleStrategyClose = syncClose("strategy");
    const handleDashboardClose = syncClose("dashboard");

    window.addEventListener(
      "voto-forte:priority-panel-toggle",
      handlePriorityClose,
    );
    window.addEventListener(
      "voto-forte:strategy-insights-toggle",
      handleStrategyClose,
    );
    window.addEventListener(
      "voto-forte:executive-dashboard-toggle",
      handleDashboardClose,
    );

    return () => {
      window.removeEventListener(
        "voto-forte:priority-panel-toggle",
        handlePriorityClose,
      );
      window.removeEventListener(
        "voto-forte:strategy-insights-toggle",
        handleStrategyClose,
      );
      window.removeEventListener(
        "voto-forte:executive-dashboard-toggle",
        handleDashboardClose,
      );
    };
  }, [openPanel]);

  if (!host) return null;

  const dispatchPanelState = (panel: Panel) => {
    window.dispatchEvent(
      new CustomEvent("voto-forte:priority-panel-toggle", {
        detail: { open: panel === "priority" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("voto-forte:strategy-insights-toggle", {
        detail: { open: panel === "strategy" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("voto-forte:executive-dashboard-toggle", {
        detail: { open: panel === "dashboard" },
      }),
    );
  };

  const selectPanel = (panel: Exclude<Panel, null>) => {
    setOpenPanel(panel);
    setMenuOpen(false);
    dispatchPanelState(panel);
  };

  function closePanel() {
    setOpenPanel(null);
    dispatchPanelState(null);
  }

  return createPortal(
    <div className="vf-mobile-analytics-controls">
      <button
        type="button"
        className={`vf-map-tools-trigger ${menuOpen ? "active" : ""}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
        Ferramentas do mapa
        <b aria-hidden="true">{menuOpen ? "▲" : "▼"}</b>
      </button>

      {menuOpen && (
        <div className="vf-map-tools-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => selectPanel("dashboard")}>
            <span aria-hidden="true">📊</span>
            <div>
              <strong>Dashboard Executivo</strong>
              <small>Indicadores e rankings consolidados</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("district")}>
            <span aria-hidden="true">⌖</span>
            <div>
              <strong>Análise territorial</strong>
              <small>Filtrar e analisar bairros</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("heatmap")}>
            <span aria-hidden="true">🔥</span>
            <div>
              <strong>Mapa de calor</strong>
              <small>Visualizar concentrações</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("mapping")}>
            <span aria-hidden="true">📍</span>
            <div>
              <strong>Mapeamento</strong>
              <small>Acompanhar geocodificação</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("priority")}>
            <span aria-hidden="true">🎯</span>
            <div>
              <strong>Prioridades</strong>
              <small>Identificar bairros que exigem ação</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("strategy")}>
            <span aria-hidden="true">💡</span>
            <div>
              <strong>Insights estratégicos</strong>
              <small>Equilibrar eleitores, lideranças e mapeamento</small>
            </div>
          </button>
        </div>
      )}

      {openPanel && (
        <div className="vf-map-tools-active">
          <span>{panelLabels[openPanel]}</span>
          <button type="button" onClick={closePanel}>
            Fechar painel
          </button>
        </div>
      )}
    </div>,
    host.controls,
  );
}
