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

function setTextIfChanged(node: HTMLElement | null, value: string) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setAttributeIfChanged(node: HTMLElement | null, name: string, value: string) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function updateMapCopy(municipality: Municipality) {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3")).find(
    (node) =>
      node.textContent?.trim() === "Mapa eleitoral de Arapongas" ||
      node.textContent?.trim().startsWith("Mapa eleitoral de "),
  );
  setTextIfChanged(title || null, `Mapa eleitoral de ${municipality.name}`);

  const mapElement = document.querySelector<HTMLElement>(".full-map .leaflet-map");
  setAttributeIfChanged(
    mapElement,
    "aria-label",
    `Mapa real de ${municipality.name} com bairros e pessoas cadastradas`,
  );

  const status = document.querySelector<HTMLElement>(".full-map .real-map-toolbar strong");
  setTextIfChanged(status, `Mapa real de ${municipality.name}`);

  const home = document.querySelector<HTMLButtonElement>(
    ".full-map .real-map-toolbar .map-home",
  );
  setTextIfChanged(home, municipality.name);
}

function installMunicipalitySelector(
  context: MunicipalityContext,
  onChange: (municipalityId: number, select: HTMLSelectElement) => void,
) {
  const mapRoot = document.querySelector<HTMLElement>(".full-map");
  if (!mapRoot) return;

  const existing = mapRoot.querySelector<HTMLElement>("[data-vf-map-municipality-selector]");
  if (existing) {
    const select = existing.querySelector<HTMLSelectElement>("select");
    if (select && Number(select.value) !== Number(context.currentMunicipalityId)) {
      select.value = String(context.currentMunicipalityId);
    }
    return;
  }

  const host = document.createElement("div");
  host.dataset.vfMapMunicipalitySelector = "true";
  host.style.display = "flex";
  host.style.alignItems = "center";
  host.style.gap = "8px";
  host.style.flexWrap = "wrap";
  host.style.padding = "8px 10px";
  host.style.margin = "0 0 10px";
  host.style.border = "1px solid rgba(148, 163, 184, 0.22)";
  host.style.borderRadius = "12px";
  host.style.background = "rgba(15, 23, 42, 0.78)";
  host.style.backdropFilter = "blur(10px)";

  const label = document.createElement("label");
  label.textContent = "Município";
  label.style.fontSize = "12px";
  label.style.fontWeight = "700";
  label.style.color = "#cbd5e1";
  label.htmlFor = "vf-map-municipality-select";

  const select = document.createElement("select");
  select.id = "vf-map-municipality-select";
  select.setAttribute("aria-label", "Selecionar município no mapa");
  select.style.minWidth = "220px";
  select.style.maxWidth = "100%";
  select.style.height = "38px";
  select.style.padding = "0 34px 0 12px";
  select.style.borderRadius = "10px";
  select.style.border = "1px solid rgba(148, 163, 184, 0.28)";
  select.style.background = "#0f172a";
  select.style.color = "#f8fafc";
  select.style.fontWeight = "650";
  select.style.cursor = "pointer";

  for (const item of context.municipalities) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = `${item.name} - ${item.state}`;
    select.appendChild(option);
  }
  select.value = String(context.currentMunicipalityId);

  const total = document.createElement("small");
  total.textContent = `${context.municipalities.length} município${context.municipalities.length === 1 ? "" : "s"} disponível${context.municipalities.length === 1 ? "" : "is"}`;
  total.style.color = "#94a3b8";
  total.style.fontSize = "11px";

  select.addEventListener("change", () => {
    const municipalityId = Number(select.value);
    if (!Number.isInteger(municipalityId) || municipalityId <= 0) return;
    if (municipalityId === Number(context.currentMunicipalityId)) return;
    onChange(municipalityId, select);
  });

  host.append(label, select, total);

  const toolbar = mapRoot.querySelector<HTMLElement>(".real-map-toolbar");
  if (toolbar?.parentElement) toolbar.insertAdjacentElement("afterend", host);
  else mapRoot.prepend(host);
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

  void state;
  return elements;
}

export default function MunicipalElectoralMapContext() {
  useEffect(() => {
    let cancelled = false;
    let municipality: Municipality | null = null;
    let municipalityContext: MunicipalityContext | null = null;
    let activeMap: any = null;
    let municipalLayer: any = null;
    let municipalBounds: any = null;
    let municipalCenter: MunicipalityFallback | null = null;
    let observer: MutationObserver | null = null;
    let authObserver: MutationObserver | null = null;
    let contextRequested = false;
    let copyUpdateQueued = false;
    let legacyLayerGuard: ((event: any) => void) | null = null;
    let switchingMunicipality = false;

    const switchMunicipality = async (municipalityId: number, select: HTMLSelectElement) => {
      if (switchingMunicipality) return;
      switchingMunicipality = true;
      select.disabled = true;
      const original = select.style.opacity;
      select.style.opacity = "0.65";
      try {
        const response = await apiFetch("/api/municipality-context", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ municipalityId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Não foi possível trocar o município.");
        window.location.reload();
      } catch (error) {
        select.disabled = false;
        select.style.opacity = original;
        if (municipalityContext) select.value = String(municipalityContext.currentMunicipalityId);
        window.alert(error instanceof Error ? error.message : "Não foi possível trocar o município.");
        switchingMunicipality = false;
      }
    };

    const ensureSelector = () => {
      if (!municipalityContext) return;
      installMunicipalitySelector(municipalityContext, switchMunicipality);
    };

    const scheduleCopyUpdate = () => {
      if (!municipality || copyUpdateQueued) return;
      copyUpdateQueued = true;
      window.requestAnimationFrame(() => {
        copyUpdateQueued = false;
        if (!cancelled && municipality) {
          updateMapCopy(municipality);
          ensureSelector();
        }
      });
    };

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
      ensureSelector();
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

    const loadContext = () => {
      if (cancelled || contextRequested) return;
      contextRequested = true;
      authObserver?.disconnect();
      authObserver = null;

      apiFetch("/api/municipality-context", { cache: "no-store" })
        .then(async (response) => ({ response, data: await response.json() }))
        .then(({ response, data }) => {
          if (cancelled || !response.ok) return;
          const context = data.context as MunicipalityContext | undefined;
          const current = context?.municipalities?.find(
            (item) => Number(item.id) === Number(context.currentMunicipalityId),
          );
          if (!context || !current) return;
          municipalityContext = context;
          municipality = current;

          updateMapCopy(current);
          ensureSelector();
          observer = new MutationObserver(() => scheduleCopyUpdate());
          observer.observe(document.body, { childList: true, subtree: true });

          if (isArapongas(current)) return;
          const existing = (window as any).__vfBaseElectoralMap;
          if (existing?._container) void decorateMap(existing);
        })
        .catch(() => undefined);
    };

    const waitForProtectedAccess = () => {
      if (!document.querySelector(".auth-page")) {
        loadContext();
        return;
      }

      authObserver = new MutationObserver(() => {
        if (!document.querySelector(".auth-page")) {
          authObserver?.disconnect();
          authObserver = null;
          loadContext();
        }
      });
      authObserver.observe(document.body, { childList: true, subtree: true });
    };

    waitForProtectedAccess();

    window.addEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
    document.addEventListener("click", onHomeClick, true);

    return () => {
      cancelled = true;
      observer?.disconnect();
      authObserver?.disconnect();
      window.removeEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
      document.removeEventListener("click", onHomeClick, true);
      document.querySelector("[data-vf-map-municipality-selector]")?.remove();
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
