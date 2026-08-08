"use client";

import { useEffect } from "react";
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

type MapStats = {
  totalContacts: number;
  mappedContacts: number;
  unmappedContacts: number;
};

type MapResponse = {
  features?: MapFeature[];
  stats?: MapStats;
};

const STYLE_ID = "vf-modern-map-contact-styles";
const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-map-contact-control{background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border:1px solid rgba(23,52,92,.12);border-radius:14px;box-shadow:0 10px 28px rgba(15,35,65,.16);padding:10px;min-width:220px;font:600 12px/1.25 Arial,sans-serif;color:#17345c}
    .vf-map-contact-control strong{display:block;font-size:13px;margin-bottom:7px}
    .vf-map-contact-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
    .vf-map-contact-tabs button{border:1px solid #d8e1ec;border-radius:9px;background:#fff;color:#17345c;padding:7px 5px;font:700 11px/1 Arial,sans-serif;cursor:pointer}
    .vf-map-contact-tabs button.active{background:#17345c;color:#fff;border-color:#17345c}
    .vf-map-contact-status{display:block;margin-top:8px;color:#64748b;font-size:11px;font-weight:600}
    .vf-map-cluster{background:transparent!important;border:0!important}
    .vf-map-cluster span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#17345c;color:#fff;border:3px solid rgba(255,255,255,.95);box-shadow:0 4px 14px rgba(15,35,65,.28);font:800 12px/1 Arial,sans-serif}
    .vf-map-person{background:transparent!important;border:0!important}
    .vf-map-pin{position:relative;display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 10px rgba(15,35,65,.28)}
    .vf-map-pin i{transform:rotate(45deg);font:900 12px/1 Arial,sans-serif;color:#fff;font-style:normal}
    .vf-map-pin.voter{background:#239653}
    .vf-map-pin.leader{background:#c62828}
    .vf-map-contact-popup{min-width:180px;font:500 12px/1.35 Arial,sans-serif;color:#23354d}
    .vf-map-contact-popup strong{display:block;font-size:14px;color:#17345c;margin-bottom:4px}
    .vf-map-contact-popup b{display:inline-block;border-radius:999px;padding:3px 7px;margin-bottom:5px;background:#eef4fa;color:#17345c;font-size:10px}
    .vf-map-contact-popup p{margin:4px 0 0}
    @media(max-width:760px){.vf-map-contact-control{min-width:190px;padding:8px}.vf-map-contact-tabs button{padding:7px 3px;font-size:10px}}
  `;
  document.head.appendChild(style);
}

function currentScope() {
  return (
    document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || ""
  );
}

function isElectoralMapContainer(map: any) {
  const container = map?.getContainer?.() as HTMLElement | undefined;
  if (!container) return false;
  return Boolean(container.closest(".full-map"));
}

function removeLegacyContactPins(map: any) {
  const removals: any[] = [];
  map.eachLayer?.((layer: any) => {
    const className = String(layer?.options?.icon?.options?.className || "");
    if (className.includes("contact-pin")) removals.push(layer);
  });
  removals.forEach((layer) => map.removeLayer(layer));
}

export default function MapContactLayer() {
  useEffect(() => {
    installStyles();
    let cancelled = false;
    let patchTimer: number | null = null;
    let patchTimeout: number | null = null;
    let originalMapFactory: any = null;
    const cleanupMaps = new Set<() => void>();

    const setupMap = (map: any) => {
      if (cancelled || !isElectoralMapContainer(map) || map._vfModernContacts) return;
      map._vfModernContacts = true;
      removeLegacyContactPins(map);

      const L = (window as any).L;
      if (!L) return;

      const layer = L.layerGroup().addTo(map);
      let profile = "";
      let requestId = 0;
      let moveTimer: number | null = null;
      let stats: MapStats | null = null;
      let lastScope = currentScope();

      const control = L.control({ position: "topright" });
      let controlNode: HTMLElement | null = null;
      control.onAdd = () => {
        const node = L.DomUtil.create("div", "vf-map-contact-control");
        node.innerHTML = `
          <strong>Contatos no mapa</strong>
          <div class="vf-map-contact-tabs">
            <button type="button" data-profile="" class="active">Todos</button>
            <button type="button" data-profile="Eleitor">Eleitores</button>
            <button type="button" data-profile="Liderança">Lideranças</button>
          </div>
          <span class="vf-map-contact-status">Preparando camada…</span>
        `;
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        controlNode = node;
        node.querySelectorAll<HTMLButtonElement>("[data-profile]").forEach((button) => {
          button.addEventListener("click", () => {
            profile = button.dataset.profile || "";
            node.querySelectorAll("button").forEach((item: HTMLButtonElement) =>
              item.classList.toggle("active", item === button),
            );
            stats = null;
            void refresh(true);
          });
        });
        return node;
      };
      control.addTo(map);

      const updateStatus = (loading = false) => {
        const node = controlNode?.querySelector<HTMLElement>(".vf-map-contact-status");
        if (!node) return;
        if (loading) {
          node.textContent = "Atualizando área visível…";
          return;
        }
        if (!stats) {
          node.textContent = "Camada de contatos ativa";
          return;
        }
        node.textContent = `${NUMBER_FORMATTER.format(stats.mappedContacts)} localizados de ${NUMBER_FORMATTER.format(stats.totalContacts)} · ${NUMBER_FORMATTER.format(stats.unmappedContacts)} sem coordenadas`;
      };

      const drawFeatures = (features: MapFeature[]) => {
        layer.clearLayers();
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
            marker.on("click", () => {
              map.setView([lat, lon], Math.min(19, map.getZoom() + 2), {
                animate: true,
              });
            });
            marker.addTo(layer);
            continue;
          }

          const isLeader = String(feature.profile || "").toLocaleLowerCase("pt-BR") === "liderança";
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
      };

      async function refresh(includeStats = false) {
        if (cancelled || !map._container) return;
        const id = ++requestId;
        const bounds = map.getBounds();
        const scope = currentScope();
        if (scope !== lastScope) {
          lastScope = scope;
          stats = null;
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
          drawFeatures(Array.isArray(data.features) ? data.features : []);
          updateStatus(false);
        } catch {
          if (id === requestId && controlNode) {
            const node = controlNode.querySelector<HTMLElement>(".vf-map-contact-status");
            if (node) node.textContent = "Não foi possível atualizar a camada agora";
          }
        }
      }

      const scheduleRefresh = () => {
        if (moveTimer !== null) window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(() => {
          moveTimer = null;
          void refresh(false);
        }, 180);
      };

      const handleScopeChange = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.matches(".scope-picker select")) return;
        stats = null;
        void refresh(true);
      };
      const handleRecordsChanged = () => {
        stats = null;
        void refresh(true);
      };

      map.on("moveend zoomend", scheduleRefresh);
      document.addEventListener("change", handleScopeChange, true);
      window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);

      window.setTimeout(() => {
        removeLegacyContactPins(map);
        void refresh(true);
      }, 0);

      const cleanup = () => {
        requestId += 1;
        if (moveTimer !== null) window.clearTimeout(moveTimer);
        map.off("moveend zoomend", scheduleRefresh);
        document.removeEventListener("change", handleScopeChange, true);
        window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
        window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
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
        window.setTimeout(() => setupMap(map), 0);
        return map;
      };
      Object.assign(wrappedMap, originalMapFactory);
      wrappedMap.__vfModernContactsPatched = true;
      L.map = wrappedMap;
      return true;
    };

    if (!patchLeaflet()) {
      patchTimer = window.setInterval(() => {
        if (patchLeaflet() && patchTimer !== null) {
          window.clearInterval(patchTimer);
          patchTimer = null;
        }
      }, 100);
      patchTimeout = window.setTimeout(() => {
        if (patchTimer !== null) window.clearInterval(patchTimer);
        patchTimer = null;
      }, 12_000);
    }

    return () => {
      cancelled = true;
      cleanupMaps.forEach((cleanup) => cleanup());
      cleanupMaps.clear();
      if (patchTimer !== null) window.clearInterval(patchTimer);
      if (patchTimeout !== null) window.clearTimeout(patchTimeout);
      const L = (window as any).L;
      if (L?.map?.__vfModernContactsPatched && originalMapFactory) {
        L.map = originalMapFactory;
      }
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
