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

type MapPayload = {
  features?: MapFeature[];
  approximateDistricts?: DistrictBubble[];
  stats?: { mappedContacts?: number };
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
    .vf-direct-map{position:absolute;inset:0 0 auto 0;z-index:20;background:#e8eef4;overflow:hidden;border-radius:inherit}
    .vf-direct-control{background:rgba(255,255,255,.98);border:2px solid #17345c;border-radius:14px;box-shadow:0 10px 28px rgba(15,35,65,.22);padding:10px;min-width:220px;font:600 12px/1.35 Arial,sans-serif;color:#17345c}
    .vf-direct-control strong{display:block;font-size:13px;margin-bottom:5px}.vf-direct-control span{display:block;color:#64748b;font-size:11px}
    .vf-direct-bubble,.vf-direct-person,.vf-direct-cluster{background:transparent!important;border:0!important}
    .vf-direct-bubble span{display:grid;place-items:center;min-width:50px;height:50px;padding:0 7px;border-radius:999px;background:#315f8f;color:#fff;border:3px solid #fff;box-shadow:0 5px 16px rgba(15,35,65,.3);font:900 12px/1 Arial,sans-serif}
    .vf-direct-bubble.large span{min-width:58px;height:58px;background:#244f7c;font-size:13px}
    .vf-direct-cluster span{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#17345c;color:#fff;border:3px solid #fff;box-shadow:0 4px 14px rgba(15,35,65,.28);font:900 12px/1 Arial,sans-serif}
    .vf-direct-pin{display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 10px rgba(15,35,65,.28)}
    .vf-direct-pin i{transform:rotate(45deg);font:900 12px/1 Arial,sans-serif;color:#fff;font-style:normal}.vf-direct-pin.voter{background:#239653}.vf-direct-pin.leader{background:#c62828}
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
    let activeCleanup: (() => void) | null = null;

    const destroy = () => {
      activeCleanup?.();
      activeCleanup = null;
      activeBase = null;
    };

    const mount = async (base: HTMLElement) => {
      if (busy || stopped || activeBase) return;
      busy = true;
      try {
        const L = await ensureLeaflet();
        if (stopped || !base.isConnected) return;

        const host = base.parentElement as HTMLElement | null;
        if (!host) return;
        const oldHostPosition = host.style.position;
        const oldBaseVisibility = base.style.visibility;
        if (getComputedStyle(host).position === "static") host.style.position = "relative";

        const overlay = document.createElement("div");
        overlay.className = "vf-direct-map";
        overlay.dataset.vfDirectMap = "true";
        const resize = () => {
          const height = Math.max(320, Math.round(base.getBoundingClientRect().height));
          overlay.style.height = `${height}px`;
        };
        resize();
        host.appendChild(overlay);

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
        const layer = L.layerGroup().addTo(map);

        let requestId = 0;
        let moveTimer: number | null = null;
        let lastScope = scopeValue();
        let status: HTMLElement | null = null;

        const control = L.control({ position: "topright" });
        control.onAdd = () => {
          const node = L.DomUtil.create("div", "vf-direct-control") as HTMLElement;
          node.innerHTML = `<strong>Contatos no mapa</strong><span>Conectado · carregando bolhas…</span>`;
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
          if (status) status.textContent = "Carregando bolhas e pinos…";

          try {
            const response = await apiFetch(`/api/map-contacts?${params.toString()}`, { cache: "no-store" });
            const payload = (await response.json()) as MapPayload;
            if (!response.ok) throw new Error(payload.error || "Falha na API do mapa");
            if (stopped || id !== requestId || !overlay.isConnected) return;

            layer.clearLayers();
            let bubbles = 0;
            for (const item of payload.approximateDistricts || []) {
              if (!item.resolved) continue;
              const latitude = Number(item.latitude);
              const longitude = Number(item.longitude);
              const total = Number(item.total || 0);
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || total <= 0) continue;
              L.marker([latitude, longitude], {
                zIndexOffset: 500,
                icon: L.divIcon({
                  className: `vf-direct-bubble${total >= 3000 ? " large" : ""}`,
                  html: `<span>${NUMBER.format(total)}</span>`,
                  iconSize: [60, 60],
                  iconAnchor: [30, 30],
                }),
              })
                .bindTooltip(`${item.district} · ${NUMBER.format(total)} cadastro(s)`, { direction: "top" })
                .bindPopup(`<div class="vf-direct-popup"><strong>${escapeHtml(item.district)}</strong><b>Total do bairro</b><p>${NUMBER.format(Number(item.voters || 0))} eleitor(es) · ${NUMBER.format(Number(item.leaders || 0))} liderança(s)</p><small>Posição territorial de referência.</small></div>`, { maxWidth: 290 })
                .addTo(layer);
              bubbles += 1;
            }

            let exact = 0;
            for (const feature of payload.features || []) {
              const latitude = Number(feature.latitude);
              const longitude = Number(feature.longitude);
              const total = Number(feature.total || 0);
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
              exact += Math.max(1, total);

              if (feature.feature_type === "cluster" || total > 1) {
                L.marker([latitude, longitude], {
                  zIndexOffset: 800,
                  icon: L.divIcon({ className: "vf-direct-cluster", html: `<span>${NUMBER.format(Math.max(2, total))}</span>`, iconSize: [42, 42], iconAnchor: [21, 21] }),
                }).addTo(layer);
                continue;
              }

              const leader = String(feature.profile || "").toLocaleLowerCase("pt-BR") === "liderança";
              const address = [feature.street, feature.street_number].filter(Boolean).join(", ");
              L.marker([latitude, longitude], {
                zIndexOffset: 900,
                icon: L.divIcon({
                  className: "vf-direct-person",
                  html: `<span class="vf-direct-pin ${leader ? "leader" : "voter"}"><i>${leader ? "L" : "•"}</i></span>`,
                  iconSize: [32, 36],
                  iconAnchor: [15, 32],
                  popupAnchor: [0, -30],
                }),
              })
                .bindPopup(`<div class="vf-direct-popup"><strong>${escapeHtml(feature.contact_name || "Contato")}</strong><b>${escapeHtml(feature.profile || "Eleitor")}</b>${feature.district ? `<p>${escapeHtml(feature.district)}</p>` : ""}${address ? `<p>${escapeHtml(address)}</p>` : ""}</div>`, { maxWidth: 260 })
                .addTo(layer);
            }

            if (status) status.textContent = `${bubbles} bairro(s) · ${NUMBER.format(payload.stats?.mappedContacts ?? exact)} pino(s) exato(s)`;
            const toolbar = host.querySelector<HTMLElement>(".real-map-toolbar strong");
            if (toolbar) toolbar.textContent = `${bubbles} bairro(s) com bolhas no mapa`;
          } catch (error) {
            console.error("Direct electoral map failed", error);
            if (status) status.textContent = "Erro ao carregar bolhas/pinos";
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
          if (target?.matches(".scope-picker select") && scopeValue() !== lastScope) void refresh();
        };
        const recordsChanged = () => void refresh();

        map.on("moveend zoomend", scheduleRefresh);
        document.addEventListener("change", scopeChanged, true);
        window.addEventListener("voto-forte:records-changed", recordsChanged);
        window.addEventListener("voto-forte:geocoding-complete", recordsChanged);

        const resizeObserver = new ResizeObserver(() => {
          resize();
          window.setTimeout(() => map.invalidateSize(false), 0);
        });
        resizeObserver.observe(base);

        base.style.visibility = "hidden";
        activeBase = base;
        activeCleanup = () => {
          requestId += 1;
          if (moveTimer !== null) window.clearTimeout(moveTimer);
          map.off("moveend zoomend", scheduleRefresh);
          document.removeEventListener("change", scopeChanged, true);
          window.removeEventListener("voto-forte:records-changed", recordsChanged);
          window.removeEventListener("voto-forte:geocoding-complete", recordsChanged);
          resizeObserver.disconnect();
          try { map.remove(); } catch {}
          overlay.remove();
          base.style.visibility = oldBaseVisibility;
          host.style.position = oldHostPosition;
        };

        window.setTimeout(() => {
          resize();
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
      const base = document.querySelector<HTMLElement>(".workspace .full-map .city-map .leaflet-map");
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
