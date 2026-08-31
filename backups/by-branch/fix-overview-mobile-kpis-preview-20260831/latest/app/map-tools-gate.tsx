"use client";

import { useEffect, useState } from "react";
import MapCityMarkers from "./map-city-markers";
import MapContactLayer from "./map-contact-layer";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MobileMapControls from "./mobile-map-controls";
import TerritorialPendingCenter from "./territorial-pending-center";
import MapMobileCompactExperience from "./map-mobile-compact-experience";
import MapDesktopCompactExperience from "./map-desktop-compact-experience";
import { apiFetch } from "./supabase-client";

export default function MapToolsGate() {
  const [protectedAccessReady, setProtectedAccessReady] = useState(false);
  const [mapPresent, setMapPresent] = useState(false);
  const [isAdm, setIsAdm] = useState(false);

  useEffect(() => {
    const syncRuntimeState = () => {
      const ready = !document.querySelector(".auth-page");
      const hasMap = Boolean(document.querySelector(".workspace .full-map"));
      setProtectedAccessReady((current) => (current === ready ? current : ready));
      setMapPresent((current) => (current === hasMap ? current : hasMap));
    };

    const observer = new MutationObserver(syncRuntimeState);
    observer.observe(document.body, { childList: true, subtree: true });
    syncRuntimeState();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!protectedAccessReady) {
      setIsAdm(false);
      return;
    }

    let cancelled = false;
    void apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        setIsAdm(response.ok && data?.user?.accessRole === "adm");
      })
      .catch(() => {
        if (!cancelled) setIsAdm(false);
      });

    return () => {
      cancelled = true;
    };
  }, [protectedAccessReady]);

  return (
    <>
      {protectedAccessReady && <MapContactLayer />}
      {protectedAccessReady && <MapCityMarkers />}
      {protectedAccessReady && <MapTerritoryEnhancer />}
      {protectedAccessReady && <MobileMapControls />}
      {protectedAccessReady && mapPresent && <MapMobileCompactExperience isAdm={isAdm} />}
      {protectedAccessReady && mapPresent && <MapDesktopCompactExperience isAdm={isAdm} />}
      {protectedAccessReady && isAdm && <TerritorialPendingCenter />}
    </>
  );
}
