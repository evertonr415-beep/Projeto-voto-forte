"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Municipality = {
  id: number;
  name: string;
  state: string;
  ibgeCode?: string | null;
};

type MunicipalityContext = {
  currentMunicipalityId: number;
  municipalities: Municipality[];
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function isArapongas(municipality: Municipality) {
  return normalizeName(municipality.name) === "arapongas";
}

export default function MunicipalElectoralMapIbgeAuthority() {
  useEffect(() => {
    let cancelled = false;
    let municipality: Municipality | null = null;
    let map: any = null;
    let guardedMap: any = null;
    let officialGeometry: any = null;
    let officialBounds: any = null;
    let allowedBounds: any = null;
    let applyingAuthority = false;
    const refitTimers: number[] = [];

    const updateCopy = () => {
      if (!municipality || isArapongas(municipality)) return;
      const home = document.querySelector<HTMLButtonElement>(
        ".full-map .real-map-toolbar .map-home",
      );
      if (home && home.textContent !== municipality.name) home.textContent = municipality.name;

      const status = document.querySelector<HTMLElement>(
        ".full-map .real-map-toolbar strong",
      );
      if (status && status.textContent?.includes("Arapongas")) {
        status.textContent = `Mapa real de ${municipality.name}`;
      }

      const title = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3")).find(
        (node) => node.textContent?.trim().startsWith("Mapa eleitoral de "),
      );
      if (title && title.textContent !== `Mapa eleitoral de ${municipality.name}`) {
        title.textContent = `Mapa eleitoral de ${municipality.name}`;
      }
    };

    const buildOfficialBounds = () => {
      if (officialBounds?.isValid?.()) return officialBounds;
      if (!officialGeometry) return null;
      const L = (window as any).L;
      if (!L?.geoJSON) return null;

      const geometryLayer = L.geoJSON(officialGeometry);
      const bounds = geometryLayer.getBounds?.();
      if (!bounds?.isValid?.()) return null;

      officialBounds = bounds;
      allowedBounds = bounds.pad?.(0.3) || bounds;
      return bounds;
    };

    const fitOfficialMunicipality = () => {
      if (cancelled || applyingAuthority || !map?._container) return;
      const bounds = buildOfficialBounds();
      if (!bounds?.isValid?.()) return;

      applyingAuthority = true;
      map._vfOfficialMunicipalityId = municipality?.id;
      map._vfOfficialMunicipalityBounds = bounds;
      map._vfOfficialMunicipalityAuthority = true;

      if (allowedBounds?.isValid?.()) {
        map.setMaxBounds?.(allowedBounds);
        if (map.options) map.options.maxBoundsViscosity = 1;
      }

      map.fitBounds(bounds, {
        padding: [18, 18],
        maxZoom: 14,
        animate: false,
      });
      map.invalidateSize?.(false);
      updateCopy();

      window.setTimeout(() => {
        applyingAuthority = false;
      }, 120);
    };

    const keepMapInsideMunicipality = () => {
      if (
        cancelled ||
        applyingAuthority ||
        !map?._container ||
        !allowedBounds?.isValid?.()
      )
        return;
      const center = map.getCenter?.();
      if (center && !allowedBounds.contains?.(center)) fitOfficialMunicipality();
    };

    const bindGuard = (candidate: any) => {
      if (guardedMap === candidate) return;
      if (guardedMap) {
        guardedMap.off?.("moveend", keepMapInsideMunicipality);
        guardedMap.off?.("zoomend", keepMapInsideMunicipality);
      }
      guardedMap = candidate;
      guardedMap.on?.("moveend", keepMapInsideMunicipality);
      guardedMap.on?.("zoomend", keepMapInsideMunicipality);
    };

    const scheduleRefits = () => {
      for (const timer of refitTimers.splice(0)) window.clearTimeout(timer);
      for (const delay of [0, 150, 500, 1200, 2600, 5200]) {
        refitTimers.push(
          window.setTimeout(() => {
            if (!cancelled) fitOfficialMunicipality();
          }, delay),
        );
      }
    };

    const applyAuthorityToMap = (candidate: any) => {
      if (!candidate?._container || !municipality || isArapongas(municipality)) return;
      map = candidate;
      bindGuard(candidate);
      if (buildOfficialBounds()?.isValid?.()) {
        fitOfficialMunicipality();
        scheduleRefits();
      }
    };

    const resolveOfficialGeometry = async (current: Municipality) => {
      const ibgeCode = String(current.ibgeCode || "").trim();
      if (!/^\d{7}$/.test(ibgeCode)) return;

      const response = await apiFetch(
        `/api/municipality-map-geometry?ibgeCode=${encodeURIComponent(ibgeCode)}`,
        { cache: "force-cache" },
      );
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (cancelled || municipality?.id !== current.id || !data?.geometry) return;

      // Guardamos a geometria mesmo quando o Leaflet ainda não foi carregado.
      // Assim o mapa pode nascer depois e receber imediatamente os limites corretos.
      officialGeometry = data.geometry;
      officialBounds = null;
      allowedBounds = null;

      if (map?._container) applyAuthorityToMap(map);
    };

    const onBaseMapReady = (event: Event) => {
      const candidate = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (candidate) applyAuthorityToMap(candidate);
    };

    const onHomeClick = (event: Event) => {
      if (!municipality || isArapongas(municipality)) return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".full-map .real-map-toolbar .map-home")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      fitOfficialMunicipality();
    };

    const loadContext = async () => {
      const response = await apiFetch("/api/municipality-context", { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const data = await response.json().catch(() => null);
      const context = data?.context as MunicipalityContext | undefined;
      const current = context?.municipalities?.find(
        (item) => Number(item.id) === Number(context.currentMunicipalityId),
      );
      if (!current || cancelled) return;

      municipality = current;
      if (isArapongas(current)) return;

      updateCopy();
      const existingMap = (window as any).__vfBaseElectoralMap;
      if (existingMap?._container) applyAuthorityToMap(existingMap);
      await resolveOfficialGeometry(current);
    };

    window.addEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
    document.addEventListener("click", onHomeClick, true);
    void loadContext();

    return () => {
      cancelled = true;
      for (const timer of refitTimers) window.clearTimeout(timer);
      if (guardedMap) {
        guardedMap.off?.("moveend", keepMapInsideMunicipality);
        guardedMap.off?.("zoomend", keepMapInsideMunicipality);
      }
      window.removeEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
      document.removeEventListener("click", onHomeClick, true);
    };
  }, []);

  return null;
}
