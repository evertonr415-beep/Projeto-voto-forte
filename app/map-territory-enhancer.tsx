"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictSummaryItem = {
  district?: string;
  total?: number | string;
};

type DistrictCenter = {
  district?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type OverpassPoint = { lat: number; lon: number };
type OverpassElement = {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string };
  geometry?: OverpassPoint[];
  members?: Array<{ role?: string; geometry?: OverpassPoint[] }>;
};

type DistrictItem = {
  district: string;
  total: number;
  key: string;
};

type CenterPoint = { latitude: number; longitude: number };

const STYLE_ID = "vf-district-choropleth-style";
const NUMBER = new Intl.NumberFormat("pt-BR");
let overpassPromise: Promise<OverpassElement[]> | null = null;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-district-map-control{background:rgba(255,255,255,.97);border:1px solid rgba(23,52,92,.16);border-radius:14px;box-shadow:0 9px 24px rgba(15,35,65,.18);width:260px;max-height:310px;overflow:hidden;font:600 11px/1.3 Arial,sans-serif;color:#17345c}
    .vf-district-map-control header{padding:10px 11px 8px;border-bottom:1px solid #e4ebf3}.vf-district-map-control header strong{display:block;font-size:13px}.vf-district-map-control header small{display:block;margin-top:3px;color:#64748b;font-weight:600}
    .vf-district-map-list{max-height:245px;overflow:auto;padding:5px}.vf-district-map-row{width:100%;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:0;border-radius:9px;background:transparent;color:#27405f;text-align:left;padding:7px 8px;cursor:pointer;font:700 11px/1.2 Arial,sans-serif}.vf-district-map-row:hover:not(:disabled){background:#eaf2fb}.vf-district-map-row:disabled{cursor:default;opacity:.72}.vf-district-map-row b{font-size:12px;color:#17345c}.vf-district-map-row small{display:block;margin-top:2px;color:#7a899c;font-size:9px;font-weight:600}.vf-district-map-empty{padding:12px;color:#64748b;font-weight:600}
    .vf-district-map-scale{display:flex;align-items:center;gap:5px;padding:7px 10px;border-top:1px solid #e4ebf3;color:#64748b;font-size:9px}.vf-district-map-scale i{display:block;width:18px;height:8px;border-radius:99px;background:#356ea8}.vf-district-map-scale i:nth-of-type(1){opacity:.2}.vf-district-map-scale i:nth-of-type(2){opacity:.45}.vf-district-map-scale i:nth-of-type(3){opacity:.75}
    .vf-district-area-popup{min-width:195px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-district-area-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-district-area-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2fb;color:#285b8e;font-size:10px}.vf-district-area-popup p{margin:6px 0 0}.vf-district-area-popup small{display:block;margin-top:7px;color:#64748b}
    @media(max-width:760px){.vf-district-map-control{width:210px;max-height:240px}.vf-district-map-list{max-height:175px}.vf-district-map-row{padding:6px}.vf-district-map-control header{padding:8px}}
  `;
  document.head.appendChild(style);
}

async function loadDistrictBoundaries() {
  if (overpassPromise) return overpassPromise;
  overpassPromise = (async () => {
    const query =
      '[out:json][timeout:25];area["name"="Arapongas"]["boundary"="administrative"]->.a;(relation["boundary"="administrative"]["admin_level"~"10|11"](area.a);way["boundary"="administrative"]["admin_level"~"10|11"](area.a););out tags center geom;';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Falha ao carregar limites territoriais");
      const data = (await response.json()) as { elements?: OverpassElement[] };
      return Array.isArray(data.elements) ? data.elements : [];
    } catch (error) {
      overpassPromise = null;
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  return overpassPromise;
}

export default function MapTerritoryEnhancer() {
  useLayoutEffect(() => {
    installStyles();
    let cancelled = false;
    let retryTimer: number | null = null;
    let retryTimeout: number | null = null;
    let cleanupActiveMap: (() => void) | null = null;

    const setupMap = (map: any) => {
      const container = map?.getContainer?.() as HTMLElement | undefined;
      if (cancelled || !container?.closest(".full-map") || map._vfDistrictChoropleth)
        return false;

      const L = (window as any).L;
      if (!L) return false;
      map._vfDistrictChoropleth = true;

      const areaLayer = L.layerGroup().addTo(map);
      const districtBounds = new Map<string, any>();
      const districtCenters = new Map<string, CenterPoint>();
      let requestId = 0;
      let lastScope = currentScope();
      let rankingItems: DistrictItem[] = [];

      const control = L.control({ position: "bottomleft" });
      let controlNode: HTMLElement | null = null;
      control.onAdd = () => {
        const node = L.DomUtil.create("div", "vf-district-map-control") as HTMLElement;
        node.innerHTML = `
          <header><strong>Contatos por bairro</strong><small>Carregando distribuição territorial…</small></header>
          <div class="vf-district-map-list"><div class="vf-district-map-empty">Carregando bairros…</div></div>
          <div class="vf-district-map-scale"><span>menos</span><i></i><i></i><i></i><span>mais contatos</span></div>
        `;
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        controlNode = node;
        return node;
      };
      control.addTo(map);

      const focusDistrict = (item: DistrictItem) => {
        const bounds = districtBounds.get(item.key);
        if (bounds?.isValid?.()) {
          map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 });
          return;
        }
        const center = districtCenters.get(item.key);
        if (center) map.setView([center.latitude, center.longitude], 15, { animate: true });
      };

      const renderRanking = (areaKeys = new Set<string>()) => {
        if (!controlNode) return;
        const header = controlNode.querySelector<HTMLElement>("header small");
        const list = controlNode.querySelector<HTMLElement>(".vf-district-map-list");
        if (!list) return;
        if (header)
          header.textContent = `${NUMBER.format(rankingItems.reduce((sum, item) => sum + item.total, 0))} contatos distribuídos em ${NUMBER.format(rankingItems.length)} bairros`;
        list.innerHTML = "";
        if (!rankingItems.length) {
          list.innerHTML = '<div class="vf-district-map-empty">Nenhum bairro com contatos neste ambiente.</div>';
          return;
        }
        for (const item of rankingItems) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "vf-district-map-row";
          const canFocus = areaKeys.has(item.key) || districtCenters.has(item.key);
          button.disabled = !canFocus;
          button.innerHTML = `<span>${escapeHtml(item.district)}<small>${areaKeys.has(item.key) ? "área territorial" : districtCenters.has(item.key) ? "referência territorial" : "sem contorno disponível"}</small></span><b>${NUMBER.format(item.total)}</b>`;
          if (canFocus) button.addEventListener("click", () => focusDistrict(item));
          list.appendChild(button);
        }
      };

      const draw = async () => {
        const id = ++requestId;
        const scope = currentScope();
        lastScope = scope;
        const params = new URLSearchParams({ mode: "summary" });
        if (scope) params.set("owner", scope);
        const markerParams = new URLSearchParams();
        if (scope) markerParams.set("owner", scope);

        try {
          const [summaryResponse, centersResponse] = await Promise.all([
            apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" }),
            apiFetch(
              `/api/map-district-markers${markerParams.toString() ? `?${markerParams.toString()}` : ""}`,
              { cache: "no-store" },
            ).catch(() => null),
          ]);
          const summaryPayload = (await summaryResponse.json()) as {
            districts?: DistrictSummaryItem[];
            error?: string;
          };
          if (!summaryResponse.ok)
            throw new Error(summaryPayload.error || "Falha ao carregar totais dos bairros");
          if (cancelled || id !== requestId || !map._container) return;

          rankingItems = (Array.isArray(summaryPayload.districts)
            ? summaryPayload.districts
            : []
          )
            .map((item) => ({
              district: String(item.district || "").trim(),
              total: Math.max(0, Number(item.total || 0)),
              key: normalize(item.district),
            }))
            .filter((item) => item.district && item.key && item.total > 0)
            .sort(
              (left, right) =>
                right.total - left.total ||
                left.district.localeCompare(right.district, "pt-BR"),
            );

          districtCenters.clear();
          if (centersResponse?.ok) {
            const centersPayload = (await centersResponse.json()) as {
              markers?: DistrictCenter[];
            };
            for (const item of Array.isArray(centersPayload.markers)
              ? centersPayload.markers
              : []) {
              const key = normalize(item.district);
              const latitude = Number(item.latitude);
              const longitude = Number(item.longitude);
              if (key && Number.isFinite(latitude) && Number.isFinite(longitude))
                districtCenters.set(key, { latitude, longitude });
            }
          }

          renderRanking();

          let boundaries: OverpassElement[] = [];
          try {
            boundaries = await loadDistrictBoundaries();
          } catch {
            boundaries = [];
          }
          if (cancelled || id !== requestId || !map._container) return;

          areaLayer.clearLayers();
          districtBounds.clear();
          const totals = new Map(rankingItems.map((item) => [item.key, item]));
          const maxTotal = Math.max(1, ...rankingItems.map((item) => item.total));
          const areaKeys = new Set<string>();

          for (const element of boundaries) {
            const key = normalize(element.tags?.name);
            const item = totals.get(key);
            if (!item) continue;
            const geometries =
              element.type === "relation"
                ? (element.members || [])
                    .filter((member) => !member.role || member.role === "outer")
                    .map((member) => member.geometry)
                : [element.geometry];

            for (const geometry of geometries) {
              if (!geometry || geometry.length < 4) continue;
              const first = geometry[0];
              const last = geometry[geometry.length - 1];
              if (!first || !last || first.lat !== last.lat || first.lon !== last.lon)
                continue;
              const points = geometry.map((point) => [point.lat, point.lon]);
              const ratio = Math.sqrt(item.total / maxTotal);
              const polygon = L.polygon(points, {
                color: "#285b8e",
                weight: 2,
                opacity: 0.82,
                fillColor: "#356ea8",
                fillOpacity: 0.14 + ratio * 0.5,
              });
              polygon.bindTooltip(
                `${item.district} · ${NUMBER.format(item.total)} contato(s)`,
                { sticky: true, opacity: 0.96 },
              );
              polygon.bindPopup(
                `<div class="vf-district-area-popup"><strong>${escapeHtml(item.district)}</strong><b>Total do bairro</b><p>${NUMBER.format(item.total)} contato(s) cadastrados</p><small>Representação por área do bairro. Os pinos individuais continuam indicando somente contatos com coordenada exata.</small></div>`,
                { maxWidth: 300, closeButton: true },
              );
              polygon.on("mouseover", () => polygon.setStyle({ weight: 3, fillOpacity: Math.min(0.78, 0.24 + ratio * 0.54) }));
              polygon.on("mouseout", () => polygon.setStyle({ weight: 2, fillOpacity: 0.14 + ratio * 0.5 }));
              polygon.addTo(areaLayer);
              areaKeys.add(key);

              const bounds = polygon.getBounds?.();
              if (bounds?.isValid?.()) {
                const current = districtBounds.get(key);
                if (current?.extend) current.extend(bounds);
                else districtBounds.set(key, L.latLngBounds(bounds));
              }
            }
          }

          renderRanking(areaKeys);
          map._vfDistrictAreaCount = areaKeys.size;
          const message = document.querySelector<HTMLElement>(
            ".real-map-toolbar strong",
          );
          if (message) {
            message.textContent = areaKeys.size
              ? `${areaKeys.size} bairro(s) destacados por área · ranking territorial ativo`
              : "Ranking territorial ativo · contornos dos bairros indisponíveis agora";
          }
        } catch (error) {
          console.error("Failed to render district choropleth", error);
          if (controlNode) {
            const header = controlNode.querySelector<HTMLElement>("header small");
            const list = controlNode.querySelector<HTMLElement>(".vf-district-map-list");
            if (header) header.textContent = "Não foi possível carregar os totais agora";
            if (list)
              list.innerHTML = '<div class="vf-district-map-empty">Os pinos exatos continuam funcionando normalmente.</div>';
          }
        }
      };

      const handleScopeChange = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.matches(".scope-picker select")) return;
        if (currentScope() !== lastScope) void draw();
      };
      const handleRecordsChanged = () => void draw();

      document.addEventListener("change", handleScopeChange, true);
      window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
      void draw();

      cleanupActiveMap = () => {
        requestId += 1;
        document.removeEventListener("change", handleScopeChange, true);
        window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
        window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
        try {
          map.removeLayer(areaLayer);
          map.removeControl(control);
        } catch {
          // O mapa pode ter sido destruído durante a navegação.
        }
        if (map._vfDistrictChoropleth) delete map._vfDistrictChoropleth;
      };
      map.on?.("unload", cleanupActiveMap);
      return true;
    };

    const attach = () => {
      const map = (window as any).__vfElectoralMap;
      return Boolean(map?._container && setupMap(map));
    };

    const handleMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map?._container) setupMap(map);
    };

    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    if (!attach()) {
      retryTimer = window.setInterval(() => {
        if (attach() && retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 100);
      retryTimeout = window.setTimeout(() => {
        if (retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 12_000);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      if (retryTimer !== null) window.clearInterval(retryTimer);
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
      cleanupActiveMap?.();
      cleanupActiveMap = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */