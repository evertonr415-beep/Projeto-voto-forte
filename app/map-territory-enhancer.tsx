"use client";

import { useLayoutEffect } from "react";
import { apiFetch } from "./supabase-client";
import { ARAPONGAS_POLLING_PLACES, type PollingPlace } from "./electoral-tse-data";

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
  if (zoom <= 12) return { limit: 14, minDistance: 70, detail: "visão geral" };
  if (zoom === 13) return { limit: 28, minDistance: 50, detail: "principais bairros" };
  if (zoom === 14) return { limit: 60, minDistance: 36, detail: "mais bairros" };
  return { limit: Number.POSITIVE_INFINITY, minDistance: 24, detail: "todos os bairros" };
}

/**
 * Retorna os colégios de votação correspondentes ao bairro
 */
function getCollegesForDistrict(districtName: string): PollingPlace[] {
  const norm = normalize(districtName);
  return ARAPONGAS_POLLING_PLACES.filter((p) => {
    const pNorm = normalize(p.district);
    return pNorm === norm || pNorm.includes(norm) || norm.includes(pNorm);
  });
}

function markerIconHtml(item: DistrictItem) {
  const colleges = getCollegesForDistrict(item.district);
  const collegeCount = colleges.length;
  const mainCollege = colleges[0];

  return `
    <div class="vf-district-point-wrap" aria-label="${escapeHtml(item.district)} (Arapongas): ${NUMBER.format(item.total)} contatos">
      <div class="vf-district-point-box">
        <span class="vf-district-name-text">${escapeHtml(item.district)}</span>
        <span class="vf-district-point-count">${NUMBER.format(item.total)}</span>
        ${collegeCount > 0 ? `
          <button type="button" class="vf-district-college-btn" data-college-id="${mainCollege.id}" data-district="${escapeHtml(item.district)}" title="Município: Arapongas - PR · Colégio: ${escapeHtml(mainCollege.shortName || mainCollege.name)} (${NUMBER.format(mainCollege.totalVoters)} eleitores)">
            🏫 ${collegeCount === 1 ? escapeHtml(mainCollege.shortName || mainCollege.name) : `${collegeCount} Colégios`}
          </button>
        ` : ''}
      </div>
      <span class="vf-district-point-dot" aria-hidden="true"></span>
    </div>
  `;
}

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* BARRA DE ATALHOS FLUTUANTES NO MAPA */
    .vf-map-floating-quick-bar {
      display: flex;
      gap: 6px;
      background: rgba(255, 255, 255, 0.95);
      padding: 6px 8px;
      border-radius: 12px;
      border: 1px solid rgba(23, 52, 92, 0.15);
      box-shadow: 0 8px 24px rgba(15, 35, 65, 0.18);
      backdrop-filter: blur(8px);
      margin-top: 10px;
      margin-right: 10px;
      flex-wrap: wrap;
      max-width: calc(100vw - 32px);
      z-index: 400;
    }
    .vf-map-quick-btn {
      padding: 7px 12px;
      border-radius: 8px;
      border: 0;
      font: 800 11px/1.2 Arial, sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .vf-btn-tse {
      background: linear-gradient(135deg, #0d2342 0%, #0284c7 100%);
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);
    }
    .vf-btn-tse:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.4);
    }
    .vf-btn-colleges {
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }
    .vf-btn-colleges:hover {
      background: #e2e8f0;
    }
    .vf-btn-districts {
      background: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }
    .vf-btn-districts:hover {
      background: #e2e8f0;
    }

    /* BALÕES AZUIS DOS BAIRROS COM NOME DO BAIRRO E BOTÃO DE COLÉGIO */
    .vf-district-point-icon {
      background: transparent !important;
      border: 0 !important;
      overflow: visible !important;
    }
    .vf-district-point-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 3px 8px rgba(15, 35, 65, 0.25));
      transition: transform 0.15s ease;
      cursor: pointer;
    }
    .vf-district-point-wrap:hover {
      transform: translateY(-2px) scale(1.06);
      z-index: 999 !important;
    }
    .vf-district-point-box {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ffffff;
      border: 2px solid #0284c7;
      box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);
      color: #0f172a;
      font: 800 12px/1 Arial, sans-serif;
      white-space: nowrap;
    }
    .vf-district-name-text {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .vf-district-point-count {
      background: #0284c7;
      color: #ffffff;
      padding: 2px 7px;
      border-radius: 999px;
      font: 900 11px/1 Arial, sans-serif;
    }
    .vf-district-college-btn {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #f59e0b;
      padding: 2px 7px;
      border-radius: 999px;
      font: 800 10px/1 Arial, sans-serif;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .vf-district-college-btn:hover {
      background: #fde68a;
      transform: scale(1.05);
    }
    .vf-district-point-dot {
      display: block;
      width: 10px;
      height: 10px;
      margin-top: 2px;
      border-radius: 50%;
      background: #0284c7;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px rgba(2, 132, 199, 0.4), 0 2px 4px rgba(0, 0, 0, 0.25);
    }
    .vf-district-point-icon.vf-district-point-selected .vf-district-point-dot {
      box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.3), 0 0 0 1px #0284c7, 0 3px 6px rgba(2, 132, 199, 0.4);
    }
    .vf-district-point-icon.vf-district-point-selected .vf-district-point-box {
      border-color: #0d2342;
      background: #f0f9ff;
      box-shadow: 0 4px 16px rgba(2, 132, 199, 0.45);
    }
    
    .vf-district-overview-total {
      background: transparent !important;
      border: 0 !important;
      overflow: visible !important;
    }
    .vf-district-overview-total-wrap {
      min-width: 112px;
      padding: 12px 16px;
      border-radius: 18px;
      background: rgba(23, 63, 117, 0.94);
      border: 2px solid #ffffff;
      box-shadow: 0 10px 28px rgba(15, 35, 65, 0.28);
      color: #ffffff;
      text-align: center;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .vf-district-overview-total-wrap strong {
      display: block;
      font: 900 20px/1 Arial, sans-serif;
      letter-spacing: -0.4px;
    }
    .vf-district-overview-total-wrap small {
      display: block;
      margin-top: 4px;
      font: 800 9px/1.2 Arial, sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      opacity: 0.9;
    }
    
    /* POPUP DE BAIRRO COM INDICAÇÃO DE MUNICÍPIO E COLÉGIOS */
    .vf-district-area-popup {
      min-width: 250px;
      font: 500 12px/1.4 Arial, sans-serif;
      color: #26384d;
    }
    .vf-district-area-popup strong {
      display: block;
      color: #17345c;
      font-size: 16px;
      font-weight: 900;
      margin-bottom: 2px;
    }
    .vf-district-area-popup b {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      background: #eaf2fb;
      color: #285b8e;
      font-size: 10px;
    }
    .vf-district-area-popup p {
      margin: 6px 0 0;
      font-weight: 700;
      color: #0f172a;
    }
    .vf-district-area-popup small {
      display: block;
      margin-top: 7px;
      color: #64748b;
    }
    .vf-district-popup-actions {
      display: grid;
      gap: 6px;
      margin-top: 10px;
    }
    .vf-district-popup-actions button {
      border: 0;
      border-radius: 8px;
      padding: 8px 10px;
      font: 800 11px/1.2 Arial, sans-serif;
      cursor: pointer;
    }
    .vf-district-adjust {
      background: #eef4fa;
      color: #173f75;
      border: 1px solid #d4e0ec !important;
    }
    .vf-district-save {
      background: #1f7a4c;
      color: #ffffff;
    }
    .vf-district-cancel {
      background: #f3f4f6;
      color: #475569;
    }
    .vf-district-dragging .vf-district-point-wrap {
      filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
      transform: scale(1.12);
    }

    /* PAINEL LATERAL DE CONTATOS POR BAIRRO */
    .vf-district-map-control {
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid rgba(23, 52, 92, 0.13);
      border-radius: 14px;
      box-shadow: 0 9px 24px rgba(15, 35, 65, 0.16);
      width: 260px;
      max-height: 310px;
      overflow: hidden;
      font: 600 11px/1.3 Arial, sans-serif;
      color: #17345c;
      backdrop-filter: blur(6px);
    }
    .vf-district-map-control header {
      padding: 10px 11px 8px;
      border-bottom: 1px solid #e4ebf3;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .vf-district-map-control header > div {
      min-width: 0;
      flex: 1;
    }
    .vf-district-map-control header strong {
      display: block;
      font-size: 13px;
    }
    .vf-district-map-control header small {
      display: block;
      margin-top: 3px;
      color: #64748b;
      font-weight: 600;
    }
    .vf-district-map-toggle {
      display: none;
      border: 1px solid #d9e3ef;
      background: #f5f8fc;
      color: #173f75;
      border-radius: 8px;
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      font: 900 15px/1 Arial, sans-serif;
      cursor: pointer;
    }
    .vf-district-map-list {
      max-height: 245px;
      overflow: auto;
      padding: 5px;
    }
    .vf-district-map-row {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: #27405f;
      text-align: left;
      padding: 7px 8px;
      cursor: pointer;
      font: 700 11px/1.2 Arial, sans-serif;
    }
    .vf-district-map-row:hover:not(:disabled) {
      background: #edf4fb;
    }
    .vf-district-map-row:disabled {
      cursor: default;
      opacity: 0.62;
    }
    .vf-district-map-row b {
      font-size: 12px;
      color: #17345c;
    }
    .vf-district-map-row small {
      display: block;
      margin-top: 2px;
      color: #7a899c;
      font-size: 9px;
      font-weight: 600;
    }
    .vf-district-map-empty {
      padding: 12px;
      color: #64748b;
      font-weight: 600;
    }
    .vf-district-map-scale {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-top: 1px solid #e4ebf3;
      color: #64748b;
      font-size: 9px;
    }
    .vf-district-map-scale .vf-district-point-legend {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #2563a8;
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 1px rgba(24, 74, 124, 0.24);
    }
    .vf-district-map-scale em {
      margin-left: auto;
      font-style: normal;
      color: #8491a2;
    }

    @media(max-width:760px) {
      .full-map {
        height: 72vh !important;
        min-height: 520px !important;
      }

      .full-map .map-legend {
        top: 82px !important;
        left: auto !important;
        right: 8px !important;
        width: auto !important;
        max-width: 190px !important;
        padding: 8px 10px !important;
        border-radius: 9px !important;
      }
      .full-map .map-legend h4,
      .full-map .map-legend hr,
      .full-map .map-legend > small,
      .full-map .map-legend > strong {
        display: none !important;
      }
      .full-map .map-legend label {
        margin: 4px 0 !important;
        font-size: 7px !important;
        gap: 5px !important;
      }
      .vf-district-map-control {
        width: min(240px, calc(100vw - 32px));
        max-height: 260px;
      }
      .vf-district-map-control header {
        padding: 8px 9px;
        border-bottom: 0;
        align-items: center;
      }
      .vf-district-map-control header strong {
        font-size: 12px;
      }
      .vf-district-map-control header small {
        font-size: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .vf-district-map-toggle {
        display: block;
      }
      .vf-district-map-control[data-collapsed="true"] .vf-district-map-list,
      .vf-district-map-control[data-collapsed="true"] .vf-district-map-scale {
        display: none;
      }
      .vf-district-map-control[data-collapsed="true"] header {
        border-bottom: 0;
      }
      .vf-district-map-list {
        max-height: 170px;
      }
      .vf-district-map-row {
        padding: 6px;
      }
      .vf-district-map-scale em {
        display: none;
      }
      .vf-district-name-text {
        max-width: 90px;
        font-size: 10px;
      }
      .vf-district-point-count {
        font-size: 9px;
        padding: 1px 5px;
      }
      .vf-district-point-dot {
        width: 9px;
        height: 9px;
      }

    }
    @media(max-width:480px) {
      .full-map {
        height: 74vh !important;
        min-height: 540px !important;
      }
      .full-map .map-legend {
        max-width: 165px !important;
      }
      .vf-district-map-control {
        width: min(220px, calc(100vw - 28px));
      }
    }
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
    let canManageReferences = false;
    void apiFetch("/api/session")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.ok) canManageReferences = data?.user?.role === "master";
      })
      .catch(() => undefined);

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
      const overviewLayer = L.layerGroup().addTo(map);
      let overviewMarker: any = null;
      let overviewTotal = 0;
      const districtCenters = new Map<string, CenterPoint>();
      const districtMarkers = new Map<string, DistrictMarkerVisual>();
      let requestId = 0;
      let lastScope = currentScope();
      let rankingItems: DistrictItem[] = [];
      let mappedKeys = new Set<string>();
      let visibleKeys = new Set<string>();
      let selectedKey = "";



      // 2. CONTROLE DE CONTATOS POR BAIRRO
      const control = L.control({ position: "bottomleft" });
      let controlNode: HTMLElement | null = null;
      control.onAdd = () => {
        const node = L.DomUtil.create("div", "vf-district-map-control") as HTMLElement;
        const startsCollapsed = window.matchMedia("(max-width: 760px)").matches;
        node.dataset.collapsed = startsCollapsed ? "true" : "false";
        node.innerHTML = `
          <header>
            <div><strong>Arapongas · Contatos por bairro</strong><small>Carregando distribuição territorial…</small></div>
            <button type="button" class="vf-district-map-toggle" aria-label="Abrir contatos por bairro" aria-expanded="${startsCollapsed ? "false" : "true"}">${startsCollapsed ? "+" : "−"}</button>
          </header>
          <div class="vf-district-map-list"><div class="vf-district-map-empty">Carregando bairros…</div></div>
          <div style="padding:6px 8px;border-top:1px solid #e4ebf3;background:#f8fafc;">
            <button type="button" class="vf-map-open-electoral-btn" style="width:100%;padding:7px;border-radius:8px;background:#0284c7;color:#ffffff;border:0;font:800 11px Arial,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;box-shadow:0 2px 6px rgba(2,132,199,0.25);">
              🏫 Colégios & Dados TSE →
            </button>
          </div>
          <div class="vf-district-map-scale"><span class="vf-district-point-legend"></span><span>ponto territorial do bairro</span><em>aproxime para detalhar</em></div>
        `;
        const toggle = node.querySelector<HTMLButtonElement>(".vf-district-map-toggle");
        toggle?.addEventListener("click", () => {
          const nextCollapsed = node.dataset.collapsed !== "true";
          node.dataset.collapsed = nextCollapsed ? "true" : "false";
          toggle.textContent = nextCollapsed ? "+" : "−";
          toggle.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
          toggle.setAttribute("aria-label", nextCollapsed ? "Abrir contatos por bairro" : "Recolher contatos por bairro");
        });
        node.querySelector<HTMLButtonElement>(".vf-map-open-electoral-btn")?.addEventListener("click", () => {
          window.dispatchEvent(
            new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
              detail: { district: "Todos os Bairros", initialTab: "electoral" },
            }),
          );
        });
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
          header.textContent = `${NUMBER.format(rankingItems.reduce((sum, item) => sum + item.total, 0))} contatos em ${NUMBER.format(rankingItems.length)} bairros · Arapongas - PR`;
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
        const isOverviewZoom = zoom <= 12;
        const config = visibilityForZoom(zoom);

        if (isOverviewZoom) {
          for (const [, visual] of districtMarkers) {
            if (pointLayer.hasLayer?.(visual.marker)) pointLayer.removeLayer(visual.marker);
          }
          visibleKeys = new Set<string>();
          if (overviewTotal > 0) {
            if (!overviewMarker) {
              overviewMarker = L.marker(map.getCenter(), {
                interactive: false,
                keyboard: false,
                zIndexOffset: 450,
                icon: L.divIcon({
                  className: "vf-district-overview-total",
                  html: `<div class="vf-district-overview-total-wrap"><strong>${NUMBER.format(overviewTotal)}</strong><small>contatos · Arapongas</small></div>`,
                  iconSize: [1, 1],
                  iconAnchor: [0, 0],
                }),
              });
            } else {
              overviewMarker.setIcon(
                L.divIcon({
                  className: "vf-district-overview-total",
                  html: `<div class="vf-district-overview-total-wrap"><strong>${NUMBER.format(overviewTotal)}</strong><small>contatos · Arapongas</small></div>`,
                  iconSize: [1, 1],
                  iconAnchor: [0, 0],
                }),
              );
            }
            overviewMarker.setLatLng(map.getCenter());
            if (!overviewLayer.hasLayer?.(overviewMarker)) overviewMarker.addTo(overviewLayer);
          } else {
            overviewLayer.clearLayers();
          }
        } else {
          overviewLayer.clearLayers();
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
        }

        map._vfDistrictVisiblePointCount = visibleKeys.size;
        map._vfDistrictPointCount = mappedKeys.size;
      };

      const draw = async () => {
        const thisRequest = ++requestId;
        lastScope = currentScope();
        try {
          const params = new URLSearchParams({ mode: "ranking" });
          if (lastScope) params.set("owner", lastScope);
          const [rankingResponse, centersResponse] = await Promise.all([
            apiFetch(`/api/contacts?${params.toString()}`),
            apiFetch("/api/territorial-pending?mode=centers"),
          ]);
          if (!rankingResponse.ok || !centersResponse.ok) return;

          const rankingData = (await rankingResponse.json()) as {
            districts?: DistrictSummaryItem[];
          };
          const centersData = (await centersResponse.json()) as {
            centers?: DistrictCenter[];
          };
          if (thisRequest !== requestId || cancelled || !map?._container) return;

          const rankingRaw = Array.isArray(rankingData?.districts) ? rankingData.districts : [];
          overviewTotal = rankingRaw.reduce((sum, item) => sum + (Number(item?.total) || 0), 0);

          districtCenters.clear();
          const centersRaw = Array.isArray(centersData?.centers) ? centersData.centers : [];
          for (const center of centersRaw) {
            const district = String(center?.district || "").trim();
            const lat = Number(center?.latitude);
            const lng = Number(center?.longitude);
            if (!district || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            districtCenters.set(normalize(district), { latitude: lat, longitude: lng });
          }

          rankingItems = rankingRaw
            .map((item) => {
              const district = String(item?.district || "").trim();
              const total = Math.max(0, Number(item?.total) || 0);
              return { district, total, key: normalize(district) };
            })
            .filter((item) => item.district && item.total > 0)
            .sort((a, b) => b.total - a.total || a.district.localeCompare(b.district, "pt-BR"));

          mappedKeys = new Set(
            rankingItems
              .filter((item) => districtCenters.has(item.key))
              .map((item) => item.key),
          );

          const pane = map.getPane?.("vfDistrictPointsPane");
          for (const item of rankingItems) {
            const center = districtCenters.get(item.key);
            if (!center) continue;

            const colleges = getCollegesForDistrict(item.district);

            const existing = districtMarkers.get(item.key);
            if (existing) {
              existing.item = item;
              existing.center = center;
              existing.marker.setLatLng([center.latitude, center.longitude]);
              existing.marker.setIcon(
                L.divIcon({
                  className: `vf-district-point-icon${selectedKey === item.key ? " vf-district-point-selected" : ""}`,
                  html: markerIconHtml(item),
                  iconSize: [1, 1],
                  iconAnchor: [0, 0],
                }),
              );
              continue;
            }

            const options: any = {
              icon: L.divIcon({
                className: `vf-district-point-icon${selectedKey === item.key ? " vf-district-point-selected" : ""}`,
                html: markerIconHtml(item),
                iconSize: [1, 1],
                iconAnchor: [0, 0],
              }),
              zIndexOffset: 100,
            };
            if (pane) options.pane = pane;
            const marker = L.marker([center.latitude, center.longitude], options);
            let editingPosition = false;
            const originalPosition = { ...center };

            const popupHtml = (editing = false) => `
              <div class="vf-district-area-popup">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                  <span style="font-size:10px;font-weight:900;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:999px;text-transform:uppercase;">
                    🏛️ Arapongas - PR
                  </span>
                  <span style="font-size:10px;color:#64748b;font-weight:700;">61ª Zona</span>
                </div>
                <strong>📍 ${escapeHtml(item.district)}</strong>
                <b>Referência territorial do bairro</b>
                <p>👥 ${NUMBER.format(item.total)} contato(s) cadastrados neste bairro</p>
                
                ${colleges.length > 0 ? `
                  <div style="margin: 8px 0; padding: 8px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
                    <span style="display:block; font-size:10px; font-weight:800; color:#0369a1; text-transform:uppercase; margin-bottom:4px;">
                      🏫 Colégio(s) de Votação em Arapongas neste Bairro:
                    </span>
                    ${colleges.map(c => `
                      <button type="button" class="vf-popup-college-btn" data-college-id="${c.id}" data-district="${escapeHtml(item.district)}" style="width:100%; text-align:left; padding:6px 8px; margin-bottom:4px; background:#ffffff; border:1px solid #7dd3fc; border-radius:6px; font-size:11px; font-weight:700; color:#0f172a; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                        <span>🏫 ${escapeHtml(c.shortName || c.name)}</span>
                        <span style="font-size:10px; color:#0284c7; font-weight:800;">${NUMBER.format(c.totalVoters)} el. →</span>
                      </button>
                    `).join('')}
                  </div>
                ` : ''}

                <small>${editing ? "Arraste o ponto azul até a posição correta e salve." : "O balão azul indica o bairro do município de Arapongas e permite consultar contatos, colégios e apuração oficial do TSE."}</small>
                <div class="vf-district-popup-actions">
                  <button type="button" class="vf-district-open-electoral-drawer" style="background:#0284c7;color:#ffffff;font-weight:900;box-shadow:0 2px 8px rgba(2,132,199,0.3);">
                    📊 Abrir Painel Territorial do Bairro →
                  </button>
                  ${canManageReferences ? editing
                    ? '<button type="button" class="vf-district-save">Salvar posição</button><button type="button" class="vf-district-cancel">Cancelar ajuste</button>'
                    : '<button type="button" class="vf-district-adjust">Ajustar posição</button>' : ""}
                </div>
              </div>`;

            const bindActions = () => {
              const popup = marker.getPopup?.()?.getElement?.() as HTMLElement | null;
              if (!popup) return;

              popup.querySelectorAll<HTMLButtonElement>(".vf-popup-college-btn").forEach((btn) => {
                btn.addEventListener("click", (e) => {
                  e.stopPropagation();
                  const colId = btn.getAttribute("data-college-id") || "";
                  const dist = btn.getAttribute("data-district") || item.district;
                  window.dispatchEvent(
                    new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                      detail: { district: dist, initialTab: "electoral", pollingPlaceId: colId },
                    }),
                  );
                });
              });

              popup.querySelector<HTMLButtonElement>(".vf-district-open-electoral-drawer")?.addEventListener("click", () => {
                window.dispatchEvent(
                  new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                    detail: { district: item.district, total: item.total },
                  }),
                );
              });

              popup.querySelector<HTMLButtonElement>(".vf-district-adjust")?.addEventListener("click", () => {
                editingPosition = true;
                marker.dragging?.enable?.();
                marker.getElement?.()?.classList?.add("vf-district-dragging");
                marker.setPopupContent(popupHtml(true));
                marker.openPopup();
              });
              popup.querySelector<HTMLButtonElement>(".vf-district-cancel")?.addEventListener("click", () => {
                editingPosition = false;
                marker.setLatLng([originalPosition.latitude, originalPosition.longitude]);
                marker.dragging?.disable?.();
                marker.getElement?.()?.classList?.remove("vf-district-dragging");
                marker.setPopupContent(popupHtml(false));
                marker.openPopup();
              });
              popup.querySelector<HTMLButtonElement>(".vf-district-save")?.addEventListener("click", async () => {
                const latLng = marker.getLatLng?.();
                if (!latLng) return;
                const button = popup.querySelector<HTMLButtonElement>(".vf-district-save");
                if (button) { button.disabled = true; button.textContent = "Salvando…"; }
                try {
                  const response = await apiFetch("/api/territorial-pending", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      referenceDistrict: item.district,
                      latitude: Number(latLng.lat),
                      longitude: Number(latLng.lng),
                    }),
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar a posição");
                  center.latitude = Number(latLng.lat);
                  center.longitude = Number(latLng.lng);
                  originalPosition.latitude = center.latitude;
                  originalPosition.longitude = center.longitude;
                  editingPosition = false;
                  marker.dragging?.disable?.();
                  marker.getElement?.()?.classList?.remove("vf-district-dragging");
                  marker.setPopupContent(popupHtml(false));
                  marker.openPopup();
                  window.dispatchEvent(new CustomEvent("voto-forte:geocoding-complete"));
                } catch (error) {
                  window.alert(error instanceof Error ? error.message : "Não foi possível salvar a posição");
                  if (button) { button.disabled = false; button.textContent = "Salvar posição"; }
                }
              });
            };

            marker.bindTooltip(
              `📍 ${item.district} · Arapongas (${NUMBER.format(item.total)} contato(s))`,
              { direction: "top", offset: [0, -30], opacity: 0.96 },
            );
            marker.bindPopup(popupHtml(false), { maxWidth: 320, closeButton: true });
            marker.on("popupopen", bindActions);
            marker.on("dblclick", () => {
              window.dispatchEvent(
                new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                  detail: { district: item.district, total: item.total },
                }),
              );
            });

            districtMarkers.set(item.key, { marker, item, center });
          }

          for (const [key, visual] of districtMarkers) {
            if (!mappedKeys.has(key)) {
              if (pointLayer.hasLayer?.(visual.marker)) pointLayer.removeLayer(visual.marker);
              districtMarkers.delete(key);
            }
          }

          renderRanking();
          updateVisiblePoints();
        } catch (error) {
          console.error("Falha ao desenhar inteligência territorial", error);
        }
      };

      const handleScopeChange = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (!target?.matches(".scope-picker select")) return;
        if (currentScope() !== lastScope) void draw();
      };
      let frameId: number | null = null;
      const scheduleUpdate = () => {
        if (frameId !== null) return;
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          updateVisiblePoints();
        });
      };

      const handleRecordsChanged = () => void draw();
      const handleZoomEnd = () => scheduleUpdate();
      const handleMoveEnd = () => scheduleUpdate();

      const handleGlobalCollegeClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const btn = target?.closest<HTMLButtonElement>(".vf-district-college-btn, .vf-popup-college-btn");
        if (btn) {
          e.stopPropagation();
          e.preventDefault();
          const colId = btn.getAttribute("data-college-id") || "";
          const dist = btn.getAttribute("data-district") || "";
          window.dispatchEvent(
            new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
              detail: { district: dist, initialTab: "electoral", pollingPlaceId: colId },
            }),
          );
        }
      };

      document.addEventListener("click", handleGlobalCollegeClick, true);
      document.addEventListener("change", handleScopeChange, true);
      window.addEventListener("voto-forte:records-changed", handleRecordsChanged);
      window.addEventListener("voto-forte:contacts-imported", handleRecordsChanged);
      window.addEventListener("voto-forte:refresh-dashboard", handleRecordsChanged);
      window.addEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
      map.on?.("zoomend", handleZoomEnd);
      map.on?.("moveend", handleMoveEnd);
      void draw();

      cleanupActiveMap = () => {
        requestId += 1;
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
          frameId = null;
        }
        document.removeEventListener("click", handleGlobalCollegeClick, true);
        document.removeEventListener("change", handleScopeChange, true);
        window.removeEventListener("voto-forte:records-changed", handleRecordsChanged);
        window.removeEventListener("voto-forte:contacts-imported", handleRecordsChanged);
        window.removeEventListener("voto-forte:refresh-dashboard", handleRecordsChanged);
        window.removeEventListener("voto-forte:geocoding-complete", handleRecordsChanged);
        map.off?.("zoomend", handleZoomEnd);
        map.off?.("moveend", handleMoveEnd);
        try {
          map.removeLayer(pointLayer);
          map.removeLayer(overviewLayer);
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
      const map = (window as any).__vfElectoralMap || (window as any).__vfBaseElectoralMap;
      return Boolean(map?._container && setupMap(map));
    };

    const handleMapReady = (event: Event) => {
      const map = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (map?._container) setupMap(map);
    };

    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:base-electoral-map-ready", handleMapReady);

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
      window.removeEventListener("voto-forte:base-electoral-map-ready", handleMapReady);
      if (retryTimer !== null) window.clearInterval(retryTimer);
      if (retryTimeout !== null) window.clearTimeout(retryTimeout);
      cleanupActiveMap?.();
      cleanupActiveMap = null;
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
