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
    let officialBounds: any = null;
    let finalFitTimer: number | null = null;
    let finalFitStartedAt = 0;

    const fitOfficialMunicipality = () => {
      if (cancelled || !map?._container || !officialBounds?.isValid?.()) return;
      map.fitBounds(officialBounds, { padding: [18, 18], maxZoom: 14 });
      window.setTimeout(() => map?.invalidateSize?.(), 80);
    };

    const scheduleFinalAuthoritativeFit = () => {
      if (!municipality || !map || finalFitTimer !== null) return;
      finalFitStartedAt = Date.now();
      finalFitTimer = window.setInterval(() => {
        if (cancelled || !municipality || !map?._container) return;
        const elapsed = Date.now() - finalFitStartedAt;
        const legacyFinished = Number(map._vfMunicipalGeometryLoadedId) === Number(municipality.id);
        if (legacyFinished || elapsed >= 10500) {
          fitOfficialMunicipality();
          if (finalFitTimer !== null) window.clearInterval(finalFitTimer);
          finalFitTimer = null;
        }
      }, 250);
    };

    const resolveOfficialBounds = async (current: Municipality) => {
      const ibgeCode = String(current.ibgeCode || "").trim();
      if (!/^\d{7}$/.test(ibgeCode)) return;

      const response = await apiFetch(
        `/api/municipality-map-geometry?ibgeCode=${encodeURIComponent(ibgeCode)}`,
        { cache: "force-cache" },
      );
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (cancelled || municipality?.id !== current.id || !data?.geometry) return;

      const L = (window as any).L;
      if (!L?.geoJSON) return;
      const geometryLayer = L.geoJSON(data.geometry);
      const bounds = geometryLayer.getBounds?.();
      if (!bounds?.isValid?.()) return;

      officialBounds = bounds;
      if (map?._container) {
        map._vfOfficialMunicipalityId = current.id;
        map._vfOfficialMunicipalityBounds = bounds;
        fitOfficialMunicipality();
        scheduleFinalAuthoritativeFit();
      }
    };

    const attachMap = (candidate: any) => {
      if (!candidate?._container || !municipality || isArapongas(municipality)) return;
      map = candidate;
      if (officialBounds?.isValid?.()) {
        map._vfOfficialMunicipalityId = municipality.id;
        map._vfOfficialMunicipalityBounds = officialBounds;
        fitOfficialMunicipality();
        scheduleFinalAuthoritativeFit();
      }
    };

    const onBaseMapReady = (event: Event) => {
      const candidate = (event as CustomEvent<{ map?: any }>).detail?.map;
      if (candidate) attachMap(candidate);
    };

    const onHomeClick = (event: Event) => {
      if (!municipality || isArapongas(municipality) || !officialBounds?.isValid?.()) return;
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

      const existingMap = (window as any).__vfBaseElectoralMap;
      if (existingMap?._container) attachMap(existingMap);
      await resolveOfficialBounds(current);
    };

    window.addEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
    document.addEventListener("click", onHomeClick, true);
    void loadContext();

    return () => {
      cancelled = true;
      if (finalFitTimer !== null) window.clearInterval(finalFitTimer);
      window.removeEventListener("voto-forte:base-electoral-map-ready", onBaseMapReady);
      document.removeEventListener("click", onHomeClick, true);
    };
  }, []);

  return null;
}
