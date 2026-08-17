"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Municipality = {
  id: number;
  name: string;
  state: string;
};

type MunicipalityContext = {
  currentMunicipalityId: number;
  municipalities: Municipality[];
};

type OverpassElement = {
  type?: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string };
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
};

type MunicipalityFallback = {
  center: [number, number];
  zoom: number;
};

const MUNICIPALITY_FALLBACKS: Record<string, MunicipalityFallback> = {
  bandeirantes: { center: [-23.1078, -50.3704], zoom: 13 },
  cambara: { center: [-23.042273, -50.075281], zoom: 13 },
  carlopolis: { center: [-23.426897, -49.723486], zoom: 13 },
  prudentopolis: { center: [-25.211083, -50.975396], zoom: 13 },
  "siqueira campos": { center: [-23.68889, -49.83389], zoom: 13 },
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function isArapongas(municipality: Municipality) {
  return normalizeName(municipality.name) === "arapongas";
}

function fallbackFor(municipality: Municipality) {
  return MUNICIPALITY_FALLBACKS[normalizeName(municipality.name)] || null;
}

function isLegacyArapongasBoundaryLayer(layer: any) {
  if (layer?._vfMunicipalOwned) return false;
  const className = String(layer?.options?.icon?.options?.className || "");
  if (className.includes("district-name")) return true;
  if (String(layer?.options?.color || "").toLowerCase() === "#ef8429") return true;

  const children = layer?.getLayers?.();
  return Array.isArray(children) && children.some(isLegacyArapongasBoundaryLayer);
}

function removeLegacyArapongasBoundary(map: any) {
  const removals: any[] = [];
  map.eachLayer?.((layer: any) => {
    if (isLegacyArapongasBoundaryLayer(layer)) removals.push(layer);
  });
  removals.forEach((layer) => {
    try {
      map.removeLayer(layer);
    } catch {
      // O mapa pode estar sendo recriado durante a navegação.
    }
  });
}

function updateMapCopy(municipality: Municipality) {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3")).find(
    (node) =>
      node.textContent?.trim() === "Mapa eleitoral de Arapongas" ||
      node.textContent?.trim().startsWith("Mapa eleitoral de "),
  );
  if (title) title.textContent = `Mapa eleitoral de ${municipality.name}`;

  const mapElement = document.querySelector<HTMLElement>(".full-map .leaflet-map");
  if (mapElement) {
    mapElement.setAttribute(
      "aria-label",
      `Mapa real de ${municipality.name} com bairros e pessoas cadastradas`,
    );
  }

  const status = document.querySelector<HTMLElement>(".full-map .real-map-toolbar strong");
  if (status) status.textContent = `Mapa real de ${municipality.name}`;

  const home = document.querySelector<HTMLButtonElement>(
    ".full-map .real-map-toolbar .map-home",
  );
  if (home) home.textContent = municipality.name;
}

async function loadMunicipalityGeometry(municipality: Municipality) {
  const name = municipality.name.replace(/["\\]/g, " ").trim();
  const state = municipality.state.replace(/["\\]/g, " ").trim();
  const query = `[out:json][timeout:25];\nrelation["name"="${name}"]["boundary"="administrative"]["admin_level"="8"];\nout tags center geom;\narea["name"="${name}"]["boundary"="administrative"]->.a;\n(node["place"~"neighbourhood|suburb|quarter"]["name"](area.a););\nout tags center;`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8500);
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout));

  if (!response.ok) throw new Error("Limite municipal indisponível");
  const data = (await response.json()) as { elements?: OverpassElement[] };
  const elements = Array.isArray(data.elements) ? data.elements : [];

  // O centro fixo validado garante a cidade correta mesmo se houver homônimos no provedor.
  void state;
  return elements;
}

export default function MunicipalElectoralMapContext() {
  useEffect(() => {
    let cancelled = false;
    let municipality: Municipality | null = null;
    let activeMap: any = null;
    let municipalLayer: any = null;
    let municipalBounds: any = null;
    let municipalCenter: MunicipalityFallback | null = null;
    let observer: MutationObserver | null = null;
    let legacyLayerGuard: ((event: any) => void) | null = null;

    const installLegacyLayerGuard = (map: any) => {
      if (legacyLayerGuard || !map?.on) return;
      legacyLayerGuard = (event: any) => {
        const layer = event?.layer;
        if (!municipality || isArapongas(municipality) || !layer) return;
        if (!isLegacyArapongasBoundaryLayer(layer)) return;
        window.setTimeout(() => {
          try {
            if (map.hasLayer?.(layer) && !layer?._vfMunicipalOwned) {
              map.removeLayer(layer);
            }
          } catch {
            // O mapa pode ter sido desmontado durante a troca de tela.
          }
        }, 0);
      };
      map.on("layeradd", legacyLayerGuard);
    };

    const decorateMap = async (map: any) => {
      if (cancelled || !municipality || isArapongas(municipality)) return;
      if (!map?._container) return;
      const L = (window as any).L;
      if (!L) return;

      activeMap = map;
      installLegacyLayerGuard(map);

      if (map._vfMunicipalContextId !== municipality.id) {
        map._vfMunicipalContextId = municipality.id;
        municipalBounds = null;
        municipalCenter = fallbackFor(municipality);
        removeLegacyArapongasBoundary(map);
        updateMapCopy(municipality);

        // A abertura da cidade não depende mais do Overpass. Mesmo se o serviço externo
        // estiver lento ou indisponível, o mapa base abre imediatamente no município correto.
        if (municipalCenter) {
          map.setView(municipalCenter.center, municipalCenter.zoom);
          window.setTimeout(() => map.invalidateSize?.(), 80);
        }
      }

      if (map._vfMunicipalGeometryLoadedId === municipality.id) return;
      if (map._vfMunicipalGeometryLoadingId === municipality.id) return;
      map._vfMunicipalGeometryLoadingId = municipality.id;

      try {
        const elements = await loadMunicipalityGeometry(municipality);
        if (cancelled || activeMap !== map || !map._container) return;

        // O mapa base de Arapongas carrega sua geometria de forma assíncrona. Removemos
        // novamente qualquer camada antiga que tenha chegado depois da troca municipal.
        removeLegacyArapongasBoundary(map);

        if (municipalLayer) {
          try {
            map.removeLayer(municipalLayer);
          } catch {
            // noop
          }
        }
        municipalLayer = L.layerGroup();
        municipalLayer._vfMunicipalOwned = true;
        municipalLayer.addTo(map);
        const boundsPoints: Array<[number, number]> = [];

        for (const element of elements) {
          if (element.type === "relation") {
            for (const member of element.members || []) {
              const geometry = member.geometry || [];
              if (geometry.length < 2) continue;
              const points = geometry.map(
                (point) => [point.lat, point.lon] as [number, number],
              );
              boundsPoints.push(...points);
              const line = L.polyline(points, {
                color: "#ef8429",
                weight: 3,
                opacity: 0.92,
              });
              line._vfMunicipalOwned = true;
              line.addTo(municipalLayer);
            }
            continue;
          }

          const latitude = Number(element.center?.lat ?? element.lat);
          const longitude = Number(element.center?.lon ?? element.lon);
          const label = String(element.tags?.name || "").trim();
          if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
          const marker = L.marker([latitude, longitude], {
            interactive: false,
            icon: L.divIcon({
              className: "district-name vf-municipal-district-name",
              html: label,
              iconSize: [120, 18],
              iconAnchor: [60, 9],
            }),
          });
          marker._vfMunicipalOwned = true;
          marker.addTo(municipalLayer);
        }

        if (boundsPoints.length > 1) {
          municipalBounds = L.latLngBounds(boundsPoints);
          map.fitBounds(municipalBounds, { padding: [18, 18], maxZoom: 14 });
        } else if (municipalCenter) {
          map.setView(municipalCenter.center, municipalCenter.zoom);
        } else {
          const relation = elements.find((element) => element.type === "relation");
          const latitude = Number(relation?.center?.lat);
          const longitude = Number(relation?.center?.lon);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            map.setView([latitude, longitude], 13);
          }
        }
        map._vfMunicipalGeometryLoadedId = municipality.id;
      } catch {
        // O mapa já está corretamente centralizado pela referência local. O provedor
        // externo passa a ser somente um enriquecimento de limites e bairros.
        removeLegacyArapongasBoundary(map);
        if (municipalCenter) {
          map.setView(municipalCenter.center, municipalCenter.zoom);
        }
      } finally {
        if (map._vfMunicipalGeometryLoadingId === municipality.id) {
          delete map._vfMunicipalGeometryLoadingId;
        }
      }
    };

    const onBaseMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map) void decorateMap(map);
    };

    const onHomeClick = (event: Event) => {
      if (!municipality || isArapongas(municipality)) return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".full-map .real-map-toolbar .map-home")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (activeMap && municipalBounds?.isValid?.()) {
        activeMap.fitBounds(municipalBounds, { padding: [18, 18], maxZoom: 14 });
      } else if (activeMap && municipalCenter) {
        activeMap.setView(municipalCenter.center, municipalCenter.zoom);
      }
    };

    apiFetch("/api/municipality-context", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled || !response.ok) return;
        const context = data.context as MunicipalityContext | undefined;
        const current = context?.municipalities?.find(
          (item) => Number(item.id) === Number(context.currentMunicipalityId),
        );
        if (!current) return;
        municipality = current;
        if (isArapongas(current)) return;

        updateMapCopy(current);
        observer = new MutationObserver(() => updateMapCopy(current));
        observer.observe(document.body, { childList: true, subtree: true });
        const existing = (window as any).__vfBaseElectoralMap;
        if (existing?._container) void decorateMap(existing);
      })
      .catch(() => undefined);

    window.addEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
    document.addEventListener("click", onHomeClick, true);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
      document.removeEventListener("click", onHomeClick, true);
      if (activeMap && legacyLayerGuard) {
        try {
          activeMap.off?.("layeradd", legacyLayerGuard);
        } catch {
          // noop
        }
      }
      if (activeMap && municipalLayer) {
        try {
          activeMap.removeLayer(municipalLayer);
        } catch {
          // noop
        }
      }
    };
  }, []);

  return null;
}
