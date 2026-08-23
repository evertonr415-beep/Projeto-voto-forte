"use client";

import { useEffect } from "react";

function isLegacyDashboardPath() {
  return (
    window.location.pathname === "/" ||
    window.location.pathname.startsWith("/sistema-completo")
  );
}

const OVERVIEW_LOADING_MARKUP = `
  <section class="vf-overview-loading" aria-live="polite" aria-busy="true">
    <div class="vf-overview-loading__visual" aria-hidden="true">
      <span class="vf-overview-loading__orbit vf-overview-loading__orbit--one"></span>
      <span class="vf-overview-loading__orbit vf-overview-loading__orbit--two"></span>
      <img class="vf-overview-loading__map" src="/parana-loading.webp" alt="" decoding="async" fetchpriority="high" />
    </div>
    <div class="vf-overview-loading__spinner" aria-hidden="true"></div>
    <p class="vf-overview-loading__label">Carregando indicadores...</p>
  </section>
`;

export default function OverviewLoadingEnhancer() {
  useEffect(() => {
    if (!isLegacyDashboardPath()) return;

    let frameId = 0;
    const decorateLoadingState = () => {
      if (document.querySelector(".welcome-pro, .kpis, .dashboard")) {
        observer.disconnect();
        return;
      }
      const loadingState = document.querySelector<HTMLElement>(".loading-state");
      if (!loadingState || loadingState.dataset.vfOverviewSkeleton === "1") return;
      const text = loadingState.textContent || "";
      if (!text.includes("Carregando ambiente protegido") && !text.includes("Carregando indicadores")) return;

      loadingState.dataset.vfOverviewSkeleton = "1";
      loadingState.classList.add("vf-overview-loading-state");
      loadingState.innerHTML = OVERVIEW_LOADING_MARKUP;
    };

    decorateLoadingState();
    const observer = new MutationObserver(() => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        decorateLoadingState();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return null;
}
