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

function hasMap() {
  return Boolean(document.querySelector(".leaflet-container"));
}

export default function MapToolsGate() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (hasMap()) {
      setEnabled(true);
      return;
    }

    const observer = new MutationObserver(() => {
      if (!hasMap()) return;
      observer.disconnect();
      setEnabled(true);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const timeout = window.setTimeout(() => observer.disconnect(), 15_000);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
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
