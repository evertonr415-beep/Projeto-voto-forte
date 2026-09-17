"use client";

import { useEffect } from "react";

const SAFE_AREA_CSS = `
:root {
  --vf-safe-top: env(safe-area-inset-top, 0px);
  --vf-safe-right: env(safe-area-inset-right, 0px);
  --vf-safe-bottom: env(safe-area-inset-bottom, 0px);
  --vf-safe-left: env(safe-area-inset-left, 0px);
}

@media (max-width: 760px) and (display-mode: standalone),
       (max-width: 760px) and (display-mode: fullscreen),
       (max-width: 760px) and (display-mode: minimal-ui) {
  html,
  body {
    min-height: 100%;
    background: #060d19;
  }

  body {
    min-height: 100dvh;
    overscroll-behavior-y: none;
  }

  .app-shell {
    min-height: 100dvh !important;
    padding-bottom: var(--vf-safe-bottom) !important;
  }

  .app-shell .topbar {
    box-sizing: border-box !important;
    padding-top: calc(8px + var(--vf-safe-top)) !important;
    padding-left: max(8px, var(--vf-safe-left)) !important;
    padding-right: max(8px, var(--vf-safe-right)) !important;
  }
}

@media (max-width: 760px) {
  html[data-vf-standalone="true"],
  html[data-vf-standalone="true"] body {
    min-height: 100%;
    background: #060d19;
  }

  html[data-vf-standalone="true"] body {
    min-height: 100dvh;
    overscroll-behavior-y: none;
  }

  html[data-vf-standalone="true"] .app-shell {
    min-height: 100dvh !important;
    padding-bottom: var(--vf-safe-bottom) !important;
  }

  html[data-vf-standalone="true"] .app-shell .topbar {
    box-sizing: border-box !important;
    padding-top: calc(8px + var(--vf-safe-top)) !important;
    padding-left: max(8px, var(--vf-safe-left)) !important;
    padding-right: max(8px, var(--vf-safe-right)) !important;
  }

  html[data-vf-standalone="true"] .app-shell .topbar,
  html[data-vf-standalone="true"] .app-shell .topbar * {
    -webkit-tap-highlight-color: transparent;
  }
}
`;

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export default function PwaInstaller() {
  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const fullscreenQuery = window.matchMedia("(display-mode: fullscreen)");
    const minimalUiQuery = window.matchMedia("(display-mode: minimal-ui)");

    const syncInstalledMode = () => {
      const iosStandalone = Boolean((navigator as NavigatorWithStandalone).standalone);
      const installed =
        iosStandalone ||
        standaloneQuery.matches ||
        fullscreenQuery.matches ||
        minimalUiQuery.matches;

      document.documentElement.dataset.vfStandalone = installed ? "true" : "false";
    };

    syncInstalledMode();
    standaloneQuery.addEventListener?.("change", syncInstalledMode);
    fullscreenQuery.addEventListener?.("change", syncInstalledMode);
    minimalUiQuery.addEventListener?.("change", syncInstalledMode);

    const registerServiceWorker = () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[VOTO FORTE PWA] Service Worker registrado:", reg.scope);
          })
          .catch((err) => {
            console.warn("[VOTO FORTE PWA] Falha ao registrar Service Worker:", err);
          });
      }
    };

    if (document.readyState === "complete") registerServiceWorker();
    else window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      standaloneQuery.removeEventListener?.("change", syncInstalledMode);
      fullscreenQuery.removeEventListener?.("change", syncInstalledMode);
      minimalUiQuery.removeEventListener?.("change", syncInstalledMode);
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: SAFE_AREA_CSS }} />;
}
