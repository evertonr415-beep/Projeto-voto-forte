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

function isArapongas(municipality: Municipality) {
  return municipality.name.trim().toLocaleLowerCase("pt-BR") === "arapongas";
}

function isLegacyArapongasBoundaryLayer(layer: any) {
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
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3"))
    .find((node) => node.textContent?.trim() === "Mapa eleitoral de Arapongas");
  if (title) title.textContent = `Mapa eleitoral de ${municipality.name}`;

  const mapElement = document.querySelector<HTMLElement>(".full-map .leaflet-map");
  if (mapElement) {
    mapElement.setAttribute(
      "aria-label",
      `Mapa real de ${municipality.name} com bairros e pessoas cadastradas`,
    );
  }

  const status = document.querySelector<HTMLElement>(".full-map .real-map-toolbar strong");
  if (status?.textContent?.includes("Arapongas")) {
    status.textContent = `Mapa real de ${municipality.name}`;
  }

  const home = document.querySelector<HTMLButtonElement>(".full-map .real-map-toolbar .map-home");
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

  // Evita aceitar homônimos de outro estado quando o provedor retorna mais de um resultado.
  // O estado é mantido no contexto para identificação visual e futuras validações por IBGE.
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
    let observer: MutationObserver | null = null;

    const decorateMap = async (map: any) => {
      if (cancelled || !municipality || isArapongas(municipality)) return;
      if (!map?._container || map._vfMunicipalContextId === municipality.id) return;
      const L = (window as any).L;
      if (!L) return;

      map._vfMunicipalContextId = municipality.id;
      activeMap = map;
      removeLegacyArapongasBoundary(map);
      updateMapCopy(municipality);

      try {
        const elements = await loadMunicipalityGeometry(municipality);
        if (cancelled || activeMap !== map || !map._container) return;

        if (municipalLayer) {
          try { map.removeLayer(municipalLayer); } catch { /* noop */ }
        }
        municipalLayer = L.layerGroup().addTo(map);
        const boundsPoints: Array<[number, number]> = [];

        for (const element of elements) {
          if (element.type === "relation") {
            for (const member of element.members || []) {
              const geometry = member.geometry || [];
              if (geometry.length < 2) continue;
              const points = geometry.map((point) => [point.lat, point.lon] as [number, number]);
              boundsPoints.push(...points);
              L.polyline(points, {
                color: "#ef8429",
                weight: 3,
                opacity: 0.92,
              }).addTo(municipalLayer);
            }
            continue;
          }

          const latitude = Number(element.center?.lat ?? element.lat);
          const longitude = Number(element.center?.lon ?? element.lon);
          const label = String(element.tags?.name || "").trim();
          if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
          L.marker([latitude, longitude], {
            interactive: false,
            icon: L.divIcon({
              className: "district-name vf-municipal-district-name",
              html: label,
              iconSize: [120, 18],
              iconAnchor: [60, 9],
            }),
          }).addTo(municipalLayer);
        }

        if (boundsPoints.length > 1) {
          municipalBounds = L.latLngBounds(boundsPoints);
          map.fitBounds(municipalBounds, { padding: [18, 18], maxZoom: 14 });
        } else {
          const relation = elements.find((element) => element.type === "relation");
          const latitude = Number(relation?.center?.lat);
          const longitude = Number(relation?.center?.lon);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            map.setView([latitude, longitude], 13);
            municipalBounds = L.latLngBounds([[latitude, longitude], [latitude, longitude]]);
          }
        }
      } catch {
        // Se o provedor cartográfico estiver indisponível, mantemos o mapa funcional,
        // mas nunca restauramos os limites de Arapongas em outro município.
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
      if (activeMap && municipalLayer) {
        try { activeMap.removeLayer(municipalLayer); } catch { /* noop */ }
      }
    };
  }, []);

  return null;
}
