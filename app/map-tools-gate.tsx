"use client";

import MapContactLayer from "./map-contact-layer";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MobileMapControls from "./mobile-map-controls";

export default function MapToolsGate() {
  return (
    <>
      <MapContactLayer />
      <MapTerritoryEnhancer />
      <MobileMapControls />
    </>
  );
}
