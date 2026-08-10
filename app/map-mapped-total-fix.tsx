"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DistrictSummaryItem = {
  district?: string;
  total?: number | string;
};

type DistrictMarkerItem = {
  district?: string;
  total?: number | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type OverviewCenter = {
  latitude: number;
  longitude: number;
};

const NUMBER = new Intl.NumberFormat("pt-BR");
const STYLE_ID = "vf-mapped-total-hud-style";

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

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-mapped-total-hud{position:absolute;left:50%;top:52%;z-index:445;display:none;align-items:center;transform:translate(-50%,-50%);pointer-events:none;user-select:none}
    .vf-mapped-total-hud[data-visible="true"]{display:flex}
    .vf-mapped-total-hud-card{display:flex;align-items:center;gap:10px;min-width:0;padding:9px 12px;border:1px solid rgba(255,255,255,.78);border-radius:15px;background:linear-gradient(145deg,rgba(17,55,98,.95),rgba(34,88,143,.92));box-shadow:0 8px 22px rgba(15,35,65,.24),inset 0 1px 0 rgba(255,255,255,.16);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff}
    .vf-mapped-total-hud strong{display:block;font:900 20px/1 Arial,sans-serif;letter-spacing:-.45px;white-space:nowrap}
    .vf-mapped-total-hud-divider{width:1px;height:25px;background:rgba(255,255,255,.28);flex:0 0 1px}
    .vf-mapped-total-hud span{display:block;font:800 8px/1.15 Arial,sans-serif;text-transform:uppercase;letter-spacing:.75px;white-space:nowrap;opacity:.92}
    .vf-mapped-total-hud-ready .vf-district-overview-total{display:none!important}
    @media(max-width:760px){.vf-mapped-total-hud{top:53%}.vf-mapped-total-hud-card{gap:8px;padding:8px 11px;border-radius:14px}.vf-mapped-total-hud strong{font-size:18px}.vf-mapped-total-hud-divider{height:23px}.vf-mapped-total-hud span{font-size:7.5px;letter-spacing:.65px}}
    @media(max-width:480px){.vf-mapped-total-hud{top:52.5%}.vf-mapped-total-hud-card{padding:8px 10px}.vf-mapped-total-hud strong{font-size:17px}}
  `;
  document.head.appendChild(style);
}

export default function MapMappedTotalFix() {
  useEffect(() => {
    installStyles();
    let cancelled = false;
    let map: any = null;
    let observer: MutationObserver | null = null;
    let hud: HTMLDivElement | null = null;
    let mappedTotal = 0;
    let overviewCenter: OverviewCenter | null = null;
    let requestId = 0;
    let lastZoom = 13;
    let centeredForOverview = false;

    const removeHud = () => {
      hud?.remove();
      hud = null;
    };

    const ensureHud = (container: HTMLElement) => {
      if (hud?.isConnected) return hud;
      const node = document.createElement("div");
      node.className = "vf-mapped-total-hud";
      node.setAttribute("aria-live", "polite");
      node.innerHTML = `
        <div class="vf-mapped-total-hud-card">
          <strong></strong>
          <i class="vf-mapped-total-hud-divider" aria-hidden="true"></i>
          <span>contatos<br>mapeados</span>
        </div>
      `;
      container.appendChild(node);
      hud = node;
      return node;
    };

    const maybeCenterOverview = (force = false) => {
      if (!map?._container || !overviewCenter) return;
      const zoom = Number(map.getZoom?.() ?? 13);
      if (zoom > 12 || (!force && centeredForOverview)) return;

      const target = [overviewCenter.latitude, overviewCenter.longitude] as [number, number];
      const current = map.getCenter?.();
      const distance = current
        ? Number(map.distance?.(current, target) ?? Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY;

      if (force || !Number.isFinite(distance) || distance > 900) {
        map.panTo?.(target, { animate: true, duration: 0.35 });
      }
      centeredForOverview = true;
    };

    const applyMappedTotal = () => {
      if (!map?._container) return;
      const container = map.getContainer?.() as HTMLElement | undefined;
      if (!container) return;

      const zoom = Number(map.getZoom?.() ?? 13);
      const isOverview = zoom <= 12;
      const node = ensureHud(container);

      if (!isOverview || mappedTotal <= 0) {
        node.dataset.visible = "false";
        container.classList.remove("vf-mapped-total-hud-ready");
        return;
      }

      const formatted = NUMBER.format(mappedTotal);
      const strong = node.querySelector<HTMLElement>("strong");
      if (strong && strong.textContent !== formatted) strong.textContent = formatted;
      node.dataset.visible = "true";
      container.classList.add("vf-mapped-total-hud-ready");

      const toolbar = container
        .closest(".full-map")
        ?.querySelector<HTMLElement>(".real-map-toolbar strong");
      const toolbarText = `${formatted} contatos mapeados · visão geral`;
      if (toolbar && toolbar.textContent !== toolbarText)
        toolbar.textContent = toolbarText;
    };

    const handleZoomEnd = () => {
      const zoom = Number(map?.getZoom?.() ?? 13);
      const enteredOverview = zoom <= 12 && lastZoom > 12;
      if (zoom > 12) centeredForOverview = false;
      applyMappedTotal();
      if (enteredOverview) maybeCenterOverview(true);
      lastZoom = zoom;
    };

    const handleMoveEnd = () => applyMappedTotal();

    const attachMap = (nextMap: any) => {
      const container = nextMap?.getContainer?.() as HTMLElement | undefined;
      if (!nextMap?._container || !container || map === nextMap) return;
      observer?.disconnect();
      if (map) {
        map.off?.("zoomend", handleZoomEnd);
        map.off?.("moveend", handleMoveEnd);
        (map.getContainer?.() as HTMLElement | undefined)?.classList.remove(
          "vf-mapped-total-hud-ready",
        );
      }
      removeHud();
      map = nextMap;
      lastZoom = Number(map.getZoom?.() ?? 13);
      centeredForOverview = false;
      map.on?.("zoomend", handleZoomEnd);
      map.on?.("moveend", handleMoveEnd);
      observer = new MutationObserver(applyMappedTotal);
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      applyMappedTotal();
    };

    const loadMappedTotal = async () => {
      const id = ++requestId;
      const scope = currentScope();
      const summaryParams = new URLSearchParams({ mode: "summary" });
      const markerParams = new URLSearchParams();
      if (scope) {
        summaryParams.set("owner", scope);
        markerParams.set("owner", scope);
      }

      try {
        const [summaryResponse, markersResponse] = await Promise.all([
          apiFetch(`/api/contacts?${summaryParams.toString()}`, {
            cache: "no-store",
          }),
          apiFetch(
            `/api/map-district-markers${markerParams.toString() ? `?${markerParams.toString()}` : ""}`,
            { cache: "no-store" },
          ),
        ]);
        if (!summaryResponse.ok || !markersResponse.ok) return;
        const summary = (await summaryResponse.json()) as {
          districts?: DistrictSummaryItem[];
        };
        const markers = (await markersResponse.json()) as {
          markers?: DistrictMarkerItem[];
        };
        if (cancelled || id !== requestId) return;

        const markerItems = Array.isArray(markers.markers) ? markers.markers : [];
        const mappedDistricts = new Set(
          markerItems.map((item) => normalize(item.district)).filter(Boolean),
        );
        mappedTotal = (Array.isArray(summary.districts) ? summary.districts : []).reduce(
          (sum, item) => {
            const key = normalize(item.district);
            return mappedDistricts.has(key)
              ? sum + Math.max(0, Number(item.total || 0))
              : sum;
          },
          0,
        );

        let latitudeSum = 0;
        let longitudeSum = 0;
        let weightSum = 0;
        for (const item of markerItems) {
          const latitude = Number(item.latitude);
          const longitude = Number(item.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
          const weight = Math.max(1, Number(item.total || 0));
          latitudeSum += latitude * weight;
          longitudeSum += longitude * weight;
          weightSum += weight;
        }
        overviewCenter =
          weightSum > 0
            ? {
                latitude: latitudeSum / weightSum,
                longitude: longitudeSum / weightSum,
              }
            : null;

        centeredForOverview = false;
        applyMappedTotal();
        maybeCenterOverview();
      } catch {
        // Mantém o comportamento original se a conferência territorial falhar.
      }
    };

    const handleMapReady = (event: Event) => {
      attachMap((event as CustomEvent<{ map?: any }>).detail?.map);
      void loadMappedTotal();
    };
    const handleRefresh = () => void loadMappedTotal();
    const handleScopeChange = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      centeredForOverview = false;
      void loadMappedTotal();
    };

    window.addEventListener("voto-forte:electoral-map-ready", handleMapReady);
    window.addEventListener("voto-forte:records-changed", handleRefresh);
    window.addEventListener("voto-forte:geocoding-complete", handleRefresh);
    document.addEventListener("change", handleScopeChange, true);

    const existingMap = (window as any).__vfElectoralMap;
    if (existingMap?._container) {
      attachMap(existingMap);
      void loadMappedTotal();
    }

    return () => {
      cancelled = true;
      requestId += 1;
      observer?.disconnect();
      if (map) {
        map.off?.("zoomend", handleZoomEnd);
        map.off?.("moveend", handleMoveEnd);
        (map.getContainer?.() as HTMLElement | undefined)?.classList.remove(
          "vf-mapped-total-hud-ready",
        );
      }
      removeHud();
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      window.removeEventListener("voto-forte:records-changed", handleRefresh);
      window.removeEventListener("voto-forte:geocoding-complete", handleRefresh);
      document.removeEventListener("change", handleScopeChange, true);
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
