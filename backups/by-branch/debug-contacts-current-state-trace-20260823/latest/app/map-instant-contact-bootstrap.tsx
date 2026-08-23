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
    let restoreTimer: number | null = null;
    let originalMarkerFactory: any = null;

    const restoreMarkerFactory = () => {
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
      restoreTimer = null;
      const L = (window as any).L;
      if (L?.marker && originalMarkerFactory && L.marker.__vfBootstrapWrapped) {
        L.marker = originalMarkerFactory;
      }
      originalMarkerFactory = null;
    };

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

    const watchModernPins = (map: any) => {
      if (observer || !bootstrapLayer) return;
      const container = map?.getContainer?.() as HTMLElement | undefined;
      if (!container) return;
      observer = new MutationObserver(() => {
        if (hasModernPins(map)) clearBootstrap();
      });
      observer.observe(container, { childList: true, subtree: true });
      if (hasModernPins(map)) clearBootstrap();
    };

    const addBootstrapMarker = (
      map: any,
      L: any,
      pointValue: any,
      popupContent: string,
    ) => {
      if (cancelled || !map?._container) return;
      const point = Array.isArray(pointValue)
        ? { lat: Number(pointValue[0]), lng: Number(pointValue[1]) }
        : { lat: Number(pointValue?.lat), lng: Number(pointValue?.lng) };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

      if (!bootstrapLayer) bootstrapLayer = L.layerGroup().addTo(map);
      const isLeader = popupContent.toLocaleLowerCase("pt-BR").includes("liderança");
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: "vf-map-person vf-map-bootstrap-person",
          html: `<span class="vf-map-pin ${isLeader ? "leader" : "voter"}"><i>${isLeader ? "L" : "•"}</i></span>`,
          iconSize: [32, 36],
          iconAnchor: [15, 32],
          popupAnchor: [0, -30],
        }),
      });
      if (popupContent) marker.bindPopup(popupContent, { closeButton: true });
      marker.addTo(bootstrapLayer);
      watchModernPins(map);
    };

    const patchMarkerFactory = (map: any) => {
      const L = (window as any).L;
      if (!L?.marker || L.marker.__vfBootstrapWrapped) return false;
      originalMarkerFactory = L.marker;
      const original = originalMarkerFactory;
      const wrapped = function (this: unknown, ...args: any[]) {
        const marker = original.apply(this, args);
        const className = String(args[1]?.icon?.options?.className || "");
        if (className.includes("contact-pin") && marker?.bindPopup) {
          const originalBindPopup = marker.bindPopup.bind(marker);
          marker.bindPopup = (content: unknown, ...rest: any[]) => {
            const result = originalBindPopup(content, ...rest);
            addBootstrapMarker(map, L, args[0], String(content ?? ""));
            return result;
          };
        }
        return marker;
      };
      Object.assign(wrapped, original);
      wrapped.__vfBootstrapWrapped = true;
      L.marker = wrapped;
      restoreTimer = window.setTimeout(restoreMarkerFactory, 0);
      return true;
    };

    const copyExistingLegacyPins = (map: any) => {
      if (cancelled || bootstrapLayer || !map?._container) return false;
      const L = (window as any).L;
      if (!L?.layerGroup || !L?.marker || !L?.divIcon) return false;

      let copied = 0;
      map.eachLayer?.((layer: any) => {
        const className = String(layer?.options?.icon?.options?.className || "");
        if (!className.includes("contact-pin")) return;
        const point = layer?.getLatLng?.();
        const popupContent = String(layer?.getPopup?.()?.getContent?.() ?? "");
        addBootstrapMarker(map, L, point, popupContent);
        copied += 1;
      });
      return copied > 0;
    };

    const attach = (map: any) => {
      if (cancelled || !map?._container) return;
      clearBootstrap();
      restoreMarkerFactory();
      activeMap = map;
      patchMarkerFactory(map);

      let attempts = 0;
      const seek = () => {
        frame = null;
        if (cancelled || activeMap !== map || !map?._container || bootstrapLayer) return;
        if (copyExistingLegacyPins(map)) return;
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
      restoreMarkerFactory();
      window.removeEventListener("voto-forte:base-electoral-map-ready", handleBaseReady);
      document.removeEventListener("click", handleFilterChange, true);
      document.removeEventListener("change", handleFilterChange, true);
      activeMap = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
