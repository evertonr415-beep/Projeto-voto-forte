"use client";

import { useEffect, useState } from "react";
import AgendaCalendarEnhancer from "./agenda-calendar-enhancer";
import ContactWhatsappQuickQueue from "./contact-whatsapp-quick-queue";
import MapContactLayer from "./map-contact-layer";
import MapTerritoryEnhancer from "./map-territory-enhancer";
import MobileMapControls from "./mobile-map-controls";
import NeighborhoodElectoralDrawer from "./neighborhood-electoral-drawer";
import TerritorialPendingCenter from "./territorial-pending-center";
import TseSidebarEnhancer from "./tse-sidebar-enhancer";

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
      {protectedAccessReady && <AgendaCalendarEnhancer />}
      {protectedAccessReady && <TseSidebarEnhancer />}
      {protectedAccessReady && <NeighborhoodElectoralDrawer />}
      {protectedAccessReady && <ContactWhatsappQuickQueue />}
      {protectedAccessReady && <MapContactLayer />}
      {protectedAccessReady && <MapTerritoryEnhancer />}
      {protectedAccessReady && <MobileMapControls />}
      {protectedAccessReady && <TerritorialPendingCenter />}
    </>
  );
}
