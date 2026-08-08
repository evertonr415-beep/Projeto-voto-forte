"use client";

import { useEffect, useState } from "react";
import MapContactLayer from "./map-contact-layer";
import MobileMapLayersToggle from "./mobile-map-layers-toggle";
import MobileAnalyticsControls from "./mobile-analytics-controls";
import LegacyContactGeocoder from "./legacy-contact-geocoder";
import SafeMapContactTools from "./safe-map-contact-tools";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MapGeocodingPanel from "./map-geocoding-panel";
import MapDistrictFilter from "./map-district-filter";
import MapHeatmapEnhancer from "./map-heatmap-enhancer";
import MapDistrictSummary from "./map-district-summary";
import ExecutiveDashboard from "./executive-dashboard";
import DataQualityPanel from "./data-quality-panel";

function isElectoralMapView() {
  const pageTitle = document
    .querySelector<HTMLElement>(".topbar .page-id h1")
    ?.textContent?.trim()
    .toLocaleLowerCase("pt-BR");
  const workspaceTitle = Array.from(
    document.querySelectorAll<HTMLElement>(".workspace h2"),
  ).some(
    (element) =>
      element.textContent?.trim().toLocaleLowerCase("pt-BR") ===
      "mapa eleitoral de arapongas",
  );

  return (
    (pageTitle === "mapa eleitoral" || workspaceTitle) &&
    Boolean(document.querySelector(".workspace .leaflet-container"))
  );
}

export default function MapToolsGate() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let frame: number | null = null;
    let retryTimer: number | null = null;
    let workspaceObserver: MutationObserver | null = null;
    let bootstrapObserver: MutationObserver | null = null;

    const sync = () => {
      frame = null;
      setEnabled(isElectoralMapView());
    };

    const scheduleSync = () => {
      if (frame === null) frame = window.requestAnimationFrame(sync);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        setEnabled(isElectoralMapView());
      }, 180);
    };

    const attachWorkspaceObserver = () => {
      const workspace = document.querySelector<HTMLElement>(".workspace");
      if (!workspace) return false;

      workspaceObserver?.disconnect();
      workspaceObserver = new MutationObserver(scheduleSync);
      workspaceObserver.observe(workspace, {
        childList: true,
        subtree: false,
      });
      scheduleSync();
      return true;
    };

    if (!attachWorkspaceObserver()) {
      bootstrapObserver = new MutationObserver(() => {
        if (!attachWorkspaceObserver()) return;
        bootstrapObserver?.disconnect();
        bootstrapObserver = null;
      });
      bootstrapObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener("popstate", scheduleSync);

    return () => {
      workspaceObserver?.disconnect();
      bootstrapObserver?.disconnect();
      window.removeEventListener("popstate", scheduleSync);
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, []);

  return (
    <>
      <MapContactLayer />
      <MapTerritoryEnhancer />
      {enabled && (
        <>
          <MobileMapLayersToggle />
          <MobileAnalyticsControls />
          <LegacyContactGeocoder />
          <SafeMapContactTools />
          <MapGeocodingPanel />
          <MapDistrictFilter />
          <MapHeatmapEnhancer />
          <MapDistrictSummary />
          <ExecutiveDashboard />
          <DataQualityPanel />
        </>
      )}
    </>
  );
}
