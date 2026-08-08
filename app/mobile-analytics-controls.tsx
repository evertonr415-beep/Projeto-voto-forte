"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Panel =
  | "district"
  | "heatmap"
  | "mapping"
  | "dashboard"
  | "quality"
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
  dashboard: ".vf-executive-dashboard",
  quality: ".vf-data-quality-panel",
};

const panelLabels: Record<Exclude<Panel, null>, string> = {
  district: "Análise territorial",
  heatmap: "Mapa de calor",
  mapping: "Mapeamento",
  dashboard: "Dashboard Executivo",
  quality: "Qualidade dos Dados",
};

const panelEvents = {
  heatmap: "voto-forte:heatmap-toggle",
  mapping: "voto-forte:geocoding-panel-toggle",
  dashboard: "voto-forte:executive-dashboard-toggle",
  quality: "voto-forte:data-quality-toggle",
} as const;

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

function dispatchPanelState(panel: Panel) {
  (Object.entries(panelEvents) as Array<
    [keyof typeof panelEvents, (typeof panelEvents)[keyof typeof panelEvents]]
  >).forEach(([key, eventName]) => {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { open: panel === key },
      }),
    );
  });
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
        dispatchPanelState(null);
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
      dispatchPanelState(null);
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
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      setOpenPanel(null);
      dispatchPanelState(null);
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [menuOpen]);

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
    const handlers = (Object.entries(panelEvents) as Array<
      [keyof typeof panelEvents, (typeof panelEvents)[keyof typeof panelEvents]]
    >).map(([panel, eventName]) => {
      const handler = (event: Event) => {
        const open = Boolean(
          (event as CustomEvent<{ open?: boolean }>).detail?.open,
        );
        if (!open && openPanel === panel) setOpenPanel(null);
      };
      window.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      handlers.forEach(({ eventName, handler }) => {
        window.removeEventListener(eventName, handler);
      });
    };
  }, [openPanel]);

  if (!host) return null;

  const selectPanel = (panel: Exclude<Panel, null>) => {
    setOpenPanel(panel);
    setMenuOpen(false);
    dispatchPanelState(panel);
  };

  const closePanel = () => {
    setOpenPanel(null);
    dispatchPanelState(null);
  };

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
              <small>Indicadores consolidados</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("quality")}>
            <span aria-hidden="true">✅</span>
            <div>
              <strong>Qualidade dos Dados</strong>
              <small>Localizar pendências e inconsistências</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("district")}>
            <span aria-hidden="true">⌖</span>
            <div>
              <strong>Análise territorial</strong>
              <small>Filtrar bairros pela base agregada</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("heatmap")}>
            <span aria-hidden="true">🔥</span>
            <div>
              <strong>Mapa de calor</strong>
              <small>Visualizar pontos georreferenciados</small>
            </div>
          </button>
          <button type="button" role="menuitem" onClick={() => selectPanel("mapping")}>
            <span aria-hidden="true">📍</span>
            <div>
              <strong>Mapeamento</strong>
              <small>Acompanhar geocodificação</small>
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
