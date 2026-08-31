"use client";

import { useEffect, useState } from "react";
import MunicipalityFieldEnhancer from "./municipality-field-enhancer";
import MunicipalityContextEnhancer from "./municipality-context-enhancer";
import MunicipalElectoralMapIbgeAuthority from "./municipal-electoral-map-ibge-authority";
import MunicipalElectoralMapContext from "./municipal-electoral-map-context";
import MapMultimunicipalityDistrictOverlay from "./map-multimunicipality-district-overlay";
import CepFallbackEnhancer from "./cep-fallback-enhancer";
import MapInstantContactBootstrap from "./map-instant-contact-bootstrap";
import MapToolsGate from "./map-tools-gate";
import MapNeighborhoodInfoEnhancer from "./map-neighborhood-info-enhancer";
import NeighborhoodInfoDrawer from "./neighborhood-info-drawer";
import AccountSettingsEnhancer from "./account-settings-enhancer";
import ContactNavigationInterceptor from "./contact-navigation-interceptor";
import ContactsOfficialShellBridge from "./contacts-official-shell-bridge";
import ImportCompletionEnhancer from "./import-completion-enhancer";
import ContactExportEnhancer from "./contact-export-enhancer";
import IntelligenceNavigation from "./intelligence-navigation";
import GestorAccessGate from "./gestor-access-gate";
import CompactOverviewScopeEnhancer from "./compact-overview-scope-enhancer";
import NetworkScopeLabelNormalizer from "./network-scope-label-normalizer";
import RuntimeVersionGuard from "./runtime-version-guard";
import AuthReconciliationEnhancer from "./auth-reconciliation-enhancer";
import TeamPerformanceAdminEnhancer from "./team-performance-admin-enhancer";
import WhaticketBroadcastDrawer from "./whaticket-broadcast-drawer";
import BroadcastNeighborhoodOptionsEnhancer from "./broadcast-neighborhood-options-enhancer";
import TseSidebarEnhancer from "./tse-sidebar-enhancer";
import ComunicacaoSidebarEnhancer from "./comunicacao-sidebar-enhancer";
import SystemNotificationsDrawer from "./system-notifications-drawer";
import StandardBackNavigationEnhancer from "./standard-back-navigation-enhancer";
import AgendaMobileCompactEnhancer from "./agenda-mobile-compact-enhancer";
import AgendaDesktopNewEventFallback from "./agenda-desktop-new-event-fallback";
import ElectoralMobileTopbarIdentity from "./electoral-mobile-topbar-identity";
import ElectoralDesktopTopbarIdentity from "./electoral-desktop-topbar-identity";

const APP_READY_SELECTOR = ".app-shell, .tse-panel-root, .ae-root, .vf-ic-shell";

export default function DashboardRuntimeEnhancers() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      const nextReady = Boolean(document.querySelector(APP_READY_SELECTOR));
      setReady((current) => (current === nextReady ? current : nextReady));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <NetworkScopeLabelNormalizer />
      {ready ? (
        <>
          <MunicipalityContextEnhancer />
          <MunicipalityFieldEnhancer />
          <MunicipalElectoralMapIbgeAuthority />
          <MunicipalElectoralMapContext />
          <MapMultimunicipalityDistrictOverlay />
          <CepFallbackEnhancer />
          <MapInstantContactBootstrap />
          <MapToolsGate />
          <MapNeighborhoodInfoEnhancer />
          <NeighborhoodInfoDrawer />
          <GestorAccessGate />
          <CompactOverviewScopeEnhancer />
          <ContactsOfficialShellBridge />
          <ElectoralMobileTopbarIdentity />
          <ElectoralDesktopTopbarIdentity />
          <AccountSettingsEnhancer />
          <ContactNavigationInterceptor />
          <ImportCompletionEnhancer />
          <ContactExportEnhancer />
          <IntelligenceNavigation />
          <AuthReconciliationEnhancer />
          <TeamPerformanceAdminEnhancer />
          <RuntimeVersionGuard />
          <WhaticketBroadcastDrawer />
          <BroadcastNeighborhoodOptionsEnhancer />
          <TseSidebarEnhancer />
          <ComunicacaoSidebarEnhancer />
          <StandardBackNavigationEnhancer />
          <AgendaMobileCompactEnhancer />
          <AgendaDesktopNewEventFallback />
          <SystemNotificationsDrawer />
        </>
      ) : null}
    </>
  );
}
