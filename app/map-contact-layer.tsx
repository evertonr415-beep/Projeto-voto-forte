"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type MapFeature = {
  feature_type: "point" | "cluster";
  latitude: number;
  longitude: number;
  total: number;
  voters: number;
  leaders: number;
  record_id?: number | null;
  contact_name?: string | null;
  profile?: string | null;
  district?: string | null;
  street?: string | null;
  street_number?: string | null;
};

type ApproximateDistrict = {
  district: string;
  total: number;
  voters: number;
  leaders: number;
};

type MapStats = {
  totalContacts: number;
  mappedContacts: number;
  approximatedContacts: number;
  unresolvedContacts: number;
};

type MapResponse = {
  features?: MapFeature[];
  approximateDistricts?: ApproximateDistrict[];
  stats?: MapStats;
};

type TerritoryCenter = { latitude: number; longitude: number };

const STYLE_ID = "vf-modern-map-contact-styles";
const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");
const TERRITORY_CENTER_CACHE_KEY = "vf:map-territory-centers:v2";
const TERRITORY_CENTER_TTL = 24 * 60 * 60 * 1000;
const ARAPONGAS_CENTER = { latitude: -23.4153, longitude: -51.4256 };
let territoryCentersPromise: Promise<Map<string, TerritoryCenter>> | null = null;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

function plainText(value: unknown) {
  const html = String(value ?? "");
  const span = html.match(/<span[^>]*>(.*?)<\/span>/i)?.[1] || html;
  return span.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-map-contact-control{background:rgba(255,255,255,.97);backdrop-filter:blur(10px);border:1px solid rgba(23,52,92,.12);border-radius:14px;box-shadow:0 10px 28px rgba(15,35,65,.16);padding:10px;min-width:230px;max-width:300px;font:600 12px/1.3 Arial,sans-serif;color:#17345c}
    .vf-map-contact-control strong{display:block;font-size:13px;margin-bottom:7px}.vf-map-contact-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.vf-map-contact-tabs button{border:1px solid #d8e1ec;border-radius:9px;background:#fff;color:#17345c;padding:7px 5px;font:700 11px/1 Arial,sans-serif;cursor:pointer}.vf-map-contact-tabs button.active{background:#17345c;color:#fff;border-color:#17345c}.vf-map-contact-status{display:block;margin-top:8px;color:#64748b;font-size:11px;font-weight:600}.vf-map-contact-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:7px;color:#475569;font-size:10px;font-weight:700}.vf-map-contact-legend span{display:inline-flex;align-items:center;gap:4px}.vf-map-contact-legend i{display:inline-block;width:8px;height:8px;border-radius:50%}.vf-map-contact-legend .voter{background:#239653}.vf-map-contact-legend .leader{background:#c62828}.vf-map-contact-legend .approx{background:#5b79a3;border:1px dashed #fff}
    .vf-map-cluster,.vf-map-district-cluster,.vf-map-person{background:transparent!important;border:0!important}.vf-map-cluster span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#17345c;color:#fff;border:3px solid rgba(255,255,255,.95);box-shadow:0 4px 14px rgba(15,35,65,.28);font:800 12px/1 Arial,sans-serif}.vf-map-district-cluster span{display:grid;place-items:center;min-width:48px;height:48px;padding:0 7px;border-radius:50%;background:rgba(74,103,143,.9);color:#fff;border:2px dashed rgba(255,255,255,.95);box-shadow:0 4px 13px rgba(15,35,65,.2);font:850 11px/1 Arial,sans-serif}.vf-map-district-cluster.fallback span{min-width:62px;height:62px;background:rgba(31,69,112,.92);font-size:12px}.vf-map-pin{position:relative;display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 10px rgba(15,35,65,.28)}.vf-map-pin i{transform:rotate(45deg);font:900 12px/1 Arial,sans-serif;color:#fff;font-style:normal}.vf-map-pin.voter{background:#239653}.vf-map-pin.leader{background:#c62828}.vf-map-contact-popup{min-width:180px;font:500 12px/1.35 Arial,sans-serif;color:#23354d}.vf-map-contact-popup strong{display:block;font-size:14px;color:#17345c;margin-bottom:4px}.vf-map-contact-popup b{display:inline-block;border-radius:999px;padding:3px 7px;margin-bottom:5px;background:#eef4fa;color:#17345c;font-size:10px}.vf-map-contact-popup p{margin:4px 0 0}.vf-map-contact-popup small{display:block;margin-top:7px;color:#64748b}
    @media(max-width:760px){.vf-map-contact-control{min-width:195px;max-width:235px;padding:8px}.vf-map-contact-tabs button{padding:7px 3px;font-size:10px}}
  `;
  document.head.appendChild(style);
}

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function isElectoralMapContainer(map: any) {
  const container = map?.getContainer?.() as HTMLElement | undefined;
  return Boolean(container?.closest(".full-map"));
}

function removeLegacyContactPins(map: any) {
  const removals: any[] = [];
  map.eachLayer?.((layer: any) => {
    const className = String(layer?.options?.icon?.options?.className || "");
    if (className.includes("contact-pin")) removals.push(layer);
  });
  removals.forEach((layer) => map.removeLayer(layer));
}

function collectCentersFromMap(map: any) {
  const centers = new Map<string, TerritoryCenter>();
  map.eachLayer?.((layer: any) => {
    const className = String(layer?.options?.icon?.options?.className || "");
    if (!className.includes("district-name") && !className.includes("vf-territory-label")) return;
    const latLng = layer?.getLatLng?.();
    const name = normalize(plainText(layer?.options?.icon?.options?.html));
    const latitude = Number(latLng?.lat);
    const longitude = Number(latLng?.lng);
    if (name && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      centers.set(name, { latitude, longitude });
    }
  });
  return centers;
}

function mergeCenters(
  current: Map<string, TerritoryCenter>,
  incoming: Map<string, TerritoryCenter>,
) {
  const merged = new Map(current);
  for (const [key, value] of incoming) if (!merged.has(key)) merged.set(key, value);
  return merged;
}

async function loadTerritoryCenters() {
  if (territoryCentersPromise) return territoryCentersPromise;
  territoryCentersPromise = (async () => {
    try {
      const cached = window.sessionStorage.getItem(TERRITORY_CENTER_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          savedAt?: number;
          entries?: Array<[string, TerritoryCenter]>;
        };
        if (parsed.savedAt && Date.now() - parsed.savedAt < TERRITORY_CENTER_TTL && Array.isArray(parsed.entries)) {
          return new Map(parsed.entries);
        }
      }
    } catch {
      // Cache opcional.
    }

    try {
      const query =
        '[out:json][timeout:20];area["name"="Arapongas"]["boundary"="administrative"]->.a;(relation["boundary"="administrative"]["admin_level"~"10|11"](area.a);way["boundary"="administrative"]["admin_level"~"10|11"](area.a);node["place"~"neighbourhood|suburb|quarter"]["name"](area.a););out tags center;';
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6500);
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
      if (!response.ok) return new Map<string, TerritoryCenter>();
      const data = (await response.json()) as {
        elements?: Array<{
          lat?: number;
          lon?: number;
          center?: { lat?: number; lon?: number };
          tags?: { name?: string };
        }>;
      };
      const centers = new Map<string, TerritoryCenter>();
      for (const element of data.elements || []) {
        const name = normalize(element.tags?.name);
        const latitude = Number(element.center?.lat ?? element.lat);
        const longitude = Number(element.center?.lon ?? element.lon);
        if (name && Number.isFinite(latitude) && Number.isFinite(longitude) && !centers.has(name)) {
          centers.set(name, { latitude, longitude });
        }
      }
      try {
        window.sessionStorage.setItem(
          TERRITORY_CENTER_CACHE_KEY,
          JSON.stringify({ savedAt: Date.now(), entries: Array.from(centers.entries()) }),
        );
      } catch {
        // Cache opcional.
      }
      return centers;
    } catch {
      return new Map<string, TerritoryCenter>();
    }
  })();
  return territoryCentersPromise;
}

export default function MapContactLayer() {
  useLayoutEffect(() => {
    installStyles();
    let cancelled = false;
    let patchTimer: number | null = null;
    let patchTimeout: number | null = null;
    let originalMapFactory: any = null;
    let headObserver: MutationObserver | null = null;
    const cleanupMaps = new Set<() => void>();

    const setupMap = (map: any) => {
      if (cancelled || !isElectoralMapContainer(map) || map._vfModernContacts) return;
      map._vfModernContacts = true;
      const L = (window as any).L;
      if (!L) return;

      const layer = L.layerGroup().addTo(map);
      let profile = "";
      let requestId = 0;
      let moveTimer: number | null = null;
      let stats: MapStats | null = null;
      let features: MapFeature[] = [];
      let approximateDistricts: ApproximateDistrict[] = [];
      let centers = collectCentersFromMap(map);
      let lastScope = currentScope();
      const centerScanTimers: number[] = [];

      const control = L.control({ position: "topright" });
      let controlNode: HTMLElement | null = null;
      control.onAdd = () => {
        const node = L.DomUtil.create("div", "vf-map-contact-control") as HTMLElement;
        node.innerHTML = `
          <strong>Contatos no mapa</strong>
          <div class="vf-map-contact-tabs">
            <button type="button" data-profile="" class="active">Todos</button>
            <button type="button" data-profile="Eleitor">Eleitores</button>
            <button type="button" data-profile="Liderança">Lideranças</button>
          </div>
          <span class="vf-map-contact-status">Carregando contatos…</span>
          <div class="vf-map-contact-legend"><span><i class="voter"></i>Eleitor</span><span><i class="leader"></i>Liderança</span><span><i class="approx"></i>Bairro aproximado</span></div>
        `;
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        controlNode = node;
        node.querySelectorAll<HTMLButtonElement>("[data-profile]").forEach((button) => {
          button.addEventListener("click", () => {
            profile = button.dataset.profile || "";
            node.querySelectorAll<HTMLButtonElement>("button").forEach((item) =>
              item.classList.toggle("active", item === button),
            );
            stats = null;
            features = [];
            approximateDistricts = [];
            void refresh(true);
          });
        });
        return node;
      };
      control.addTo(map);
      (window as any).__vfElectoralMap = map;
      window.dispatchEvent(
        new CustomEvent("voto-forte:electoral-map-ready", { detail: { map } }),
      );

      const updateStatus = (loading = false) => {
        const node = controlNode?.querySelector<HTMLElement>(".vf-map-contact-status");
        if (!node) return;
        if (loading) {
          node.textContent = "Atualizando contatos…";
          return;
        }
        if (!stats) {
          node.textContent = "Camada de contatos ativa";
          return;
        }
        node.textContent = `${NUMBER_FORMATTER.format(stats.totalContacts)} na base · ${NUMBER_FORMATTER.format(stats.mappedContacts)} exatos · ${NUMBER_FORMATTER.format(stats.approximatedContacts)} por bairro${stats.unresolvedContacts ? ` · ${NUMBER_FORMATTER.format(stats.unresolvedContacts)} sem posição suficiente` : ""}`;
      };

      const draw = () => {
        if (cancelled || !map._container) return;
        layer.clearLayers();
        const paddedBounds = map.getBounds().pad(0.2);
        let representedApprox = 0;
        let fallbackVoters = 0;
        let fallbackLeaders = 0;

        for (const district of approximateDistricts) {
          const total = Math.max(0, Number(district.total || 0));
          const center = centers.get(normalize(district.district));
          if (!center) {
            fallbackVoters += Number(district.voters || 0);
            fallbackLeaders += Number(district.leaders || 0);
            continue;
          }
          representedApprox += total;
          if (!paddedBounds.contains([center.latitude, center.longitude])) continue;
          const marker = L.marker([center.latitude, center.longitude], {
            icon: L.divIcon({
              className: "vf-map-district-cluster",
              html: `<span>${NUMBER_FORMATTER.format(total)}</span>`,
              iconSize: [52, 52],
              iconAnchor: [26, 26],
            }),
          });
          marker.bindPopup(
            `<div class="vf-map-contact-popup"><strong>${escapeHtml(district.district)}</strong><b>Agrupamento por bairro</b><p>${NUMBER_FORMATTER.format(Number(district.voters || 0))} eleitor(es) · ${NUMBER_FORMATTER.format(Number(district.leaders || 0))} liderança(s)</p><small>Posição aproximada pelo centro do bairro. Não representa endereço individual.</small></div>`,
            { maxWidth: 280 },
          );
          marker.addTo(layer);
        }

        const fallbackTotal = fallbackVoters + fallbackLeaders;
        if (
          fallbackTotal > 0 &&
          paddedBounds.contains([ARAPONGAS_CENTER.latitude, ARAPONGAS_CENTER.longitude])
        ) {
          const fallback = L.marker(
            [ARAPONGAS_CENTER.latitude, ARAPONGAS_CENTER.longitude],
            {
              icon: L.divIcon({
                className: "vf-map-district-cluster fallback",
                html: `<span>${NUMBER_FORMATTER.format(fallbackTotal)}</span>`,
                iconSize: [66, 66],
                iconAnchor: [33, 33],
              }),
            },
          );
          fallback.bindPopup(
            `<div class="vf-map-contact-popup"><strong>Outras localidades de Arapongas</strong><b>Agrupamento municipal</b><p>${NUMBER_FORMATTER.format(fallbackVoters)} eleitor(es) · ${NUMBER_FORMATTER.format(fallbackLeaders)} liderança(s)</p><small>Estes contatos possuem bairro/localidade na base, mas o centro territorial ainda não foi resolvido no mapa. O ponto indica apenas o município.</small></div>`,
            { maxWidth: 290 },
          );
          fallback.addTo(layer);
        }

        for (const feature of features) {
          const lat = Number(feature.latitude);
          const lon = Number(feature.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          if (feature.feature_type === "cluster" || Number(feature.total) > 1) {
            const total = Math.max(2, Number(feature.total) || 2);
            const marker = L.marker([lat, lon], {
              icon: L.divIcon({
                className: "vf-map-cluster",
                html: `<span>${NUMBER_FORMATTER.format(total)}</span>`,
                iconSize: [42, 42],
                iconAnchor: [21, 21],
              }),
            });
            marker.bindTooltip(
              `${NUMBER_FORMATTER.format(Number(feature.voters || 0))} eleitor(es) · ${NUMBER_FORMATTER.format(Number(feature.leaders || 0))} liderança(s)`,
              { direction: "top" },
            );
            marker.on("click", () =>
              map.setView([lat, lon], Math.min(19, map.getZoom() + 2), { animate: true }),
            );
            marker.addTo(layer);
            continue;
          }

          const isLeader =
            String(feature.profile || "").toLocaleLowerCase("pt-BR") === "liderança";
          const marker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: "vf-map-person",
              html: `<span class="vf-map-pin ${isLeader ? "leader" : "voter"}"><i>${isLeader ? "L" : "•"}</i></span>`,
              iconSize: [32, 36],
              iconAnchor: [15, 32],
              popupAnchor: [0, -30],
            }),
          });
          const address = [feature.street, feature.street_number].filter(Boolean).join(", ");
          marker.bindPopup(
            `<div class="vf-map-contact-popup"><strong>${escapeHtml(feature.contact_name || "Contato")}</strong><b>${escapeHtml(feature.profile || "Eleitor")}</b>${feature.district ? `<p>${escapeHtml(feature.district)}</p>` : ""}${address ? `<p>${escapeHtml(address)}</p>` : ""}</div>`,
            { maxWidth: 260, closeButton: true },
          );
          marker.addTo(layer);
        }

        map._vfModernContactApproxResolved = representedApprox;
      };

      const refreshCentersFromExistingMap = () => {
        centers = mergeCenters(centers, collectCentersFromMap(map));
        draw();
      };

      async function refresh(includeStats = false) {
        if (cancelled || !map._container) return;
        const id = ++requestId;
        const bounds = map.getBounds();
        const scope = currentScope();
        if (scope !== lastScope) {
          lastScope = scope;
          stats = null;
          approximateDistricts = [];
          includeStats = true;
        }
        const params = new URLSearchParams({
          south: String(bounds.getSouth()),
          west: String(bounds.getWest()),
          north: String(bounds.getNorth()),
          east: String(bounds.getEast()),
          zoom: String(map.getZoom()),
        });
        if (scope) params.set("owner", scope);
        if (profile) params.set("profile", profile);
        if (includeStats || !stats) params.set("stats", "1");

        updateStatus(true);
        try {
          const response = await apiFetch(`/api/map-contacts?${params.toString()}`, {
            cache: "no-store",
          });
          const data = (await response.json()) as MapResponse & { error?: string };
          if (!response.ok) throw new Error(data.error || "Falha ao carregar mapa");
          if (cancelled || id !== requestId) return;
          if (data.stats) stats = data.stats;
          if (Array.isArray(data.approximateDistricts)) approximateDistricts = data.approximateDistricts;
          features = Array.isArray(data.features) ? data.features : [];
          centers = mergeCenters(centers, collectCentersFromMap(map));
          draw();
          updateStatus(false);

          if (!centers.size || approximateDistricts.length > centers.size) {
            void loadTerritoryCenters().then((loaded) => {
              if (cancelled || id !== requestId) return;
              centers = mergeCenters(centers, loaded);
              draw();
            });
          }
        } catch {
          if (id === requestId && controlNode) {
            const node = controlNode.querySelector<HTMLElement>(".vf-map-contact-status");
            if (node) node.textContent = "Não foi possível atualizar os contatos agora";
          }
        }
      }

      const scheduleRefresh = () => {
        if (moveTimer !== null) window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(() => {
          moveTimer = null;
          void refresh(false);
        }, 160);
      };

      const handleScopeChange = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.matches(".scope-picker select")) return;
        stats = null;
        features = [];
        approximateDistricts = [];
        void refresh(true);
      };
      const handleRecordsChanged = () => {
        stats = null;
        features = [];
        approximateDistricts = [];
        void refresh(true);
      };

      map.on("moveend zoomend", scheduleRefresh);
      document.addEventListener("change", handleScopeChange, true);
      window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);

      [0, 80, 350].forEach((delay) =>
        centerScanTimers.push(
          window.setTimeout(() => {
            removeLegacyContactPins(map);
            if (delay === 0) void refresh(true);
            else refreshCentersFromExistingMap();
          }, delay),
        ),
      );
      [900, 1800, 3600, 6500].forEach((delay) =>
        centerScanTimers.push(window.setTimeout(refreshCentersFromExistingMap, delay)),
      );

      const cleanup = () => {
        requestId += 1;
        if (moveTimer !== null) window.clearTimeout(moveTimer);
        centerScanTimers.forEach((timer) => window.clearTimeout(timer));
        map.off("moveend zoomend", scheduleRefresh);
        document.removeEventListener("change", handleScopeChange, true);
        window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
        window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
        if ((window as any).__vfElectoralMap === map) {
          delete (window as any).__vfElectoralMap;
        }
        try {
          map.removeLayer(layer);
          map.removeControl(control);
        } catch {
          // O mapa pode ter sido destruído pela navegação.
        }
        cleanupMaps.delete(cleanup);
      };
      cleanupMaps.add(cleanup);
      map.on("unload", cleanup);
    };

    const patchLeaflet = () => {
      const L = (window as any).L;
      if (!L?.map || L.map.__vfModernContactsPatched) return false;
      originalMapFactory = L.map;
      const wrappedMap = function (this: unknown, ...args: any[]) {
        const map = originalMapFactory.apply(this, args);
        setupMap(map);
        return map;
      };
      Object.assign(wrappedMap, originalMapFactory);
      wrappedMap.__vfModernContactsPatched = true;
      L.map = wrappedMap;
      return true;
    };

    const watchLeafletScript = (node: Node) => {
      if (!(node instanceof HTMLScriptElement)) return;
      if (node.dataset.vfLeaflet !== "true" || node.dataset.vfModernContactsWatch === "true") return;
      node.dataset.vfModernContactsWatch = "true";
      node.addEventListener("load", patchLeaflet, { once: true });
    };

    document.querySelectorAll<HTMLScriptElement>("script[data-vf-leaflet]").forEach(watchLeafletScript);
    headObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) watchLeafletScript(node);
      }
    });
    headObserver.observe(document.head, { childList: true });

    if (!patchLeaflet()) {
      patchTimer = window.setInterval(() => {
        if (patchLeaflet() && patchTimer !== null) {
          window.clearInterval(patchTimer);
          patchTimer = null;
        }
      }, 50);
      patchTimeout = window.setTimeout(() => {
        if (patchTimer !== null) window.clearInterval(patchTimer);
        patchTimer = null;
      }, 8000);
    }

    return () => {
      cancelled = true;
      cleanupMaps.forEach((cleanup) => cleanup());
      cleanupMaps.clear();
      headObserver?.disconnect();
      if (patchTimer !== null) window.clearInterval(patchTimer);
      if (patchTimeout !== null) window.clearTimeout(patchTimeout);
      const L = (window as any).L;
      if (L?.map?.__vfModernContactsPatched && originalMapFactory) L.map = originalMapFactory;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
