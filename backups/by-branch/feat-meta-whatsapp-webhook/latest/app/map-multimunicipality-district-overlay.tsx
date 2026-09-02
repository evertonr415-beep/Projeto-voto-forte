"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Municipality = { id?: number; name?: string; state?: string };
type MunicipalityContext = {
  currentMunicipalityId?: number;
  municipalities?: Municipality[];
};
type DistrictItem = { district?: string; total?: number | string };
type DistrictCenter = {
  district?: string;
  latitude?: number | string;
  longitude?: number | string;
};
type CenterPoint = { latitude: number; longitude: number };

const STYLE_ID = "vf-multimunicipality-district-overlay-style";
const NUMBER = new Intl.NumberFormat("pt-BR");

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function variants(value: unknown) {
  const base = normalize(value);
  if (!base) return [];
  const expanded = base
    .replace(/^BAIRRO\s+/, "")
    .replace(/^(JD|JARD)\s+/, "JARDIM ")
    .replace(/^VL\s+/, "VILA ")
    .replace(/^(CJ|CONJ)\s+/, "CONJUNTO ")
    .replace(/^RES\s+/, "RESIDENCIAL ")
    .replace(/^PQ\s+/, "PARQUE ")
    .replace(/^COND\s+/, "CONDOMINIO ");
  return Array.from(new Set([base, expanded]));
}

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
    .vf-multi-district-icon{background:transparent!important;border:0!important;overflow:visible!important}
    .vf-multi-district-wrap{position:relative;width:34px;height:38px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 2px 3px rgba(10,40,75,.2));transition:transform .15s ease}
    .vf-multi-district-icon:hover .vf-multi-district-wrap{transform:translateY(-2px) scale(1.04)}
    .vf-multi-district-count{position:absolute;left:50%;bottom:17px;transform:translateX(-50%);min-width:28px;padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.98);border:1px solid rgba(31,82,133,.22);box-shadow:0 3px 8px rgba(15,35,65,.16);color:#174a79;font:800 10px/1 Arial,sans-serif;text-align:center;white-space:nowrap;letter-spacing:-.1px}
    .vf-multi-district-dot{display:block;width:13px;height:13px;border-radius:50%;background:#2563a8;border:3px solid #fff;box-shadow:0 0 0 1px rgba(24,74,124,.3),0 2px 6px rgba(22,66,108,.24)}
    .vf-multi-district-popup{min-width:210px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-multi-district-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-multi-district-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2fb;color:#285b8e;font-size:10px}.vf-multi-district-popup p{margin:6px 0 0}.vf-multi-district-popup small{display:block;margin-top:7px;color:#64748b}
    @media(max-width:760px){.vf-multi-district-count{font-size:9px;padding:3px 5px}.vf-multi-district-dot{width:12px;height:12px}}
  `;
  document.head.appendChild(style);
}

function isArapongas(value: unknown) {
  return normalize(value) === "ARAPONGAS";
}

export default function MapMultimunicipalityDistrictOverlay() {
  useEffect(() => {
    installStyles();
    let cancelled = false;
    let activeCleanup: (() => void) | null = null;
    let retryTimer: number | null = null;
    let municipality: Municipality | null = null;

    const loadMunicipality = async () => {
      try {
        const response = await apiFetch("/api/municipality-context", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) return null;
        const context = payload.context as MunicipalityContext | undefined;
        return (
          context?.municipalities?.find(
            (item) => Number(item.id) === Number(context.currentMunicipalityId),
          ) || null
        );
      } catch {
        return null;
      }
    };

    const setup = async (map: any) => {
      if (cancelled || !map?._container || map._vfMultiMunicipalityDistrictOverlay) return false;
      if (!municipality) municipality = await loadMunicipality();
      if (cancelled || !municipality || isArapongas(municipality.name)) return false;

      const L = (window as any).L;
      if (!L) return false;
      map._vfMultiMunicipalityDistrictOverlay = true;
      const layer = L.layerGroup().addTo(map);
      let requestId = 0;
      let centersByKey = new Map<string, CenterPoint>();
      let items: Array<{ district: string; total: number; key: string }> = [];
      let markers = new Map<string, any>();

      const centerFor = (district: string) => {
        for (const key of variants(district)) {
          const center = centersByKey.get(key);
          if (center) return center;
        }
        return null;
      };

      const decorateRanking = () => {
        document.querySelectorAll<HTMLButtonElement>(".vf-district-map-row").forEach((button) => {
          const span = button.querySelector("span");
          const district = span?.childNodes?.[0]?.textContent?.trim() || "";
          const center = centerFor(district);
          if (!center) return;
          button.disabled = false;
          const small = span?.querySelector("small");
          if (small && small.textContent === "sem referência territorial") {
            small.textContent = "ponto azul disponível";
          }
          if (button.dataset.vfMultiDistrictBound === "true") return;
          button.dataset.vfMultiDistrictBound = "true";
          button.addEventListener("click", () => {
            map.setView([center.latitude, center.longitude], Math.max(15, Number(map.getZoom?.() || 15)), {
              animate: true,
            });
            window.setTimeout(() => {
              const key = variants(district).find((candidate) => markers.has(candidate));
              if (key) markers.get(key)?.openPopup?.();
            }, 300);
          });
        });
      };

      const updateVisibility = () => {
        const zoom = Math.round(Number(map.getZoom?.() ?? 13));
        if (zoom <= 12 || Number(map._vfDistrictPointCount || 0) > 0) {
          layer.clearLayers();
          decorateRanking();
          return;
        }
        layer.clearLayers();
        const limit = zoom === 13 ? 24 : zoom === 14 ? 55 : Number.POSITIVE_INFINITY;
        const minDistance = zoom === 13 ? 54 : zoom === 14 ? 40 : 28;
        const selected: Array<{ x: number; y: number }> = [];
        let visible = 0;
        for (const item of items) {
          if (visible >= limit) break;
          const center = centerFor(item.district);
          if (!center) continue;
          const point = map.latLngToContainerPoint?.([center.latitude, center.longitude]);
          if (!point) continue;
          if (
            selected.some((candidate) => {
              const dx = candidate.x - point.x;
              const dy = candidate.y - point.y;
              return Math.sqrt(dx * dx + dy * dy) < minDistance;
            })
          )
            continue;
          const key = variants(item.district)[0];
          const marker = markers.get(key);
          if (!marker) continue;
          marker.addTo(layer);
          selected.push({ x: point.x, y: point.y });
          visible += 1;
        }
        map._vfMultiMunicipalityDistrictPointCount = markers.size;
        decorateRanking();
      };

      const refresh = async () => {
        const id = ++requestId;
        const params = new URLSearchParams();
        const scope = currentScope();
        if (scope) params.set("owner", scope);
        try {
          const [summaryResponse, centersResponse] = await Promise.all([
            apiFetch(`/api/map-district-markers${params.toString() ? `?${params}` : ""}`, {
              cache: "no-store",
            }),
            apiFetch("/api/municipality-district-centers", { cache: "no-store" }),
          ]);
          const [summaryPayload, centersPayload] = await Promise.all([
            summaryResponse.json(),
            centersResponse.json(),
          ]);
          if (!summaryResponse.ok || !centersResponse.ok || cancelled || id !== requestId) return;

          centersByKey = new Map<string, CenterPoint>();
          for (const raw of (Array.isArray(centersPayload.centers) ? centersPayload.centers : []) as DistrictCenter[]) {
            const latitude = Number(raw.latitude);
            const longitude = Number(raw.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
            for (const key of variants(raw.district)) {
              if (!centersByKey.has(key)) centersByKey.set(key, { latitude, longitude });
            }
          }

          items = ((Array.isArray(summaryPayload.districts) ? summaryPayload.districts : []) as DistrictItem[])
            .map((raw) => ({
              district: String(raw.district || "").trim(),
              total: Math.max(0, Number(raw.total || 0)),
              key: variants(raw.district)[0] || "",
            }))
            .filter((item) => item.district && item.key && item.total > 0)
            .sort((left, right) => right.total - left.total || left.district.localeCompare(right.district, "pt-BR"));

          layer.clearLayers();
          markers = new Map<string, any>();
          for (const item of items) {
            const center = centerFor(item.district);
            if (!center) continue;
            const marker = L.marker([center.latitude, center.longitude], {
              icon: L.divIcon({
                className: "vf-multi-district-icon",
                html: `<div class="vf-multi-district-wrap" aria-label="${escapeHtml(item.district)}: ${NUMBER.format(item.total)} contatos"><span class="vf-multi-district-count">${NUMBER.format(item.total)}</span><span class="vf-multi-district-dot" aria-hidden="true"></span></div>`,
                iconSize: [34, 38],
                iconAnchor: [17, 35],
                popupAnchor: [0, -34],
              }),
              keyboard: true,
              zIndexOffset: 330,
            });
            marker.bindTooltip(`${item.district} · ${NUMBER.format(item.total)} contato(s)`, {
              direction: "top",
              offset: [0, -30],
              opacity: 0.96,
            });
            marker.bindPopup(
              `<div class="vf-multi-district-popup"><strong>${escapeHtml(item.district)}</strong><b>Referência territorial do bairro</b><p>${NUMBER.format(item.total)} contato(s) cadastrados neste bairro</p><small>Referência dinâmica do município atual obtida do mapa territorial.</small></div>`,
              { maxWidth: 320, closeButton: true },
            );
            for (const key of variants(item.district)) markers.set(key, marker);
          }
          updateVisibility();
        } catch (error) {
          console.error("Failed to render multi-municipality district overlay", error);
        }
      };

      const onZoom = () => updateVisibility();
      const onMove = () => updateVisibility();
      const onScope = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (target?.matches(".scope-picker select")) void refresh();
      };
      const onRecords = () => void refresh();

      map.on?.("zoomend", onZoom);
      map.on?.("moveend", onMove);
      document.addEventListener("change", onScope, true);
      window.addEventListener("voto-forte:records-changed", onRecords);
      window.addEventListener("voto-forte:contacts-imported", onRecords);
      void refresh();

      activeCleanup = () => {
        requestId += 1;
        map.off?.("zoomend", onZoom);
        map.off?.("moveend", onMove);
        document.removeEventListener("change", onScope, true);
        window.removeEventListener("voto-forte:records-changed", onRecords);
        window.removeEventListener("voto-forte:contacts-imported", onRecords);
        try {
          map.removeLayer(layer);
        } catch {
          // mapa desmontado durante navegação
        }
        delete map._vfMultiMunicipalityDistrictOverlay;
        delete map._vfMultiMunicipalityDistrictPointCount;
      };
      map.on?.("unload", activeCleanup);
      return true;
    };

    const attach = () => {
      const map = (window as any).__vfElectoralMap;
      if (!map?._container) return false;
      void setup(map);
      return true;
    };

    const onMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map?._container) void setup(map);
    };

    window.addEventListener("voto-forte:electoral-map-ready", onMapReady);
    if (!attach()) {
      retryTimer = window.setInterval(() => {
        if (attach() && retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 250);
      window.setTimeout(() => {
        if (retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 12_000);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:electoral-map-ready", onMapReady);
      if (retryTimer !== null) window.clearInterval(retryTimer);
      activeCleanup?.();
      activeCleanup = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
