"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type MapFeature = {
  feature_type: "point" | "cluster";
  latitude: number | string;
  longitude: number | string;
  total: number | string;
  voters: number | string;
  leaders: number | string;
  contact_name?: string | null;
  profile?: string | null;
  district?: string | null;
  street?: string | null;
  street_number?: string | null;
};

type DistrictBubble = {
  district: string;
  total: number | string;
  voters: number | string;
  leaders: number | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  resolved?: boolean;
};

type MapResponse = {
  features?: MapFeature[];
  approximateDistricts?: DistrictBubble[];
  stats?: {
    totalContacts: number;
    mappedContacts: number;
    approximatedContacts: number;
    unresolvedContacts: number;
    resolvedDistricts?: number;
  };
  error?: string;
};

const STYLE_ID = "vf-unified-map-layer-style";
const NUMBER = new Intl.NumberFormat("pt-BR");

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function isElectoralMap(map: any) {
  const container = map?.getContainer?.() as HTMLElement | undefined;
  if (!container?.isConnected || !container.closest(".workspace")) return false;

  const title = document
    .querySelector<HTMLElement>(".topbar .page-id h1")
    ?.textContent?.trim()
    .toLocaleLowerCase("pt-BR");

  return title === "mapa eleitoral" || Boolean(container.closest(".full-map"));
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-unified-control{background:rgba(255,255,255,.97);border:1px solid rgba(23,52,92,.12);border-radius:14px;box-shadow:0 10px 28px rgba(15,35,65,.16);padding:10px;min-width:230px;font:600 12px/1.3 Arial,sans-serif;color:#17345c;z-index:1000}
    .vf-unified-control strong{display:block;font-size:13px;margin-bottom:7px}.vf-unified-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.vf-unified-tabs button{border:1px solid #d8e1ec;border-radius:9px;background:#fff;color:#17345c;padding:7px 5px;font:700 11px/1 Arial,sans-serif;cursor:pointer}.vf-unified-tabs button.active{background:#17345c;color:#fff}.vf-unified-status{display:block;margin-top:8px;color:#64748b;font-size:11px}
    .vf-unified-bubble,.vf-unified-person,.vf-unified-cluster{background:transparent!important;border:0!important}.vf-unified-bubble span{display:grid;place-items:center;min-width:50px;height:50px;padding:0 7px;border-radius:999px;background:#315f8f;color:#fff;border:3px solid #fff;box-shadow:0 5px 16px rgba(15,35,65,.3);font:900 12px/1 Arial,sans-serif}.vf-unified-bubble.large span{min-width:58px;height:58px;background:#244f7c;font-size:13px}.vf-unified-cluster span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#17345c;color:#fff;border:3px solid #fff;box-shadow:0 4px 14px rgba(15,35,65,.28);font:800 12px/1 Arial,sans-serif}.vf-unified-pin{display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 10px rgba(15,35,65,.28)}.vf-unified-pin i{transform:rotate(45deg);font:900 12px/1 Arial,sans-serif;color:#fff;font-style:normal}.vf-unified-pin.voter{background:#239653}.vf-unified-pin.leader{background:#c62828}.vf-unified-popup{min-width:190px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-unified-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-unified-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2f8;color:#244f7c;font-size:10px;margin-bottom:5px}.vf-unified-popup p{margin:4px 0}.vf-unified-popup small{display:block;margin-top:7px;color:#64748b}
  `;
  document.head.appendChild(style);
}

export default function MapUnifiedLayer() {
  useLayoutEffect(() => {
    installStyles();

    let cancelled = false;
    let retryTimer: number | null = null;
    let headObserver: MutationObserver | null = null;
    let leafletScript: HTMLScriptElement | null = null;
    const cleanups = new Set<() => void>();

    const setupMap = (map: any) => {
      if (cancelled || !isElectoralMap(map) || map._vfUnifiedLayer) return;

      const L = (window as any).L;
      if (!L) return;

      map._vfUnifiedLayer = true;
      const container = map.getContainer?.() as HTMLElement | undefined;
      if (container) container.dataset.vfUnifiedLayer = "ready";

      const layer = L.layerGroup().addTo(map);
      let profile = "";
      let requestId = 0;
      let moveTimer: number | null = null;
      let lastScope = currentScope();

      const control = L.control({ position: "topright" });
      let statusNode: HTMLElement | null = null;
      control.onAdd = () => {
        const node = L.DomUtil.create("div", "vf-unified-control") as HTMLElement;
        node.innerHTML = `<strong>Contatos no mapa</strong><div class="vf-unified-tabs"><button type="button" data-profile="" class="active">Todos</button><button type="button" data-profile="Eleitor">Eleitores</button><button type="button" data-profile="Liderança">Lideranças</button></div><span class="vf-unified-status">Camada conectada · carregando…</span>`;
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        statusNode = node.querySelector(".vf-unified-status");
        node.querySelectorAll<HTMLButtonElement>("[data-profile]").forEach((button) => {
          button.addEventListener("click", () => {
            profile = button.dataset.profile || "";
            node
              .querySelectorAll<HTMLButtonElement>("button")
              .forEach((item) => item.classList.toggle("active", item === button));
            void refresh();
          });
        });
        return node;
      };
      control.addTo(map);

      const removeLegacyPins = () => {
        const removals: any[] = [];
        map.eachLayer?.((item: any) => {
          const className = String(item?.options?.icon?.options?.className || "");
          if (
            className.includes("contact-pin") ||
            className.includes("vf-map-district-cluster") ||
            className.includes("vf-stable-district-bubble")
          ) {
            removals.push(item);
          }
        });
        removals.forEach((item) => map.removeLayer(item));
      };

      const refresh = async () => {
        if (cancelled || !map._container) return;

        const id = ++requestId;
        const bounds = map.getBounds();
        const scope = currentScope();
        lastScope = scope;
        const params = new URLSearchParams({
          stats: "1",
          south: String(bounds.getSouth()),
          west: String(bounds.getWest()),
          north: String(bounds.getNorth()),
          east: String(bounds.getEast()),
          zoom: String(map.getZoom()),
        });
        if (scope) params.set("owner", scope);
        if (profile) params.set("profile", profile);
        if (statusNode) statusNode.textContent = "Atualizando bolhas e pinos…";

        try {
          const response = await apiFetch(`/api/map-contacts?${params.toString()}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as MapResponse;
          if (!response.ok) throw new Error(payload.error || "Falha ao carregar mapa");
          if (cancelled || id !== requestId || !map._container) return;

          removeLegacyPins();
          layer.clearLayers();

          let bubbleCount = 0;
          for (const bubble of payload.approximateDistricts || []) {
            if (!bubble.resolved) continue;
            const lat = Number(bubble.latitude);
            const lon = Number(bubble.longitude);
            const total = Number(bubble.total || 0);
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || total <= 0) continue;

            const marker = L.marker([lat, lon], {
              zIndexOffset: 500,
              icon: L.divIcon({
                className: `vf-unified-bubble${total >= 3000 ? " large" : ""}`,
                html: `<span>${NUMBER.format(total)}</span>`,
                iconSize: [60, 60],
                iconAnchor: [30, 30],
              }),
            });
            marker.bindTooltip(
              `${bubble.district} · ${NUMBER.format(total)} cadastro(s)`,
              { direction: "top" },
            );
            marker.bindPopup(
              `<div class="vf-unified-popup"><strong>${escapeHtml(bubble.district)}</strong><b>Total do bairro</b><p>${NUMBER.format(Number(bubble.voters || 0))} eleitor(es) · ${NUMBER.format(Number(bubble.leaders || 0))} liderança(s)</p><small>Posição territorial de referência. Quem tem coordenada exata também aparece como pino individual.</small></div>`,
              { maxWidth: 290 },
            );
            marker.addTo(layer);
            bubbleCount += 1;
          }

          let exactFeatureCount = 0;
          for (const feature of payload.features || []) {
            const lat = Number(feature.latitude);
            const lon = Number(feature.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

            const total = Number(feature.total || 0);
            exactFeatureCount += Math.max(1, total);
            if (feature.feature_type === "cluster" || total > 1) {
              const marker = L.marker([lat, lon], {
                zIndexOffset: 800,
                icon: L.divIcon({
                  className: "vf-unified-cluster",
                  html: `<span>${NUMBER.format(Math.max(2, total))}</span>`,
                  iconSize: [42, 42],
                  iconAnchor: [21, 21],
                }),
              });
              marker.bindTooltip(
                `${NUMBER.format(Number(feature.voters || 0))} eleitor(es) · ${NUMBER.format(Number(feature.leaders || 0))} liderança(s)`,
                { direction: "top" },
              );
              marker.addTo(layer);
              continue;
            }

            const isLeader =
              String(feature.profile || "").toLocaleLowerCase("pt-BR") ===
              "liderança";
            const marker = L.marker([lat, lon], {
              zIndexOffset: 900,
              icon: L.divIcon({
                className: "vf-unified-person",
                html: `<span class="vf-unified-pin ${isLeader ? "leader" : "voter"}"><i>${isLeader ? "L" : "•"}</i></span>`,
                iconSize: [32, 36],
                iconAnchor: [15, 32],
                popupAnchor: [0, -30],
              }),
            });
            const address = [feature.street, feature.street_number]
              .filter(Boolean)
              .join(", ");
            marker.bindPopup(
              `<div class="vf-unified-popup"><strong>${escapeHtml(feature.contact_name || "Contato")}</strong><b>${escapeHtml(feature.profile || "Eleitor")}</b>${feature.district ? `<p>${escapeHtml(feature.district)}</p>` : ""}${address ? `<p>${escapeHtml(address)}</p>` : ""}</div>`,
              { maxWidth: 260 },
            );
            marker.addTo(layer);
          }

          map._vfUnifiedBubbleCount = bubbleCount;
          map._vfUnifiedExactFeatureCount = exactFeatureCount;

          if (statusNode) {
            statusNode.textContent = `${bubbleCount} bairro(s) · ${NUMBER.format(payload.stats?.mappedContacts ?? exactFeatureCount)} pino(s) exato(s)`;
          }
          const message = document.querySelector<HTMLElement>(
            ".real-map-toolbar strong",
          );
          if (message) {
            message.textContent = `${bubbleCount} bairro(s) com bolhas no mapa`;
          }
        } catch (error) {
          console.error("Failed to load unified map layer", error);
          if (statusNode) statusNode.textContent = "Erro ao carregar bolhas/pinos";
        }
      };

      const scheduleRefresh = () => {
        if (moveTimer !== null) window.clearTimeout(moveTimer);
        moveTimer = window.setTimeout(() => {
          moveTimer = null;
          void refresh();
        }, 180);
      };

      const handleScopeChange = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.matches(".scope-picker select")) return;
        if (currentScope() !== lastScope) void refresh();
      };
      const handleRecordsChanged = () => void refresh();

      map.on("moveend zoomend", scheduleRefresh);
      document.addEventListener("change", handleScopeChange, true);
      window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);

      window.setTimeout(() => {
        removeLegacyPins();
        void refresh();
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
          // O mapa pode ter sido desmontado durante a navegação.
        }
        cleanups.delete(cleanup);
      };
      cleanups.add(cleanup);
      map.on?.("unload", cleanup);
    };

    const setupDispatcher = (map: any) => {
      window.setTimeout(() => setupMap(map), 0);
    };

    const installNativeHook = () => {
      const L = (window as any).L;
      if (!L?.Map?.addInitHook) return false;

      (window as any).__vfUnifiedMapSetup = setupDispatcher;

      if (!L.Map.prototype.__vfUnifiedInitHookInstalled) {
        L.Map.prototype.__vfUnifiedInitHookInstalled = true;
        L.Map.addInitHook(function (this: any) {
          const dispatcher = (window as any).__vfUnifiedMapSetup;
          if (typeof dispatcher === "function") dispatcher(this);
        });
      }

      return true;
    };

    const handleLeafletLoad = () => {
      installNativeHook();
    };

    const attachLeafletScript = () => {
      const script = document.querySelector<HTMLScriptElement>("script[data-vf-leaflet]");
      if (script && script !== leafletScript) {
        leafletScript?.removeEventListener("load", handleLeafletLoad);
        leafletScript = script;
        leafletScript.addEventListener("load", handleLeafletLoad);
      }
      installNativeHook();
    };

    attachLeafletScript();
    headObserver = new MutationObserver(attachLeafletScript);
    headObserver.observe(document.head, { childList: true, subtree: true });

    if (!installNativeHook()) {
      retryTimer = window.setInterval(() => {
        if (installNativeHook() && retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 50);
    }

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
      headObserver?.disconnect();
      leafletScript?.removeEventListener("load", handleLeafletLoad);
      if (retryTimer !== null) window.clearInterval(retryTimer);
      if ((window as any).__vfUnifiedMapSetup === setupDispatcher) {
        delete (window as any).__vfUnifiedMapSetup;
      }
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
