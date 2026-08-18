"use client";

import { useEffect, useState } from "react";
import MapContactLayer from "./map-contact-layer";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MobileMapControls from "./mobile-map-controls";
import TerritorialPendingCenter from "./territorial-pending-center";

export default function MapToolsGate() {
  const [protectedAccessReady, setProtectedAccessReady] = useState(false);

  useEffect(() => {
    const syncProtectedAccess = () => {
      const ready = !document.querySelector(".auth-page");
      setProtectedAccessReady((current) => (current === ready ? current : ready));
    };

    const observer = new MutationObserver(syncProtectedAccess);
    observer.observe(document.body, { childList: true, subtree: true });
    syncProtectedAccess();

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <MapContactLayer />
      {protectedAccessReady && <MapTerritoryEnhancer />}
      <MobileMapControls />
      {protectedAccessReady && <TerritorialPendingCenter />}
    </>
  );
}
