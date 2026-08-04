"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type HeatPoint = {
  latitude: number;
  longitude: number;
  count: number;
};

function isMapView() {
  const heading = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((element) => element.textContent?.trim().toLowerCase() || "")
    .some((text) => text.includes("mapa eleitoral") || text.includes("mapa real"));
  return heading || Boolean(document.querySelector(".leaflet-container"));
}

function aggregatePoints(records: Array<any>) {
  const grouped = new Map<string, HeatPoint>();
  for (const record of records) {
    if (record.kind !== "contact") continue;
    const latitude = Number(record.payload?.latitude);
    const longitude = Number(record.payload?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const latBucket = Math.round(latitude * 2000) / 2000;
    const lonBucket = Math.round(longitude * 2000) / 2000;
    const key = `${latBucket}:${lonBucket}`;
    const current = grouped.get(key) || {
      latitude: latBucket,
      longitude: lonBucket,
      count: 0,
    };
    current.count += 1;
    grouped.set(key, current);
  }
  return Array.from(grouped.values());
}

function heatStyle(count: number, maximum: number) {
  const ratio = maximum > 0 ? count / maximum : 0;
  if (ratio >= 0.75)
    return { fillColor: "#c62828", color: "#8e0000", fillOpacity: 0.5 };
  if (ratio >= 0.45)
    return { fillColor: "#ef6c00", color: "#b53d00", fillOpacity: 0.42 };
  if (ratio >= 0.2)
    return { fillColor: "#f9a825", color: "#c17900", fillOpacity: 0.36 };
  return { fillColor: "#2e7d32", color: "#145a18", fillOpacity: 0.28 };
}

export default function MapHeatmapEnhancer() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mappedPoints, setMappedPoints] = useState(0);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pointsRef = useRef<HeatPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    let originalMapFactory: any = null;
    let patchTimer: number | null = null;

    const renderLayer = () => {
      const L = (window as any).L;
      const map = mapRef.current;
      if (!L || !map) return;

      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }

      const heatPoints = pointsRef.current;
      if (!heatPoints.length) {
        layerRef.current = null;
        return;
      }

      const layer = L.layerGroup();
      const maximum = Math.max(1, ...heatPoints.map((point) => point.count));

      for (const point of heatPoints) {
        const style = heatStyle(point.count, maximum);
        const radius = Math.max(120, Math.min(650, 120 + point.count * 18));
        L.circle([point.latitude, point.longitude], {
          radius,
          weight: 1.5,
          color: style.color,
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
          opacity: 0.7,
          interactive: true,
          className: "vf-heat-circle",
        })
          .bindTooltip(`${point.count} cadastro(s) nesta concentração`, {
            direction: "top",
          })
          .addTo(layer);
      }

      layerRef.current = layer;
    };

    const loadPoints = async () => {
      try {
        const response = await fetch("/api/records?owner=all", {
          headers: { accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { records?: Array<any> };
        const points = aggregatePoints(data.records || []);
        pointsRef.current = points;
        if (!cancelled) {
          setMappedPoints(points.reduce((total, point) => total + point.count, 0));
          renderLayer();
        }
      } catch {
        // O mapa principal continua funcionando mesmo sem a camada de calor.
      }
    };

    const installHeatmap = async (map: any) => {
      if (cancelled || !map || map._vfHeatmapInstalled) return;
      map._vfHeatmapInstalled = true;
      mapRef.current = map;
      await loadPoints();
    };

    const patchLeaflet = () => {
      const L = (window as any).L;
      if (!L?.map || L.map.__vfHeatmapPatched) return false;
      originalMapFactory = L.map;
      const wrappedMap = function (this: unknown, ...args: any[]) {
        const map = originalMapFactory.apply(this, args);
        window.setTimeout(() => void installHeatmap(map), 0);
        return map;
      };
      Object.assign(wrappedMap, originalMapFactory);
      wrappedMap.__vfHeatmapPatched = true;
      L.map = wrappedMap;
      return true;
    };

    const refreshVisibility = () => setVisible(isMapView());
    const observer = new MutationObserver(refreshVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    refreshVisibility();

    if (!patchLeaflet()) {
      patchTimer = window.setInterval(() => {
        if (patchLeaflet() && patchTimer) {
          window.clearInterval(patchTimer);
          patchTimer = null;
        }
      }, 250);
    }

    const handleGeocodingComplete = () => void loadPoints();
    window.addEventListener("voto-forte:geocoding-complete", handleGeocodingComplete);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener(
        "voto-forte:geocoding-complete",
        handleGeocodingComplete,
      );
      if (patchTimer) window.clearInterval(patchTimer);
      const map = mapRef.current;
      const layer = layerRef.current;
      if (map && layer && map.hasLayer(layer)) map.removeLayer(layer);
      const L = (window as any).L;
      if (L?.map?.__vfHeatmapPatched && originalMapFactory) L.map = originalMapFactory;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    if (enabled && !map.hasLayer(layer)) layer.addTo(map);
    if (!enabled && map.hasLayer(layer)) map.removeLayer(layer);
  }, [enabled, mappedPoints]);

  if (!visible) return null;

  return (
    <aside className="vf-heatmap-control">
      <div>
        <small>CAMADA ANALÍTICA</small>
        <strong>Mapa de calor</strong>
        <span>{mappedPoints.toLocaleString("pt-BR")} ponto(s) considerados</span>
      </div>
      <button
        type="button"
        className={enabled ? "active" : ""}
        onClick={() => setEnabled((current) => !current)}
      >
        {enabled ? "Desligar mapa de calor" : "Ligar mapa de calor"}
      </button>
      <div className="vf-heat-legend" aria-label="Legenda do mapa de calor">
        <span><i className="low" /> Baixa</span>
        <span><i className="medium" /> Média</span>
        <span><i className="high" /> Alta</span>
        <span><i className="very-high" /> Muito alta</span>
      </div>
    </aside>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
