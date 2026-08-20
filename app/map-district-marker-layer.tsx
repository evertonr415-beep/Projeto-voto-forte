"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictMarker = {
  district: string;
  total: number;
  voters: number;
  leaders: number;
  latitude: number;
  longitude: number;
};

type DistrictMarkerResponse = {
  markers?: DistrictMarker[];
  error?: string;
};

const STYLE_ID = "vf-district-marker-layer-styles";
const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-district-marker{background:transparent!important;border:0!important}
    .vf-district-marker span{display:grid;place-items:center;min-width:46px;height:46px;padding:0 7px;border-radius:50%;background:#356ea8;color:#fff;border:3px solid rgba(255,255,255,.96);box-shadow:0 4px 14px rgba(15,35,65,.28);font:850 11px/1 Arial,sans-serif;white-space:nowrap}
    .vf-district-popup{min-width:190px;font:500 12px/1.4 Arial,sans-serif;color:#23354d}
    .vf-district-popup strong{display:block;font-size:14px;color:#17345c;margin-bottom:5px}
    .vf-district-popup b{display:inline-block;border-radius:999px;padding:3px 7px;margin-bottom:5px;background:#eaf2fb;color:#285b8e;font-size:10px}
    .vf-district-popup p{margin:4px 0 0}
    .vf-district-popup small{display:block;margin-top:7px;color:#64748b}
    @media(max-width:760px){.vf-district-marker span{min-width:40px;height:40px;padding:0 6px;font-size:10px}}
  `;
  document.head.appendChild(style);
}

export default function MapDistrictMarkerLayer() {
  useEffect(() => {
    installStyles();
    let cancelled = false;
    let activeMap: any = null;
    let districtLayer: any = null;
    let requestId = 0;
    let retryTimer: number | null = null;

    const clearLayer = () => {
      if (!activeMap || !districtLayer) return;
      try {
        activeMap.removeLayer(districtLayer);
      } catch {
        // O mapa pode ter sido desmontado durante a navegação.
      }
      districtLayer = null;
    };

    const render = async (map: any) => {
      if (cancelled || !map?._container) return;
      const L = (window as any).L;
      if (!L) return;

      if (activeMap !== map) {
        clearLayer();
        activeMap = map;
      }

      const id = ++requestId;
      const params = new URLSearchParams();
      const scope = currentScope();
      if (scope) params.set("owner", scope);

      try {
        const response = await apiFetch(
          `/api/map-district-markers${params.size ? `?${params.toString()}` : ""}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as DistrictMarkerResponse;
        if (!response.ok) throw new Error(data.error || "Falha ao carregar bairros");
        if (cancelled || id !== requestId || activeMap !== map || !map._container) return;

        const nextLayer = L.layerGroup();
        for (const markerData of Array.isArray(data.markers) ? data.markers : []) {
          const latitude = Number(markerData.latitude);
          const longitude = Number(markerData.longitude);
          const total = Math.max(0, Number(markerData.total || 0));
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || total <= 0) continue;

          const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "vf-district-marker",
              html: `<span>${NUMBER_FORMATTER.format(total)}</span>`,
              iconSize: [50, 50],
              iconAnchor: [25, 25],
              popupAnchor: [0, -22],
            }),
            zIndexOffset: -400,
          });

          marker.bindPopup(
            `<div class="vf-district-popup"><strong>${escapeHtml(markerData.district)}</strong><b>Total do bairro</b><p>${NUMBER_FORMATTER.format(total)} contato(s)</p><p>${NUMBER_FORMATTER.format(Number(markerData.voters || 0))} eleitor(es) · ${NUMBER_FORMATTER.format(Number(markerData.leaders || 0))} liderança(s)</p><small>Posição territorial aproximada do bairro. Os pinos individuais continuam representando endereços exatos.</small></div>`,
            { maxWidth: 290, closeButton: true },
          );
          marker.addTo(nextLayer);
        }

        clearLayer();
        districtLayer = nextLayer.addTo(map);
      } catch (error) {
        console.error("Failed to render district marker layer", error);
        // Falha isolada: não remove nem altera pinos individuais.
      }
    };

    const attach = () => {
      const map = (window as any).__vfElectoralMap || (window as any).__vfBaseElectoralMap;
      if (!map?._container) return false;
      void render(map);
      return true;
    };

    const handleMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map?._container) void render(map);
    };

    const handleScopeChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      if (activeMap?._container) void render(activeMap);
    };

    const handleRecordsChanged = () => {
      if (activeMap?._container) void render(activeMap);
    };

    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:base-electoral-map-ready", handleMapReady);
    document.addEventListener("change", handleScopeChange, true);
    window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
    window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);

    if (!attach()) {
      retryTimer = window.setInterval(() => {
        if (attach() && retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 120);
      window.setTimeout(() => {
        if (retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 10000);
    }

    return () => {
      cancelled = true;
      requestId += 1;
      if (retryTimer !== null) window.clearInterval(retryTimer);
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      document.removeEventListener("change", handleScopeChange, true);
      window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
      clearLayer();
      activeMap = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
