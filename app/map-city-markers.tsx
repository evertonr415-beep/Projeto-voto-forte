"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */

type CityMarker = {
  city: string;
  total: number;
  voters: number;
  leaders: number;
  latitude: number;
  longitude: number;
};

const STYLE_ID = "vf-city-markers-styles";
const NUMBER = new Intl.NumberFormat("pt-BR");

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-city-marker{background:transparent!important;border:0!important}
    .vf-city-marker span{
      display:grid;place-items:center;min-width:40px;height:40px;padding:0 8px;
      border-radius:50%;
      background:linear-gradient(135deg,#17345c 0%,#1e4d8c 100%);
      color:#fff;border:3px solid rgba(255,255,255,.92);
      box-shadow:0 4px 16px rgba(15,35,65,.35);
      font:900 13px/1 Arial,sans-serif;
      transition:transform .15s ease;
    }
    .vf-city-marker:hover span{transform:scale(1.15)}
    .vf-city-marker.large span{
      min-width:52px;height:52px;font-size:15px;
      background:linear-gradient(135deg,#0f2744 0%,#17345c 100%);
      border-width:4px;
      box-shadow:0 6px 22px rgba(15,35,65,.45);
    }
    .vf-city-marker.medium span{min-width:44px;height:44px;font-size:14px}
    .vf-city-popup{min-width:200px;font:500 12.5px/1.4 Arial,sans-serif;color:#1a2a3e}
    .vf-city-popup strong{display:block;font-size:15px;color:#17345c;margin-bottom:6px}
    .vf-city-popup .vf-city-badge{display:inline-block;border-radius:999px;padding:3px 10px;margin-bottom:6px;background:#eef4fa;color:#17345c;font-size:10.5px;font-weight:800;letter-spacing:.3px}
    .vf-city-popup .vf-city-stats{display:flex;gap:12px;margin-top:6px}
    .vf-city-popup .vf-city-stat{display:flex;flex-direction:column;align-items:center;gap:2px}
    .vf-city-popup .vf-city-stat b{font-size:18px;color:#17345c}
    .vf-city-popup .vf-city-stat small{font-size:10px;color:#64748b;font-weight:700}
    .vf-city-popup hr{border:0;border-top:1px solid #e2e8f0;margin:8px 0}
    .vf-city-popup .vf-city-rank{font-size:10.5px;color:#94a3b8;font-weight:600}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sizeClass(total: number) {
  if (total >= 100) return "large";
  if (total >= 30) return "medium";
  return "";
}

function iconSize(total: number): [number, number] {
  if (total >= 100) return [56, 56];
  if (total >= 30) return [48, 48];
  return [42, 42];
}

export default function MapCityMarkers() {
  useEffect(() => {
    installStyles();
    let cancelled = false;
    let layerGroup: any = null;
    let refreshTimer: number | null = null;

    async function renderMarkers() {
      if (cancelled) return;

      const L = (window as any).L;
      const map = (window as any).__vfElectoralMap || (window as any).__vfBaseElectoralMap;
      if (!L || !map?._container) {
        // Retry until map is ready
        refreshTimer = window.setTimeout(renderMarkers, 800);
        return;
      }

      try {
        const scope =
          document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
        const params = new URLSearchParams();
        if (scope) params.set("owner", scope);

        const res = await apiFetch(`/api/map-city-markers?${params.toString()}`);
        const data = (await res.json()) as { markers?: CityMarker[] };
        if (cancelled || !Array.isArray(data.markers)) return;

        const markers = data.markers;

        // Remove previous layer
        if (layerGroup) {
          try { map.removeLayer(layerGroup); } catch { /* ok */ }
        }
        layerGroup = L.layerGroup().addTo(map);

        let rank = 0;
        for (const m of markers) {
          rank++;
          const lat = Number(m.latitude);
          const lng = Number(m.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const size = iconSize(m.total);
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: `vf-city-marker ${sizeClass(m.total)}`,
              html: `<span>${NUMBER.format(m.total)}</span>`,
              iconSize: size,
              iconAnchor: [size[0] / 2, size[1] / 2],
            }),
            zIndexOffset: m.total,
          });

          marker.bindPopup(
            `<div class="vf-city-popup">
              <strong>${escapeHtml(m.city)}</strong>
              <span class="vf-city-badge">MUNICÍPIO DO PARANÁ</span>
              <div class="vf-city-stats">
                <div class="vf-city-stat"><b>${NUMBER.format(m.total)}</b><small>contatos</small></div>
                <div class="vf-city-stat"><b>${NUMBER.format(m.voters)}</b><small>eleitores</small></div>
                <div class="vf-city-stat"><b>${NUMBER.format(m.leaders)}</b><small>lideranças</small></div>
              </div>
              <hr/>
              <span class="vf-city-rank">#${rank}º município no ranking de contatos</span>
            </div>`,
            { maxWidth: 300, closeButton: true },
          );

          marker.addTo(layerGroup);
        }
      } catch {
        // Silent failure — markers are supplementary
      }
    }

    // Listen for map ready events
    const handleMapReady = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(renderMarkers, 300);
    };

    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:base-electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:records-changed", handleMapReady);

    // Also try immediately
    renderMarkers();

    // Listen for scope changes
    const handleScopeChange = (e: Event) => {
      if (!(e.target as HTMLElement)?.matches?.(".scope-picker select")) return;
      renderMarkers();
    };
    document.addEventListener("change", handleScopeChange, true);

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      window.removeEventListener("voto-forte:base-electoral-map-ready", handleMapReady);
      window.removeEventListener("voto-forte:records-changed", handleMapReady);
      document.removeEventListener("change", handleScopeChange, true);
      if (layerGroup) {
        try {
          const map = (window as any).__vfElectoralMap || (window as any).__vfBaseElectoralMap;
          map?.removeLayer(layerGroup);
        } catch { /* ok */ }
      }
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */