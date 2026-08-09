"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictSummaryItem = {
  district?: string;
  total?: number | string;
};

type DistrictCenter = {
  district?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type DistrictItem = {
  district: string;
  total: number;
  key: string;
};

type CenterPoint = { latitude: number; longitude: number };

type DistrictMarkerVisual = {
  marker: any;
  item: DistrictItem;
  center: CenterPoint;
};

const STYLE_ID = "vf-district-points-style";
const NUMBER = new Intl.NumberFormat("pt-BR");

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function visibilityForZoom(zoom: number) {
  if (zoom <= 12) return { limit: 12, minDistance: 70, detail: "visão geral" };
  if (zoom === 13) return { limit: 24, minDistance: 54, detail: "principais bairros" };
  if (zoom === 14) return { limit: 55, minDistance: 40, detail: "mais bairros" };
  return { limit: Number.POSITIVE_INFINITY, minDistance: 28, detail: "todos os bairros" };
}

function markerIconHtml(item: DistrictItem) {
  return `
    <div class="vf-district-point-wrap" aria-label="${escapeHtml(item.district)}: ${NUMBER.format(item.total)} contatos">
      <span class="vf-district-point-count">${NUMBER.format(item.total)}</span>
      <span class="vf-district-point-dot" aria-hidden="true"></span>
    </div>
  `;
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-district-map-control{background:rgba(255,255,255,.97);border:1px solid rgba(23,52,92,.13);border-radius:14px;box-shadow:0 9px 24px rgba(15,35,65,.16);width:260px;max-height:310px;overflow:hidden;font:600 11px/1.3 Arial,sans-serif;color:#17345c;backdrop-filter:blur(6px)}
    .vf-district-map-control header{padding:10px 11px 8px;border-bottom:1px solid #e4ebf3}.vf-district-map-control header strong{display:block;font-size:13px}.vf-district-map-control header small{display:block;margin-top:3px;color:#64748b;font-weight:600}
    .vf-district-map-list{max-height:245px;overflow:auto;padding:5px}.vf-district-map-row{width:100%;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:0;border-radius:9px;background:transparent;color:#27405f;text-align:left;padding:7px 8px;cursor:pointer;font:700 11px/1.2 Arial,sans-serif}.vf-district-map-row:hover:not(:disabled){background:#edf4fb}.vf-district-map-row:disabled{cursor:default;opacity:.62}.vf-district-map-row b{font-size:12px;color:#17345c}.vf-district-map-row small{display:block;margin-top:2px;color:#7a899c;font-size:9px;font-weight:600}.vf-district-map-empty{padding:12px;color:#64748b;font-weight:600}
    .vf-district-map-scale{display:flex;align-items:center;gap:6px;padding:7px 10px;border-top:1px solid #e4ebf3;color:#64748b;font-size:9px}.vf-district-map-scale .vf-district-point-legend{width:9px;height:9px;border-radius:50%;background:#2563a8;border:2px solid #fff;box-shadow:0 0 0 1px rgba(24,74,124,.24)}.vf-district-map-scale em{margin-left:auto;font-style:normal;color:#8491a2}
    .vf-district-point-icon{background:transparent!important;border:0!important;overflow:visible!important}
    .vf-district-point-wrap{position:relative;width:34px;height:38px;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 2px 3px rgba(10,40,75,.2));transition:transform .15s ease}
    .vf-district-point-icon:hover .vf-district-point-wrap{transform:translateY(-2px) scale(1.04)}
    .vf-district-point-count{position:absolute;left:50%;bottom:17px;transform:translateX(-50%);min-width:28px;padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.98);border:1px solid rgba(31,82,133,.22);box-shadow:0 3px 8px rgba(15,35,65,.16);color:#174a79;font:800 10px/1 Arial,sans-serif;text-align:center;white-space:nowrap;letter-spacing:-.1px}
    .vf-district-point-dot{display:block;width:13px;height:13px;border-radius:50%;background:#2563a8;border:3px solid #fff;box-shadow:0 0 0 1px rgba(24,74,124,.3),0 2px 6px rgba(22,66,108,.24)}
    .vf-district-point-icon.vf-district-point-selected .vf-district-point-dot{box-shadow:0 0 0 5px rgba(37,99,168,.18),0 0 0 1px rgba(24,74,124,.42),0 3px 8px rgba(22,66,108,.3)}
    .vf-district-point-icon.vf-district-point-selected .vf-district-point-count{border-color:rgba(37,99,168,.55);box-shadow:0 3px 10px rgba(37,99,168,.24)}
    .vf-district-area-popup{min-width:195px;font:500 12px/1.4 Arial,sans-serif;color:#26384d}.vf-district-area-popup strong{display:block;color:#17345c;font-size:14px;margin-bottom:5px}.vf-district-area-popup b{display:inline-block;padding:3px 7px;border-radius:999px;background:#eaf2fb;color:#285b8e;font-size:10px}.vf-district-area-popup p{margin:6px 0 0}.vf-district-area-popup small{display:block;margin-top:7px;color:#64748b}
    @media(max-width:760px){.vf-district-map-control{width:210px;max-height:240px}.vf-district-map-list{max-height:175px}.vf-district-map-row{padding:6px}.vf-district-map-control header{padding:8px}.vf-district-map-scale em{display:none}.vf-district-point-count{font-size:9px;padding:3px 5px}.vf-district-point-dot{width:12px;height:12px}}
  `;
  document.head.appendChild(style);
}

export default function MapTerritoryEnhancer() {
  useLayoutEffect(() => {
    installStyles();
    let cancelled = false;
    let retryTimer: number | null = null;
    let retryTimeout: number | null = null;
    let cleanupActiveMap: (() => void) | null = null;

    const setupMap = (map: any) => {
      const container = map?.getContainer?.() as HTMLElement | undefined;
      if (cancelled || !container?.closest(".full-map") || map._vfDistrictPoints)
        return false;

      const L = (window as any).L;
      if (!L) return false;
      map._vfDistrictPoints = true;

      if (!map.getPane?.("vfDistrictPointsPane")) {
        const pane = map.createPane?.("vfDistrictPointsPane");
        if (pane) {
          pane.style.zIndex = "340";
          pane.style.pointerEvents = "auto";
        }
      }

      const pointLayer = L.layerGroup().addTo(map);
      const districtCenters = new Map<string, CenterPoint>();
      const districtMarkers = new Map<string, DistrictMarkerVisual>();
      let requestId = 0;
      let lastScope = currentScope();
      let rankingItems: DistrictItem[] = [];
      let mappedKeys = new Set<string>();
      let visibleKeys = new Set<string>();
      let selectedKey = "";

      const control = L.control({ position: "bottomleft" });
      let controlNode: HTMLElement | null = null;
      control.onAdd = () => {
        const node = L.DomUtil.create("div", "vf-district-map-control") as HTMLElement;
        node.innerHTML = `
          <header><strong>Contatos por bairro</strong><small>Carregando distribuição territorial…</small></header>
          <div class="vf-district-map-list"><div class="vf-district-map-empty">Carregando bairros…</div></div>
          <div class="vf-district-map-scale"><span class="vf-district-point-legend"></span><span>ponto territorial do bairro</span><em>aproxime para detalhar</em></div>
        `;
        L.DomEvent.disableClickPropagation(node);
        L.DomEvent.disableScrollPropagation(node);
        controlNode = node;
        return node;
      };
      control.addTo(map);

      const setSelectedMarker = (key: string) => {
        if (selectedKey && selectedKey !== key) {
          const previous = districtMarkers.get(selectedKey)?.marker;
          previous?.getElement?.()?.classList?.remove("vf-district-point-selected");
        }
        selectedKey = key;
        const current = districtMarkers.get(key)?.marker;
        current?.getElement?.()?.classList?.add("vf-district-point-selected");
      };

      const renderRanking = () => {
        if (!controlNode) return;
        const header = controlNode.querySelector<HTMLElement>("header small");
        const list = controlNode.querySelector<HTMLElement>(".vf-district-map-list");
        if (!list) return;
        const represented = rankingItems.reduce(
          (sum, item) => sum + (mappedKeys.has(item.key) ? item.total : 0),
          0,
        );
        if (header)
          header.textContent = `${NUMBER.format(rankingItems.reduce((sum, item) => sum + item.total, 0))} contatos em ${NUMBER.format(rankingItems.length)} bairros · ${NUMBER.format(represented)} com referência`;
        list.innerHTML = "";
        if (!rankingItems.length) {
          list.innerHTML = '<div class="vf-district-map-empty">Nenhum bairro com contatos neste ambiente.</div>';
          return;
        }
        for (const item of rankingItems) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "vf-district-map-row";
          const hasCenter = districtCenters.has(item.key);
          button.disabled = !hasCenter;
          const status = visibleKeys.has(item.key)
            ? "ponto azul visível"
            : mappedKeys.has(item.key)
              ? "ponto azul disponível"
              : "sem referência territorial";
          button.innerHTML = `<span>${escapeHtml(item.district)}<small>${status}</small></span><b>${NUMBER.format(item.total)}</b>`;
          if (hasCenter) {
            button.addEventListener("click", () => {
              const center = districtCenters.get(item.key);
              if (!center) return;
              map.setView([center.latitude, center.longitude], Math.max(15, map.getZoom?.() || 15), { animate: true });
              setSelectedMarker(item.key);
              window.setTimeout(() => {
                const visual = districtMarkers.get(item.key);
                visual?.marker?.openPopup?.();
              }, 320);
            });
          }
          list.appendChild(button);
        }
      };

      const updateVisiblePoints = () => {
        if (!map?._container) return;
        const zoom = Math.round(Number(map.getZoom?.() ?? 13));
        const config = visibilityForZoom(zoom);
        const selected: Array<{ x: number; y: number }> = [];
        const nextVisible = new Set<string>();

        for (const item of rankingItems) {
          if (nextVisible.size >= config.limit) break;
          const visual = districtMarkers.get(item.key);
          if (!visual) continue;
          const point = map.latLngToContainerPoint?.([
            visual.center.latitude,
            visual.center.longitude,
          ]);
          if (!point) continue;
          if (
            config.minDistance > 0 &&
            selected.some((candidate) => {
              const dx = candidate.x - point.x;
              const dy = candidate.y - point.y;
              return Math.sqrt(dx * dx + dy * dy) < config.minDistance;
            })
          ) {
            continue;
          }
          nextVisible.add(item.key);
          selected.push({ x: point.x, y: point.y });
        }

        if (selectedKey && mappedKeys.has(selectedKey)) nextVisible.add(selectedKey);

        for (const [key, visual] of districtMarkers) {
          const shouldShow = nextVisible.has(key);
          const isShown = pointLayer.hasLayer?.(visual.marker);
          if (shouldShow && !isShown) visual.marker.addTo(pointLayer);
          if (!shouldShow && isShown) pointLayer.removeLayer(visual.marker);
        }

        visibleKeys = nextVisible;
        map._vfDistrictVisiblePointCount = visibleKeys.size;
        map._vfDistrictPointCount = mappedKeys.size;

        const message = document.querySelector<HTMLElement>(".real-map-toolbar strong");
        if (message) {
          message.textContent = mappedKeys.size
            ? `${visibleKeys.size} ponto(s) de bairro visíveis · ${mappedKeys.size} bairros com referência · ${config.detail}`
            : "Ranking territorial ativo · sem referências territoriais para desenhar pontos";
        }
        renderRanking();
      };

      const draw = async () => {
        const id = ++requestId;
        const scope = currentScope();
        lastScope = scope;
        const params = new URLSearchParams({ mode: "summary" });
        if (scope) params.set("owner", scope);
        const markerParams = new URLSearchParams();
        if (scope) markerParams.set("owner", scope);

        try {
          const [summaryResponse, centersResponse] = await Promise.all([
            apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" }),
            apiFetch(
              `/api/map-district-markers${markerParams.toString() ? `?${markerParams.toString()}` : ""}`,
              { cache: "no-store" },
            ).catch(() => null),
          ]);
          const summaryPayload = (await summaryResponse.json()) as {
            districts?: DistrictSummaryItem[];
            error?: string;
          };
          if (!summaryResponse.ok)
            throw new Error(summaryPayload.error || "Falha ao carregar totais dos bairros");
          if (cancelled || id !== requestId || !map._container) return;

          rankingItems = (Array.isArray(summaryPayload.districts)
            ? summaryPayload.districts
            : []
          )
            .map((item) => ({
              district: String(item.district || "").trim(),
              total: Math.max(0, Number(item.total || 0)),
              key: normalize(item.district),
            }))
            .filter((item) => item.district && item.key && item.total > 0)
            .sort(
              (left, right) =>
                right.total - left.total ||
                left.district.localeCompare(right.district, "pt-BR"),
            );

          districtCenters.clear();
          if (centersResponse?.ok) {
            const centersPayload = (await centersResponse.json()) as {
              markers?: DistrictCenter[];
            };
            for (const item of Array.isArray(centersPayload.markers)
              ? centersPayload.markers
              : []) {
              const key = normalize(item.district);
              const latitude = Number(item.latitude);
              const longitude = Number(item.longitude);
              if (key && Number.isFinite(latitude) && Number.isFinite(longitude))
                districtCenters.set(key, { latitude, longitude });
            }
          }

          pointLayer.clearLayers();
          districtMarkers.clear();
          mappedKeys = new Set<string>();
          visibleKeys = new Set<string>();
          selectedKey = "";
          const pane = map.getPane?.("vfDistrictPointsPane")
            ? "vfDistrictPointsPane"
            : undefined;

          for (const item of rankingItems) {
            const center = districtCenters.get(item.key);
            if (!center) continue;
            const icon = L.divIcon({
              className: "vf-district-point-icon",
              html: markerIconHtml(item),
              iconSize: [34, 38],
              iconAnchor: [17, 35],
              popupAnchor: [0, -34],
            });
            const options: Record<string, unknown> = { icon, keyboard: true };
            if (pane) options.pane = pane;
            const marker = L.marker([center.latitude, center.longitude], options);
            marker.bindTooltip(
              `${item.district} · ${NUMBER.format(item.total)} contato(s)`,
              { direction: "top", offset: [0, -30], opacity: 0.96 },
            );
            marker.bindPopup(
              `<div class="vf-district-area-popup"><strong>${escapeHtml(item.district)}</strong><b>Referência territorial do bairro</b><p>${NUMBER.format(item.total)} contato(s) cadastrados neste bairro</p><small>O ponto azul marca uma referência territorial validada do bairro e não representa endereço individual nem limite geográfico oficial. Os pinos verdes e o L vermelho continuam mostrando somente contatos com coordenada exata.</small></div>`,
              { maxWidth: 310, closeButton: true },
            );
            marker.on("click", () => setSelectedMarker(item.key));
            districtMarkers.set(item.key, { marker, item, center });
            mappedKeys.add(item.key);
          }

          updateVisiblePoints();
        } catch (error) {
          console.error("Failed to render district points", error);
          if (controlNode) {
            const header = controlNode.querySelector<HTMLElement>("header small");
            const list = controlNode.querySelector<HTMLElement>(".vf-district-map-list");
            if (header) header.textContent = "Não foi possível carregar os totais agora";
            if (list)
              list.innerHTML = '<div class="vf-district-map-empty">Os pinos exatos continuam funcionando normalmente.</div>';
          }
        }
      };

      const handleScopeChange = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.matches(".scope-picker select")) return;
        if (currentScope() !== lastScope) void draw();
      };
      const handleRecordsChanged = () => void draw();
      const handleZoomEnd = () => updateVisiblePoints();
      const handleMoveEnd = () => updateVisiblePoints();

      document.addEventListener("change", handleScopeChange, true);
      window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
      map.on?.("zoomend", handleZoomEnd);
      map.on?.("moveend", handleMoveEnd);
      void draw();

      cleanupActiveMap = () => {
        requestId += 1;
        document.removeEventListener("change", handleScopeChange, true);
        window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
        window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
        map.off?.("zoomend", handleZoomEnd);
        map.off?.("moveend", handleMoveEnd);
        try {
          map.removeLayer(pointLayer);
          map.removeControl(control);
        } catch {
          // O mapa pode ter sido destruído durante a navegação.
        }
        if (map._vfDistrictPoints) delete map._vfDistrictPoints;
      };
      map.on?.("unload", cleanupActiveMap);
      return true;
    };

    const attach = () => {
      const map = (window as any).__vfElectoralMap;
      return Boolean(map?._container && setupMap(map));
    };

    const handleMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map?._container) setupMap(map);
    };

    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    if (!attach()) {
      retryTimer = window.setInterval(() => {
        if (attach() && retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 100);
      retryTimeout = window.setTimeout(() => {
        if (retryTimer !== null) {
          window.clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 12_000);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      if (retryTimer !== null) window.clearInterval(retryTimer);
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
      cleanupActiveMap?.();
      cleanupActiveMap = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */