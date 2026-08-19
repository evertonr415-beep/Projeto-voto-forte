"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictBoundary = {
  id: string;
  name: string;
  shortName?: string;
  category: string;
  center: [number, number];
  polygon: [number, number][];
  total?: number;
};

type BoundaryResponse = {
  districts?: DistrictBoundary[];
  error?: string;
};

const STYLE_ID = "vf-arapongas-boundaries-styles";
const NUMBER = new Intl.NumberFormat("pt-BR");

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-district-polygon-label {
      background: rgba(15, 23, 42, 0.88) !important;
      backdrop-filter: blur(8px);
      color: #f8fafc !important;
      border: 1.5px solid rgba(56, 189, 248, 0.65) !important;
      border-radius: 999px !important;
      padding: 3px 9px !important;
      font: 800 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45) !important;
      white-space: nowrap !important;
      text-align: center !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
    }
    .vf-district-polygon-label:hover {
      background: #0284c7 !important;
      border-color: #38bdf8 !important;
      transform: scale(1.08) !important;
      box-shadow: 0 6px 18px rgba(2, 132, 199, 0.5) !important;
    }
    .vf-district-polygon-label .vf-badge {
      background: #38bdf8;
      color: #0f172a;
      padding: 1px 5px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 900;
    }
    .vf-district-boundary-popup {
      min-width: 200px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
    }
    .vf-district-boundary-popup strong {
      display: block;
      font-size: 15px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .vf-district-boundary-popup span.badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .vf-district-boundary-popup p {
      margin: 4px 0;
      font-size: 12px;
      color: #475569;
    }
    .vf-district-boundary-popup button {
      width: 100%;
      margin-top: 8px;
      padding: 7px 10px;
      border: 0;
      border-radius: 8px;
      background: #0284c7;
      color: #fff;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
    }
    .vf-district-boundary-popup button:hover {
      background: #0369a1;
    }
    @media(max-width: 760px) {
      .vf-district-polygon-label {
        font-size: 9px !important;
        padding: 2px 7px !important;
      }
      .vf-district-polygon-label .vf-badge {
        font-size: 8px !important;
        padding: 1px 4px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function ArapongasBoundariesLayer() {
  useEffect(() => {
    installStyles();
    let cancelled = false;
    let activeMap: any = null;
    let boundariesLayerGroup: any = null;
    let requestId = 0;
    let retryTimer: number | null = null;

    const clearLayers = () => {
      if (!activeMap || !boundariesLayerGroup) return;
      try {
        activeMap.removeLayer(boundariesLayerGroup);
      } catch {
        // Ignora caso mapa já tenha sido desmontado
      }
      boundariesLayerGroup = null;
    };

    const renderBoundaries = async (map: any) => {
      if (cancelled || !map?._container) return;
      const L = (window as any).L;
      if (!L) return;

      if (activeMap !== map) {
        clearLayers();
        activeMap = map;
      }

      const id = ++requestId;

      try {
        const response = await apiFetch("/api/arapongas-boundaries", { cache: "no-store" });
        const data = (await response.json()) as BoundaryResponse;
        if (!response.ok) throw new Error(data.error || "Falha ao carregar divisões territoriais");
        if (cancelled || id !== requestId || activeMap !== map || !map._container) return;

        const nextLayer = L.layerGroup();
        const districts = Array.isArray(data.districts) ? data.districts : [];

        for (const district of districts) {
          if (!district.polygon || district.polygon.length < 3) continue;

          const total = Number(district.total || 0);

          // 1. Linha divisória e polígono do bairro
          const polygon = L.polygon(district.polygon, {
            color: "#0284c7",
            weight: 2.2,
            opacity: 0.88,
            fillColor: "#38bdf8",
            fillOpacity: total > 0 ? 0.09 : 0.04,
            dashArray: undefined,
          });

          // Efeitos de foco / hover no polígono
          polygon.on("mouseover", () => {
            polygon.setStyle({
              color: "#38bdf8",
              weight: 3.8,
              fillColor: "#0284c7",
              fillOpacity: 0.22,
            });
          });

          polygon.on("mouseout", () => {
            polygon.setStyle({
              color: "#0284c7",
              weight: 2.2,
              fillColor: "#38bdf8",
              fillOpacity: total > 0 ? 0.09 : 0.04,
            });
          });

          polygon.on("click", () => {
            map.flyTo(district.center, Math.max(14, map.getZoom?.() || 14), {
              duration: 0.8,
            });
            window.dispatchEvent(
              new CustomEvent("voto-forte:district-selected", {
                detail: { district: district.name },
              }),
            );
            window.dispatchEvent(
              new CustomEvent("voto-forte:district-filter-change", {
                detail: { district: district.name },
              }),
            );
          });

          polygon.bindPopup(
            `
              <div class="vf-district-boundary-popup">
                <strong>${district.name}</strong>
                <span class="badge">Região Oficial de Arapongas</span>
                <p><b>${NUMBER.format(total)}</b> cadastros vinculados</p>
                <button type="button" onclick="window.dispatchEvent(new CustomEvent('voto-forte:filter-district-contacts', { detail: { district: '${district.name}' } }))">
                  Ver contatos deste bairro
                </button>
              </div>
            `,
            { maxWidth: 260 },
          );

          polygon.addTo(nextLayer);

          // 2. Rótulo com o Nome do Bairro no centro geométrico
          if (district.center && Number.isFinite(district.center[0]) && Number.isFinite(district.center[1])) {
            const labelHtml = total > 0
              ? `<span>${district.shortName || district.name}</span><span class="vf-badge">${NUMBER.format(total)}</span>`
              : `<span>${district.shortName || district.name}</span>`;

            const labelMarker = L.marker(district.center, {
              interactive: true,
              zIndexOffset: -200,
              icon: L.divIcon({
                className: "vf-district-polygon-label",
                html: labelHtml,
                iconSize: [undefined, undefined],
                iconAnchor: [45, 12],
              }),
            });

            labelMarker.on("click", () => {
              map.flyTo(district.center, Math.max(14, map.getZoom?.() || 14), {
                duration: 0.8,
              });
              window.dispatchEvent(
                new CustomEvent("voto-forte:district-selected", {
                  detail: { district: district.name },
                }),
              );
              window.dispatchEvent(
                new CustomEvent("voto-forte:district-filter-change", {
                  detail: { district: district.name },
                }),
              );
            });

            labelMarker.addTo(nextLayer);
          }
        }

        clearLayers();
        boundariesLayerGroup = nextLayer.addTo(map);
      } catch (error) {
        console.error("Failed to render arapongas boundaries layer", error);
      }
    };

    const attach = () => {
      const map = (window as any).__vfBaseElectoralMap || (window as any).__vfElectoralMap;
      if (!map?._container) return false;
      void renderBoundaries(map);
      return true;
    };

    const handleMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map?._container) void renderBoundaries(map);
    };

    const handleRecordsChanged = () => {
      if (activeMap?._container) void renderBoundaries(activeMap);
    };

    window.addEventListener("voto-forte:base-electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:records-changed", handleRecordsChanged);

    if (!attach()) {
      retryTimer = window.setInterval(() => {
        if (attach() && retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 150);
      window.setTimeout(() => {
        if (retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 12000);
    }

    return () => {
      cancelled = true;
      requestId += 1;
      if (retryTimer !== null) window.clearInterval(retryTimer);
      window.removeEventListener("voto-forte:base-electoral-map-ready", handleMapReady);
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
      clearLayers();
      activeMap = null;
    };
  }, []);

  return null;
}
