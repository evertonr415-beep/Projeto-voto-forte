"use client";

import { useLayoutEffect } from "react";

const STYLE_ID = "vf-map-initial-render-fix";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function MapInstantContactBootstrap() {
  useLayoutEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        html:not(.vf-mobile-map-fallback) .full-map:not(.vf-mobile-map-ui) .real-map-toolbar,
        html:not(.vf-mobile-map-fallback) .full-map:not(.vf-mobile-map-ui) .leaflet-control-zoom,
        html:not(.vf-mobile-map-fallback) .full-map:not(.vf-mobile-map-ui) .map-legend {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
        .full-map .vf-map-bootstrap-person {
          background: transparent !important;
          border: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }

    let cancelled = false;
    let activeMap: any = null;
    let bootstrapLayer: any = null;
    let observer: MutationObserver | null = null;
    let frame: number | null = null;

    const clearBootstrap = () => {
      observer?.disconnect();
      observer = null;
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      if (activeMap && bootstrapLayer) {
        try {
          activeMap.removeLayer(bootstrapLayer);
        } catch {
          // O mapa pode ter sido destruido pela navegacao.
        }
      }
      bootstrapLayer = null;
    };

    const hasModernPins = (map: any) => {
      const container = map?.getContainer?.() as HTMLElement | undefined;
      return Boolean(
        container?.querySelector(
          ".leaflet-marker-icon.vf-map-person:not(.vf-map-bootstrap-person)",
        ),
      );
    };

    const copyLegacyPins = (map: any) => {
      if (cancelled || bootstrapLayer || !map?._container) return false;
      const L = (window as any).L;
      if (!L?.layerGroup || !L?.marker || !L?.divIcon) return false;

      const sourceLayers: any[] = [];
      map.eachLayer?.((layer: any) => {
        const className = String(layer?.options?.icon?.options?.className || "");
        if (className.includes("contact-pin")) sourceLayers.push(layer);
      });
      if (!sourceLayers.length) return false;

      const nextLayer = L.layerGroup().addTo(map);
      for (const source of sourceLayers) {
        const point = source?.getLatLng?.();
        if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
          continue;
        }
        const popupContent = String(source?.getPopup?.()?.getContent?.() ?? "");
        const isLeader = popupContent.toLocaleLowerCase("pt-BR").includes("liderança");
        const marker = L.marker([Number(point.lat), Number(point.lng)], {
          icon: L.divIcon({
            className: "vf-map-person vf-map-bootstrap-person",
            html: `<span class="vf-map-pin ${isLeader ? "leader" : "voter"}"><i>${isLeader ? "L" : "•"}</i></span>`,
            iconSize: [32, 36],
            iconAnchor: [15, 32],
            popupAnchor: [0, -30],
          }),
        });
        if (popupContent) marker.bindPopup(popupContent, { closeButton: true });
        marker.addTo(nextLayer);
      }

      bootstrapLayer = nextLayer;
      const container = map.getContainer?.() as HTMLElement | undefined;
      if (container) {
        observer = new MutationObserver(() => {
          if (hasModernPins(map)) clearBootstrap();
        });
        observer.observe(container, { childList: true, subtree: true });
      }
      if (hasModernPins(map)) clearBootstrap();
      return true;
    };

    const attach = (map: any) => {
      if (cancelled || !map?._container) return;
      clearBootstrap();
      activeMap = map;

      let attempts = 0;
      const seek = () => {
        frame = null;
        if (cancelled || activeMap !== map || !map?._container) return;
        if (copyLegacyPins(map)) return;
        attempts += 1;
        if (attempts < 30) frame = window.requestAnimationFrame(seek);
      };
      frame = window.requestAnimationFrame(seek);
    };

    const handleBaseReady = (event: Event) => {
      attach((event as CustomEvent<{ map?: any }>).detail?.map);
    };
    const handleFilterChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".vf-map-contact-tabs") || target?.matches(".scope-picker select")) {
        clearBootstrap();
      }
    };

    window.addEventListener("voto-forte:base-electoral-map-ready", handleBaseReady);
    document.addEventListener("click", handleFilterChange, true);
    document.addEventListener("change", handleFilterChange, true);

    const existingMap = (window as any).__vfBaseElectoralMap;
    if (existingMap?._container) attach(existingMap);

    return () => {
      cancelled = true;
      clearBootstrap();
      window.removeEventListener("voto-forte:base-electoral-map-ready", handleBaseReady);
      document.removeEventListener("click", handleFilterChange, true);
      document.removeEventListener("change", handleFilterChange, true);
      activeMap = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
