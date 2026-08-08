"use client";

import { useEffect, useRef, useState } from "react";
import { loadSharedMappedTerritoryData } from "./territory-data-client";

/* eslint-disable @typescript-eslint/no-explicit-any */
type HeatPoint = {
  latitude: number;
  longitude: number;
  count: number;
};

function aggregatePoints(records: Array<any>) {
  const grouped = new Map<string, HeatPoint>();
  for (const record of records) {
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
  const [loading, setLoading] = useState(false);
  const [loadedMappedPoints, setLoadedMappedPoints] = useState(0);
  const [totalMappedPoints, setTotalMappedPoints] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pointsRef = useRef<HeatPoint[]>([]);
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;
    let originalMapFactory: any = null;
    let patchTimer: number | null = null;
    let patchTimeout: number | null = null;

    const clearLayer = () => {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (map && layer && map.hasLayer(layer)) map.removeLayer(layer);
      layerRef.current = null;
    };

    const renderLayer = () => {
      const L = (window as any).L;
      const map = mapRef.current;
      if (!L || !map || !enabledRef.current) return;

      clearLayer();

      const heatPoints = pointsRef.current;
      if (!heatPoints.length) return;

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
      layer.addTo(map);
    };

    const loadPoints = async (force = false) => {
      if (!enabledRef.current || cancelled) return;
      setLoading(true);
      try {
        const mappedData = await loadSharedMappedTerritoryData({ force });
        if (cancelled || !enabledRef.current) return;
        const points = aggregatePoints(mappedData.records);
        pointsRef.current = points;
        setLoadedMappedPoints(mappedData.records.length);
        setTotalMappedPoints(mappedData.total);
        setTruncated(mappedData.truncated);
        window.requestAnimationFrame(renderLayer);
      } catch {
        // O mapa principal continua funcionando mesmo sem a camada de calor.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const installHeatmap = (map: any) => {
      if (cancelled || !map || map._vfHeatmapInstalled) return;
      map._vfHeatmapInstalled = true;
      mapRef.current = map;
      setVisible(true);
    };

    const patchLeaflet = () => {
      const L = (window as any).L;
      if (!L?.map || L.map.__vfHeatmapPatched) return false;
      originalMapFactory = L.map;
      const wrappedMap = function (this: unknown, ...args: any[]) {
        const map = originalMapFactory.apply(this, args);
        window.setTimeout(() => installHeatmap(map), 0);
        return map;
      };
      Object.assign(wrappedMap, originalMapFactory);
      wrappedMap.__vfHeatmapPatched = true;
      L.map = wrappedMap;
      return true;
    };

    if (!patchLeaflet()) {
      patchTimer = window.setInterval(() => {
        if (patchLeaflet() && patchTimer) {
          window.clearInterval(patchTimer);
          patchTimer = null;
        }
      }, 250);
      patchTimeout = window.setTimeout(() => {
        if (patchTimer) window.clearInterval(patchTimer);
        patchTimer = null;
      }, 10_000);
    }

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
    };

    const handleGeocodingComplete = () => {
      if (enabledRef.current) void loadPoints(true);
    };

    window.addEventListener("voto-forte:heatmap-toggle", handleToggle);
    window.addEventListener("voto-forte:geocoding-complete", handleGeocodingComplete);

    const handleEnable = () => void loadPoints(false);
    window.addEventListener("voto-forte:heatmap-enable", handleEnable);

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:heatmap-toggle", handleToggle);
      window.removeEventListener("voto-forte:heatmap-enable", handleEnable);
      window.removeEventListener(
        "voto-forte:geocoding-complete",
        handleGeocodingComplete,
      );
      if (patchTimer) window.clearInterval(patchTimer);
      if (patchTimeout) window.clearTimeout(patchTimeout);
      clearLayer();
      const L = (window as any).L;
      if (L?.map?.__vfHeatmapPatched && originalMapFactory) L.map = originalMapFactory;
    };
  }, []);

  const toggleHeatmap = () => {
    const next = !enabled;
    setEnabled(next);
    enabledRef.current = next;

    if (next) {
      window.dispatchEvent(new Event("voto-forte:heatmap-enable"));
      return;
    }

    const map = mapRef.current;
    const layer = layerRef.current;
    if (map && layer && map.hasLayer(layer)) map.removeLayer(layer);
    layerRef.current = null;
  };

  if (!visible) return null;

  const loadedLabel = loadedMappedPoints.toLocaleString("pt-BR");
  const totalLabel = totalMappedPoints.toLocaleString("pt-BR");

  return (
    <aside className="vf-heatmap-control">
      <div>
        <small>CAMADA VISUAL</small>
        <strong>Mapa de calor</strong>
        <span>
          {loading
            ? "Carregando concentrações..."
            : truncated
              ? `${loadedLabel} de ${totalLabel} pontos exibidos para manter o mapa leve`
              : `${loadedLabel} ponto(s) mapeado(s) exibidos`}
        </span>
      </div>
      <button
        type="button"
        className={enabled ? "active" : ""}
        onClick={toggleHeatmap}
        disabled={loading}
      >
        {loading
          ? "Preparando mapa de calor..."
          : enabled
            ? "Desligar mapa de calor"
            : "Ligar mapa de calor"}
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
