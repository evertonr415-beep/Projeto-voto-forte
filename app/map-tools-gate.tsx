"use client";

import MapContactLayer from "./map-contact-layer";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MobileMapControls from "./mobile-map-controls";
import TerritorialPendingCenter from "./territorial-pending-center";

export default function MapToolsGate() {
  return (
    <>
      <MapContactLayer />
      <MapTerritoryEnhancer />
      <MobileMapControls />
      <TerritorialPendingCenter />
    </>
  );
}
