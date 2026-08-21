"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MunicipalityContextEnhancer = dynamic(() => import("./municipality-context-enhancer"), { ssr: false });
const GestorAccessGate = dynamic(() => import("./gestor-access-gate"), { ssr: false });
const CompactOverviewScopeEnhancer = dynamic(() => import("./compact-overview-scope-enhancer"), { ssr: false });
const NetworkScopeLabelNormalizer = dynamic(() => import("./network-scope-label-normalizer"), { ssr: false });
const ThemeToggleEnhancer = dynamic(() => import("./theme-toggle-enhancer"), { ssr: false });
const ContactNavigationInterceptor = dynamic(() => import("./contact-navigation-interceptor"), { ssr: false });
const IntelligenceNavigation = dynamic(() => import("./intelligence-navigation"), { ssr: false });
const TseSidebarEnhancer = dynamic(() => import("./tse-sidebar-enhancer"), { ssr: false });
const ComunicacaoSidebarEnhancer = dynamic(() => import("./comunicacao-sidebar-enhancer"), { ssr: false });
const StandardBackNavigationEnhancer = dynamic(() => import("./standard-back-navigation-enhancer"), { ssr: false });

const MunicipalityFieldEnhancer = dynamic(() => import("./municipality-field-enhancer"), { ssr: false });
const AccountSettingsEnhancer = dynamic(() => import("./account-settings-enhancer"), { ssr: false });
const ImportCompletionEnhancer = dynamic(() => import("./import-completion-enhancer"), { ssr: false });
const ContactExportEnhancer = dynamic(() => import("./contact-export-enhancer"), { ssr: false });
const RuntimeVersionGuard = dynamic(() => import("./runtime-version-guard"), { ssr: false });
const SystemNotificationsDrawer = dynamic(() => import("./system-notifications-drawer"), { ssr: false });

const MunicipalElectoralMapContext = dynamic(() => import("./municipal-electoral-map-context"), { ssr: false });
const CepFallbackEnhancer = dynamic(() => import("./cep-fallback-enhancer"), { ssr: false });
const MapInstantContactBootstrap = dynamic(() => import("./map-instant-contact-bootstrap"), { ssr: false });
const MapToolsGate = dynamic(() => import("./map-tools-gate"), { ssr: false });
const MapNeighborhoodInfoEnhancer = dynamic(() => import("./map-neighborhood-info-enhancer"), { ssr: false });
const NeighborhoodInfoDrawer = dynamic(() => import("./neighborhood-info-drawer"), { ssr: false });
const AuthReconciliationEnhancer = dynamic(() => import("./auth-reconciliation-enhancer"), { ssr: false });
const TeamPerformanceAdminEnhancer = dynamic(() => import("./team-performance-admin-enhancer"), { ssr: false });
const WhaticketBroadcastDrawer = dynamic(() => import("./whaticket-broadcast-drawer"), { ssr: false });
const BroadcastNeighborhoodOptionsEnhancer = dynamic(() => import("./broadcast-neighborhood-options-enhancer"), { ssr: false });

const APP_READY_SELECTOR = ".app-shell, .tse-panel-root, .ae-root, .vf-ic-shell";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function DashboardRuntimeEnhancers() {
  const [ready, setReady] = useState(false);
  const [secondaryReady, setSecondaryReady] = useState(false);
  const [heavyReady, setHeavyReady] = useState(false);

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

  useEffect(() => {
    if (!ready) {
      setSecondaryReady(false);
      setHeavyReady(false);
      return;
    }

    const secondaryTimer = window.setTimeout(() => setSecondaryReady(true), 250);
    const idleWindow = window as IdleWindow;
    let idleHandle: number | null = null;
    let heavyTimer: number | null = null;

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleHandle = idleWindow.requestIdleCallback(() => setHeavyReady(true), { timeout: 1800 });
    } else {
      heavyTimer = window.setTimeout(() => setHeavyReady(true), 1200);
    }

    return () => {
      window.clearTimeout(secondaryTimer);
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      if (heavyTimer !== null) window.clearTimeout(heavyTimer);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      {/* Navegacao e contexto essencial entram primeiro para manter a UI clicavel. */}
      <MunicipalityContextEnhancer />
      <GestorAccessGate />
      <CompactOverviewScopeEnhancer />
      <NetworkScopeLabelNormalizer />
      <ThemeToggleEnhancer />
      <ContactNavigationInterceptor />
      <IntelligenceNavigation />
      <TseSidebarEnhancer />
      <ComunicacaoSidebarEnhancer />
      <StandardBackNavigationEnhancer />

      {/* Recursos secundarios entram logo depois, fora do primeiro frame do dashboard. */}
      {secondaryReady && (
        <>
          <MunicipalityFieldEnhancer />
          <AccountSettingsEnhancer />
          <ImportCompletionEnhancer />
          <ContactExportEnhancer />
          <RuntimeVersionGuard />
          <SystemNotificationsDrawer />
        </>
      )}

      {/* Modulos pesados e integrações aguardam o navegador ficar ocioso. */}
      {heavyReady && (
        <>
          <MunicipalElectoralMapContext />
          <CepFallbackEnhancer />
          <MapInstantContactBootstrap />
          <MapToolsGate />
          <MapNeighborhoodInfoEnhancer />
          <NeighborhoodInfoDrawer />
          <AuthReconciliationEnhancer />
          <TeamPerformanceAdminEnhancer />
          <WhaticketBroadcastDrawer />
          <BroadcastNeighborhoodOptionsEnhancer />
        </>
      )}
    </>
  );
}
