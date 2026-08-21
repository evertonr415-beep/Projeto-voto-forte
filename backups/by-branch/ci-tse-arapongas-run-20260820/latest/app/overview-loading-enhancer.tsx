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
    <div class="vf-overview-loading__header">
      <div>
        <span>VISÃO GERAL</span>
        <h2>Preparando seu painel</h2>
        <p>Atualizando os dados exatos do ambiente…</p>
      </div>
    </div>
    <div class="kpis vf-overview-loading__kpis">
      <div class="kpi">
        <div class="kpi-icon green">♜</div>
        <div>
          <strong>—</strong>
          <b>Lideranças ativas</b>
          <small>Atualizando indicador</small>
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-icon blue">♙</div>
        <div>
          <strong>—</strong>
          <b>Eleitores cadastrados</b>
          <small>Atualizando indicador</small>
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-icon gold">⌖</div>
        <div>
          <strong>—</strong>
          <b>Bairros alcançados</b>
          <small>Atualizando indicador</small>
        </div>
      </div>
      <div class="kpi">
        <div class="kpi-icon violet">◫</div>
        <div>
          <strong>—</strong>
          <b>Reuniões agendadas</b>
          <small>Atualizando indicador</small>
        </div>
      </div>
    </div>
    <div class="vf-overview-loading__panels">
      <div class="panel vf-overview-loading__panel">
        <div class="vf-overview-loading__line vf-overview-loading__line--title"></div>
        <div class="vf-overview-loading__line"></div>
        <div class="vf-overview-loading__line vf-overview-loading__line--short"></div>
      </div>
      <div class="panel vf-overview-loading__panel">
        <div class="vf-overview-loading__line vf-overview-loading__line--title"></div>
        <div class="vf-overview-loading__line"></div>
        <div class="vf-overview-loading__line vf-overview-loading__line--short"></div>
      </div>
    </div>
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
      if (!loadingState.textContent?.includes("Carregando ambiente protegido")) return;

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
