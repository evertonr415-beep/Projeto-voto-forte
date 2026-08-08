"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictBubble = {
  district: string;
  total: number | string;
  voters: number | string;
  leaders: number | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  source?: string | null;
  reference_cep?: string | null;
  resolved?: boolean;
};

const STYLE_ID = "vf-stable-district-bubbles-style";
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

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-stable-district-bubble{background:transparent!important;border:0!important}
    .vf-stable-district-bubble span{display:grid;place-items:center;min-width:50px;height:50px;padding:0 7px;border-radius:999px;background:#315f8f;color:#fff;border:3px solid #fff;box-shadow:0 5px 16px rgba(15,35,65,.3);font:900 12px/1 Arial,sans-serif}
    .vf-stable-district-bubble.large span{min-width:58px;height:58px;background:#244f7c;font-size:13px}
    .vf-stable-district-popup{min-width:190px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}
    .vf-stable-district-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}
    .vf-stable-district-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2f8;color:#244f7c;font-size:10px;margin-bottom:5px}
    .vf-stable-district-popup p{margin:4px 0}.vf-stable-district-popup small{display:block;margin-top:7px;color:#64748b}
  `;
  document.head.appendChild(style);
}

export default function MapTerritoryEnhancer() {
  useLayoutEffect(() => {
    installStyles();

    let cancelled = false;
    let originalMapFactory: any = null;
    let patchTimer: number | null = null;
    let patchTimeout: number | null = null;
    const cleanups = new Set<() => void>();

    const setupMap = (map: any) => {
      const container = map?.getContainer?.() as HTMLElement | undefined;
      if (
        cancelled ||
        !container?.closest(".full-map") ||
        map._vfStableDistrictBubbles
      )
        return;

      map._vfStableDistrictBubbles = true;
      const L = (window as any).L;
      if (!L) return;

      const layer = L.layerGroup().addTo(map);
      let requestId = 0;
      let lastScope = currentScope();

      const draw = async () => {
        const id = ++requestId;
        const scope = currentScope();
        lastScope = scope;
        const params = new URLSearchParams({ stats: "1" });
        if (scope) params.set("owner", scope);

        try {
          const response = await apiFetch(`/api/map-contacts?${params.toString()}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as {
            approximateDistricts?: DistrictBubble[];
            error?: string;
          };
          if (!response.ok) throw new Error(payload.error || "Falha ao carregar bairros");
          if (cancelled || id !== requestId || !map._container) return;

          layer.clearLayers();
          const bubbles = Array.isArray(payload.approximateDistricts)
            ? payload.approximateDistricts
            : [];

          for (const bubble of bubbles) {
            if (!bubble.resolved) continue;
            const latitude = Number(bubble.latitude);
            const longitude = Number(bubble.longitude);
            const total = Number(bubble.total || 0);
            if (
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              total <= 0
            )
              continue;

            const marker = L.marker([latitude, longitude], {
              zIndexOffset: 700,
              icon: L.divIcon({
                className: `vf-stable-district-bubble${total >= 3000 ? " large" : ""}`,
                html: `<span>${NUMBER.format(total)}</span>`,
                iconSize: [60, 60],
                iconAnchor: [30, 30],
              }),
            });

            marker.bindTooltip(
              `${bubble.district} · ${NUMBER.format(total)} cadastro(s)`,
              { direction: "top", opacity: 0.95 },
            );
            marker.bindPopup(
              `<div class="vf-stable-district-popup"><strong>${escapeHtml(bubble.district)}</strong><b>Total do bairro</b><p>${NUMBER.format(Number(bubble.voters || 0))} eleitor(es) · ${NUMBER.format(Number(bubble.leaders || 0))} liderança(s)</p><small>Posição de referência obtida por CEP do próprio bairro. Contatos com coordenada exata continuam aparecendo também como pino individual.</small></div>`,
              { maxWidth: 290 },
            );
            marker.addTo(layer);
          }

          map._vfStableDistrictBubbleCount = layer.getLayers?.().length || 0;
          const message = document.querySelector<HTMLElement>(
            ".real-map-toolbar strong",
          );
          if (message && map._vfStableDistrictBubbleCount > 0) {
            message.textContent = `${map._vfStableDistrictBubbleCount} bairro(s) com bolhas no mapa`;
          }
        } catch {
          const message = document.querySelector<HTMLElement>(
            ".real-map-toolbar strong",
          );
          if (message)
            message.textContent = "Mapa ativo · não foi possível carregar as bolhas agora";
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

      window.setTimeout(() => void draw(), 0);

      const cleanup = () => {
        requestId += 1;
        document.removeEventListener("change", handleScopeChange, true);
        window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
        window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
        try {
          map.removeLayer(layer);
        } catch {
          // O mapa pode ter sido destruído durante a navegação.
        }
        cleanups.delete(cleanup);
      };
      cleanups.add(cleanup);
      map.on?.("unload", cleanup);
    };

    const patchLeaflet = () => {
      const L = (window as any).L;
      if (!L?.map || L.map.__vfStableDistrictBubblesPatched) return false;

      originalMapFactory = L.map;
      const wrappedMap = function (this: unknown, ...args: any[]) {
        const map = originalMapFactory.apply(this, args);
        window.setTimeout(() => setupMap(map), 0);
        return map;
      };
      Object.assign(wrappedMap, originalMapFactory);
      wrappedMap.__vfStableDistrictBubblesPatched = true;
      L.map = wrappedMap;
      return true;
    };

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
      }, 10_000);
    }

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
      if (patchTimer !== null) window.clearInterval(patchTimer);
      if (patchTimeout !== null) window.clearTimeout(patchTimeout);
      const L = (window as any).L;
      if (L?.map?.__vfStableDistrictBubblesPatched && originalMapFactory)
        L.map = originalMapFactory;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
