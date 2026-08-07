"use client";

import { useEffect } from "react";
import { loadSharedTerritoryContacts } from "./territory-data-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictStats = {
  total: number;
  voters: number;
  leaders: number;
};

const TERRITORY_CACHE_KEY = "vf:territories:arapongas:v1";
const TERRITORY_CACHE_TTL = 24 * 60 * 60 * 1000;

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function densityOpacity(total: number, maximum: number) {
  if (!total || !maximum) return 0.04;
  return Math.min(0.46, 0.1 + (total / maximum) * 0.36);
}

async function loadDistrictStats() {
  const records = await loadSharedTerritoryContacts();
  const stats = new Map<string, DistrictStats>();

  for (const record of records) {
    const district = normalize(record.payload?.district);
    if (!district) continue;

    const current = stats.get(district) || { total: 0, voters: 0, leaders: 0 };
    current.total += 1;
    if (normalize(record.payload?.kind).includes("LIDER")) current.leaders += 1;
    else current.voters += 1;
    stats.set(district, current);
  }

  return stats;
}

async function loadTerritories() {
  try {
    const cached = window.sessionStorage.getItem(TERRITORY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt?: number; data?: unknown };
      if (
        parsed.savedAt &&
        Date.now() - parsed.savedAt < TERRITORY_CACHE_TTL &&
        parsed.data
      ) {
        return parsed.data;
      }
    }
  } catch {
    // Segue para a consulta externa caso o cache esteja indisponível.
  }

  const query =
    '[out:json][timeout:30];area["name"="Arapongas"]["boundary"="administrative"]->.a;(relation["boundary"="administrative"]["admin_level"~"10|11"](area.a);way["boundary"="administrative"]["admin_level"~"10|11"](area.a););out tags center geom;';
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error("Limites territoriais indisponíveis");

  const data = await response.json();
  try {
    window.sessionStorage.setItem(
      TERRITORY_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data }),
    );
  } catch {
    // O cache é opcional.
  }
  return data;
}

function runWhenBrowserIsIdle(callback: () => void) {
  const browser = window as typeof window & {
    requestIdleCallback?: (
      handler: () => void,
      options?: { timeout?: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (browser.requestIdleCallback) {
    const id = browser.requestIdleCallback(callback, { timeout: 2500 });
    return () => browser.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 800);
  return () => window.clearTimeout(id);
}

export default function MapTerritoryEnhancer() {
  useEffect(() => {
    let cancelled = false;
    let activeMap: any = null;
    let territoryLayer: any = null;
    let originalMapFactory: any = null;
    let patchTimer: number | null = null;
    let patchTimeout: number | null = null;
    let cancelIdleInstall: (() => void) | null = null;
    let maximumDensity = 1;
    const polygons = new Map<string, any[]>();

    const applyDistrictFilter = (district: string) => {
      const selected = normalize(district);
      let selectedBounds: any = null;

      for (const [key, layers] of polygons.entries()) {
        const active = !selected || key === selected;
        for (const polygon of layers) {
          const total = Number(polygon.options?.vfTotal || 0);
          polygon.setStyle({
            color: active && selected ? "#9f3f00" : "#c9661c",
            weight: active && selected ? 5 : total ? 3 : 1.5,
            opacity: active ? 0.98 : 0.25,
            fillOpacity: active
              ? selected
                ? 0.58
                : densityOpacity(total, maximumDensity)
              : 0.025,
          });
          if (active && selected) {
            selectedBounds = selectedBounds
              ? selectedBounds.extend(polygon.getBounds())
              : polygon.getBounds();
            polygon.bringToFront();
          }
        }
      }

      if (selected && selectedBounds?.isValid?.() && activeMap) {
        activeMap.fitBounds(selectedBounds, { padding: [36, 36], maxZoom: 15 });
      }
    };

    const handleDistrictFilter = (event: Event) => {
      const district =
        (event as CustomEvent<{ district?: string }>).detail?.district || "";
      applyDistrictFilter(district);
    };

    window.addEventListener(
      "voto-forte:district-filter-change",
      handleDistrictFilter,
    );

    const installTerritoryLayer = async (map: any) => {
      if (cancelled || !map || map._vfTerritoryInstalled) return;
      map._vfTerritoryInstalled = true;
      activeMap = map;

      try {
        const [stats, territoryData] = await Promise.all([
          loadDistrictStats(),
          loadTerritories(),
        ]);
        if (cancelled || !activeMap) return;

        const L = (window as any).L;
        if (!L) return;
        maximumDensity = Math.max(
          1,
          ...Array.from(stats.values()).map((item) => item.total),
        );
        territoryLayer = L.layerGroup().addTo(map);

        for (const element of territoryData.elements || []) {
          if (cancelled) break;
          const name = String(element.tags?.name || "").trim();
          if (!name) continue;
          const key = normalize(name);
          const districtStats = stats.get(key) || {
            total: 0,
            voters: 0,
            leaders: 0,
          };
          const popup = `
            <div class="vf-territory-popup">
              <strong>${escapeHtml(name)}</strong>
              <span>${districtStats.total} cadastro(s)</span>
              <small>${districtStats.voters} eleitor(es) · ${districtStats.leaders} liderança(s)</small>
              <button type="button" data-vf-district="${escapeHtml(name)}">Ver cadastros deste bairro</button>
            </div>
          `;

          const parts =
            element.type === "relation"
              ? (element.members || []).filter((member: any) => member.geometry)
              : [element];

          for (const part of parts) {
            if (!part.geometry?.length || part.geometry.length < 2) continue;
            const points = part.geometry.map((point: any) => [point.lat, point.lon]);
            const first = part.geometry[0];
            const last = part.geometry[part.geometry.length - 1];
            const closed = first.lat === last.lat && first.lon === last.lon;
            if (!closed) continue;

            const polygon = L.polygon(points, {
              color: "#c9661c",
              weight: districtStats.total ? 3 : 1.5,
              opacity: 0.95,
              fillColor: "#ef8429",
              fillOpacity: densityOpacity(districtStats.total, maximumDensity),
              className: "vf-territory-polygon",
              vfTotal: districtStats.total,
              vfDistrict: key,
            });
            polygon.bindPopup(popup, {
              autoClose: true,
              closeOnClick: true,
              closeButton: true,
              maxWidth: 280,
            });
            polygon.on("mouseover", () => {
              const selected = normalize(
                (document.querySelector(
                  ".vf-district-list button.active span",
                ) as HTMLElement | null)?.textContent,
              );
              if (selected && selected !== key) return;
              polygon.setStyle({
                weight: 4,
                fillOpacity: Math.min(
                  0.58,
                  densityOpacity(districtStats.total, maximumDensity) + 0.12,
                ),
              });
            });
            polygon.on("mouseout", () => {
              const selected = normalize(
                (document.querySelector(
                  ".vf-district-list button.active span",
                ) as HTMLElement | null)?.textContent,
              );
              if (selected) {
                applyDistrictFilter(selected);
                return;
              }
              polygon.setStyle({
                weight: districtStats.total ? 3 : 1.5,
                fillOpacity: densityOpacity(districtStats.total, maximumDensity),
              });
            });
            polygon.addTo(territoryLayer);
            const registered = polygons.get(key) || [];
            registered.push(polygon);
            polygons.set(key, registered);
          }

          const center = element.center;
          if (center && districtStats.total > 0) {
            L.marker([center.lat, center.lon], {
              interactive: true,
              icon: L.divIcon({
                className: "vf-territory-label",
                html: `<span>${escapeHtml(name)}</span><b>${districtStats.total}</b>`,
                iconSize: [150, 34],
                iconAnchor: [75, 17],
              }),
            })
              .bindPopup(popup, { maxWidth: 280 })
              .addTo(territoryLayer);
          }
        }

        map.on("popupopen", (event: any) => {
          const node = event.popup?.getElement?.();
          const button = node?.querySelector?.(
            "[data-vf-district]",
          ) as HTMLButtonElement | null;
          if (!button || button.dataset.vfBound === "true") return;
          button.dataset.vfBound = "true";
          button.addEventListener("click", () => {
            const district = button.dataset.vfDistrict || "";
            window.dispatchEvent(
              new CustomEvent("voto-forte:district-selected", {
                detail: { district },
              }),
            );
            window.dispatchEvent(
              new CustomEvent("voto-forte:district-filter-change", {
                detail: { district },
              }),
            );
            const message = document.querySelector(".real-map-toolbar strong");
            if (message)
              message.textContent = `${district} · camada territorial selecionada`;
            map.closePopup();
          });
        });
      } catch {
        const message = document.querySelector(".real-map-toolbar strong");
        if (message)
          message.textContent =
            "Mapa ativo · limites territoriais temporariamente indisponíveis";
      }
    };

    const scheduleTerritoryInstall = (map: any) => {
      cancelIdleInstall?.();
      cancelIdleInstall = runWhenBrowserIsIdle(() => {
        cancelIdleInstall = null;
        void installTerritoryLayer(map);
      });
    };

    const patchLeaflet = () => {
      const L = (window as any).L;
      if (!L?.map || L.map.__vfTerritoryPatched) return false;
      originalMapFactory = L.map;
      const wrappedMap = function (this: unknown, ...args: any[]) {
        const map = originalMapFactory.apply(this, args);
        scheduleTerritoryInstall(map);
        return map;
      };
      Object.assign(wrappedMap, originalMapFactory);
      wrappedMap.__vfTerritoryPatched = true;
      L.map = wrappedMap;
      return true;
    };

    if (!patchLeaflet()) {
      patchTimer = window.setInterval(() => {
        if (patchLeaflet() && patchTimer) {
          window.clearInterval(patchTimer);
          patchTimer = null;
        }
      }, 250);
      patchTimeout = window.setTimeout(() => {
        if (patchTimer) window.clearInterval(patchTimer);
        patchTimer = null;
      }, 10_000);
    }

    return () => {
      cancelled = true;
      cancelIdleInstall?.();
      window.removeEventListener(
        "voto-forte:district-filter-change",
        handleDistrictFilter,
      );
      if (patchTimer) window.clearInterval(patchTimer);
      if (patchTimeout) window.clearTimeout(patchTimeout);
      if (territoryLayer && activeMap) activeMap.removeLayer(territoryLayer);
      const L = (window as any).L;
      if (L?.map?.__vfTerritoryPatched && originalMapFactory)
        L.map = originalMapFactory;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
