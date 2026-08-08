"use client";

import { useEffect, useState } from "react";
import MobileMapLayersToggle from "./mobile-map-layers-toggle";
import MobileAnalyticsControls from "./mobile-analytics-controls";
import LegacyContactGeocoder from "./legacy-contact-geocoder";
import SafeMapContactTools from "./safe-map-contact-tools";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MapGeocodingPanel from "./map-geocoding-panel";
import MapDistrictFilter from "./map-district-filter";
import MapHeatmapEnhancer from "./map-heatmap-enhancer";
import MapDistrictSummary from "./map-district-summary";
import MapPriorityPanel from "./map-priority-panel";
import MapStrategyInsights from "./map-strategy-insights";
import ExecutiveDashboard from "./executive-dashboard";
import DataQualityPanel from "./data-quality-panel";

function isElectoralMapView() {
  const hasElectoralMapHeading = Array.from(
    document.querySelectorAll("h1, h2, h3"),
  ).some(
    (element) =>
      element.textContent?.trim().toLocaleLowerCase("pt-BR") === "mapa eleitoral",
  );

  return (
    hasElectoralMapHeading &&
    Boolean(document.querySelector(".leaflet-container"))
  );
}

export default function MapToolsGate() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const sync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        setEnabled(isElectoralMapView());
      });
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <MobileMapLayersToggle />
      <MobileAnalyticsControls />
      <LegacyContactGeocoder />
      <SafeMapContactTools />
      <MapTerritoryEnhancer />
      <MapGeocodingPanel />
      <MapDistrictFilter />
      <MapHeatmapEnhancer />
      <MapDistrictSummary />
      <MapPriorityPanel />
      <MapStrategyInsights />
      <ExecutiveDashboard />
      <DataQualityPanel />
    </>
  );
}
