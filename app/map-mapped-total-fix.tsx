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
};

const NUMBER = new Intl.NumberFormat("pt-BR");

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

export default function MapMappedTotalFix() {
  useEffect(() => {
    let cancelled = false;
    let map: any = null;
    let observer: MutationObserver | null = null;
    let mappedTotal = 0;
    let requestId = 0;

    const applyMappedTotal = () => {
      if (!map?._container || Number(map.getZoom?.() ?? 13) > 12 || mappedTotal <= 0)
        return;

      const container = map.getContainer?.() as HTMLElement | undefined;
      if (!container) return;

      const formatted = NUMBER.format(mappedTotal);
      const marker = container.querySelector<HTMLElement>(
        ".vf-district-overview-total-wrap",
      );
      const strong = marker?.querySelector<HTMLElement>("strong");
      const small = marker?.querySelector<HTMLElement>("small");
      if (strong && strong.textContent !== formatted) strong.textContent = formatted;
      if (small && small.textContent !== "contatos mapeados")
        small.textContent = "contatos mapeados";

      const toolbar = container
        .closest(".full-map")
        ?.querySelector<HTMLElement>(".real-map-toolbar strong");
      const toolbarText = `${formatted} contatos mapeados · visão geral`;
      if (toolbar && toolbar.textContent !== toolbarText)
        toolbar.textContent = toolbarText;
    };

    const attachMap = (nextMap: any) => {
      const container = nextMap?.getContainer?.() as HTMLElement | undefined;
      if (!nextMap?._container || !container || map === nextMap) return;
      observer?.disconnect();
      if (map) {
        map.off?.("zoomend", applyMappedTotal);
        map.off?.("moveend", applyMappedTotal);
      }
      map = nextMap;
      map.on?.("zoomend", applyMappedTotal);
      map.on?.("moveend", applyMappedTotal);
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

        const mappedDistricts = new Set(
          (Array.isArray(markers.markers) ? markers.markers : [])
            .map((item) => normalize(item.district))
            .filter(Boolean),
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
        applyMappedTotal();
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
        map.off?.("zoomend", applyMappedTotal);
        map.off?.("moveend", applyMappedTotal);
      }
      window.removeEventListener("voto-forte:electoral-map-ready", handleMapReady);
      window.removeEventListener("voto-forte:records-changed", handleRefresh);
      window.removeEventListener("voto-forte:geocoding-complete", handleRefresh);
      document.removeEventListener("change", handleScopeChange, true);
    };
  }, []);

  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
