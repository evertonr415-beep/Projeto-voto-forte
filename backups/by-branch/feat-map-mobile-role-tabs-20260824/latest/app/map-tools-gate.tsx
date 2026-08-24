"use client";

import { useEffect, useState } from "react";
import MapCityMarkers from "./map-city-markers";
import MapContactLayer from "./map-contact-layer";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MobileMapControls from "./mobile-map-controls";
import MapMobileRoleLayout from "./map-mobile-role-layout";
import TerritorialPendingCenter from "./territorial-pending-center";
import { apiFetch } from "./supabase-client";

export default function MapToolsGate() {
  const [protectedAccessReady, setProtectedAccessReady] = useState(false);
  const [isAdm, setIsAdm] = useState(false);

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
      {protectedAccessReady && <MapMobileRoleLayout isAdm={isAdm} />}
      {protectedAccessReady && isAdm && <TerritorialPendingCenter />}
    </>
  );
}
