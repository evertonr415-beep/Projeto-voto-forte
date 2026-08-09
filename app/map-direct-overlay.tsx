"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type MapFeature = {
  feature_type: "point";
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

type MapPayload = {
  features?: MapFeature[];
  approximateDistricts?: DistrictBubble[];
  stats?: { mappedContacts?: number; resolvedDistricts?: number };
  error?: string;
};

const NUMBER = new Intl.NumberFormat("pt-BR");
const STYLE_ID = "vf-direct-map-style";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function scopeValue() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .workspace .full-map{position:relative;overflow:hidden}
    .workspace .full-map .real-map-toolbar,.workspace .full-map>.map-legend{display:none!important}
    .vf-direct-map{position:absolute;inset:0;z-index:20;background:#e8eef4;overflow:hidden;border-radius:inherit}
    .vf-direct-map .leaflet-control-zoom{margin-top:14px;margin-left:14px}
    .vf-direct-control{background:rgba(255,255,255,.97);border:1px solid rgba(23,52,92,.18);border-radius:12px;box-shadow:0 8px 24px rgba(15,35,65,.16);padding:9px 11px;min-width:190px;font:600 12px/1.35 Arial,sans-serif;color:#17345c}
    .vf-direct-control strong{display:block;font-size:13px;margin-bottom:3px}.vf-direct-control span{display:block;color:#64748b;font-size:11px}.vf-direct-legend{display:flex;gap:10px;margin-top:6px;font-size:10px;color:#42566f}.vf-direct-legend i{font-style:normal;font-weight:900}.vf-direct-legend .v{color:#239653}.vf-direct-legend .l{color:#c62828}.vf-direct-legend .b{color:#315f8f}
    .vf-direct-bubble,.vf-direct-person{background:transparent!important;border:0!important}
    .vf-direct-bubble span{display:grid;place-items:center;min-width:48px;height:48px;padding:0 7px;border-radius:999px;background:#315f8f;color:#fff;border:3px solid #fff;box-shadow:0 5px 16px rgba(15,35,65,.28);font:900 12px/1 Arial,sans-serif}
    .vf-direct-bubble.large span{min-width:56px;height:56px;background:#244f7c;font-size:13px}
    .vf-direct-pin{display:grid;place-items:center;width:32px;height:32px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 13px rgba(15,35,65,.32)}
    .vf-direct-pin i{transform:rotate(45deg);font:900 13px/1 Arial,sans-serif;color:#fff;font-style:normal}.vf-direct-pin.voter{background:#239653}.vf-direct-pin.leader{background:#c62828}
    .vf-direct-popup{min-width:190px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-direct-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-direct-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2f8;color:#244f7c;font-size:10px;margin-bottom:5px}.vf-direct-popup p{margin:4px 0}.vf-direct-popup small{display:block;margin-top:7px;color:#64748b}
  `;
  document.head.appendChild(style);
}

async function ensureLeaflet() {
  if ((window as any).L?.map) return (window as any).L;

  if (!document.querySelector("link[data-vf-leaflet]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.dataset.vfLeaflet = "true";
    document.head.appendChild(link);
  }

  if (!document.querySelector("script[data-vf-leaflet]")) {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.dataset.vfLeaflet = "true";
    document.head.appendChild(script);
  }

  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if ((window as any).L?.map) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 15_000) {
        window.clearInterval(timer);
        reject(new Error("Leaflet indisponível"));
      }
    }, 50);
  });

  return (window as any).L;
}

export default function MapDirectOverlay() {
  useLayoutEffect(() => {
    installStyles();
    let stopped = false;
    let busy = false;
    let activeBase: HTMLElement | null = null;
    let cleanupActive: (() => void) | null = null;

    const destroy = () => {
      cleanupActive?.();
      cleanupActive = null;
      activeBase = null;
    };

    const mount = async (base: HTMLElement) => {
      if (busy || stopped || activeBase) return;
      busy = true;
      try {
        const L = await ensureLeaflet();
        if (stopped || !base.isConnected) return;

        const fullMap = base.closest<HTMLElement>(".full-map");
        if (!fullMap) return;
        const oldBaseVisibility = base.style.visibility;

        const overlay = document.createElement("div");
        overlay.className = "vf-direct-map";
        overlay.dataset.vfDirectMap = "true";
        fullMap.appendChild(overlay);

        const map = L.map(overlay, {
          zoomControl: true,
          attributionControl: true,
          minZoom: 11,
          closePopupOnClick: true,
        }).setView([-23.4153, -51.4256], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        const bubbleLayer = L.layerGroup().addTo(map);
        const pinLayer = L.layerGroup().addTo(map);
        let requestId = 0;
        let moveTimer: number | null = null;
        let lastScope = scopeValue();
        let status: HTMLElement | null = null;

        const control = L.control({ position: "topright" });
        control.onAdd = () => {
          const node = L.DomUtil.create("div", "vf-direct-control") as HTMLElement;
          node.innerHTML = `<strong>Mapa de contatos</strong><span>Carregando…</span><div class="vf-direct-legend"><i class="b">● bairro</i><i class="v">● eleitor</i><i class="l">L liderança</i></div>`;
          status = node.querySelector("span");
          L.DomEvent.disableClickPropagation(node);
          L.DomEvent.disableScrollPropagation(node);
          return node;
        };
        control.addTo(map);

        const refresh = async () => {
          if (stopped || !overlay.isConnected) return;
          const id = ++requestId;
          const bounds = map.getBounds();
          const scope = scopeValue();
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
          if (status) status.textContent = "Atualizando…";

          try {
            const response = await apiFetch(`/api/map-contacts?${params.toString()}`, {
              cache: "no-store",
            });
            const payload = (await response.json()) as MapPayload;
            if (!response.ok) throw new Error(payload.error || "Falha na API do mapa");
            if (stopped || id !== requestId || !overlay.isConnected) return;

            bubbleLayer.clearLayers();
            pinLayer.clearLayers();

            let bubbleCount = 0;
            for (const item of payload.approximateDistricts || []) {
              if (!item.resolved) continue;
              const latitude = Number(item.latitude);
              const longitude = Number(item.longitude);
              const total = Number(item.total || 0);
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || total <= 0)
                continue;

              L.marker([latitude, longitude], {
                zIndexOffset: 200,
                icon: L.divIcon({
                  className: `vf-direct-bubble${total >= 3000 ? " large" : ""}`,
                  html: `<span>${NUMBER.format(total)}</span>`,
                  iconSize: [60, 60],
                  iconAnchor: [30, 30],
                }),
              })
                .bindTooltip(`${item.district} · ${NUMBER.format(total)} cadastro(s)`, {
                  direction: "top",
                })
                .bindPopup(
                  `<div class="vf-direct-popup"><strong>${escapeHtml(item.district)}</strong><b>Total do bairro</b><p>${NUMBER.format(Number(item.voters || 0))} eleitor(es) · ${NUMBER.format(Number(item.leaders || 0))} liderança(s)</p><small>Posição territorial aproximada do bairro.</small></div>`,
                  { maxWidth: 290 },
                )
                .addTo(bubbleLayer);
              bubbleCount += 1;
            }

            let voterPins = 0;
            let leaderPins = 0;
            const duplicateIndex = new Map<string, number>();
            for (const feature of payload.features || []) {
              const latitude = Number(feature.latitude);
              const longitude = Number(feature.longitude);
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

              const leader = feature.profile === "Liderança";
              if (leader) leaderPins += 1;
              else voterPins += 1;

              const key = `${latitude.toFixed(7)},${longitude.toFixed(7)}`;
              const duplicate = duplicateIndex.get(key) || 0;
              duplicateIndex.set(key, duplicate + 1);
              const visualLongitude = longitude + duplicate * 0.000045;

              const address = [feature.street, feature.street_number]
                .filter(Boolean)
                .join(", ");
              L.marker([latitude, visualLongitude], {
                zIndexOffset: leader ? 1200 : 1100,
                icon: L.divIcon({
                  className: "vf-direct-person",
                  html: `<span class="vf-direct-pin ${leader ? "leader" : "voter"}"><i>${leader ? "L" : "•"}</i></span>`,
                  iconSize: [36, 40],
                  iconAnchor: [18, 36],
                  popupAnchor: [0, -34],
                }),
              })
                .bindTooltip(
                  `${leader ? "Liderança" : "Eleitor"}: ${feature.contact_name || "Contato"}`,
                  { direction: "top" },
                )
                .bindPopup(
                  `<div class="vf-direct-popup"><strong>${escapeHtml(feature.contact_name || "Contato")}</strong><b>${leader ? "Liderança" : "Eleitor"}</b>${feature.district ? `<p>${escapeHtml(feature.district)}</p>` : ""}${address ? `<p>${escapeHtml(address)}</p>` : ""}</div>`,
                  { maxWidth: 260 },
                )
                .addTo(pinLayer);
            }

            if (status) {
              status.textContent = `${bubbleCount} bairros · ${voterPins} eleitor(es) · ${leaderPins} liderança(s)`;
            }
          } catch (error) {
            console.error("Direct electoral map failed", error);
            if (status) status.textContent = "Erro ao carregar dados do mapa";
          }
        };

        const scheduleRefresh = () => {
          if (moveTimer !== null) window.clearTimeout(moveTimer);
          moveTimer = window.setTimeout(() => {
            moveTimer = null;
            void refresh();
          }, 180);
        };
        const scopeChanged = (event: Event) => {
          const target = event.target as HTMLElement | null;
          if (target?.matches(".scope-picker select") && scopeValue() !== lastScope)
            void refresh();
        };

        map.on("moveend zoomend", scheduleRefresh);
        document.addEventListener("change", scopeChanged, true);
        base.style.visibility = "hidden";
        activeBase = base;

        cleanupActive = () => {
          requestId += 1;
          if (moveTimer !== null) window.clearTimeout(moveTimer);
          map.off("moveend zoomend", scheduleRefresh);
          document.removeEventListener("change", scopeChanged, true);
          try {
            map.remove();
          } catch {
            // O contêiner pode ter sido desmontado durante a navegação.
          }
          overlay.remove();
          base.style.visibility = oldBaseVisibility;
        };

        window.setTimeout(() => {
          map.invalidateSize(false);
          void refresh();
        }, 0);
      } catch (error) {
        console.error("Could not mount direct electoral map", error);
      } finally {
        busy = false;
      }
    };

    const sync = () => {
      if (stopped) return;
      const base = document.querySelector<HTMLElement>(
        ".workspace .full-map .city-map .leaflet-map",
      );
      if (activeBase && (!base || base !== activeBase || !activeBase.isConnected)) destroy();
      if (base && !activeBase && !busy) void mount(base);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      stopped = true;
      observer.disconnect();
      destroy();
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
