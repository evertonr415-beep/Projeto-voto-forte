"use client";

import { useEffect } from "react";

const HEADER_ATTR = "data-vf-mobile-header-identity";
const PRIMARY_HEADER_ATTR = "data-vf-mobile-compact-tab-header";
const BRAND_CLASS = "vf-mobile-header-brand";
const STYLE_ID = "vf-mobile-header-identity-style";

const MOBILE_HEADER_CSS = `
.${BRAND_CLASS} { display: none; }

@media (max-width: 760px) {
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] {
    box-sizing: border-box !important;
    display: flex !important;
    align-items: center !important;
    width: 100% !important;
    min-height: 58px !important;
    height: auto !important;
    padding: 7px 9px !important;
    gap: 6px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .mobile-menu {
    flex: 0 0 36px !important;
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    max-width: 36px !important;
    margin: 0 !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .page-id {
    display: flex !important;
    flex: 1 1 0 !important;
    align-items: center !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    gap: 6px !important;
    overflow: hidden !important;
  }

  /* A faixa mobile deve ter somente identidade + escopo. O bloco original do
     título continua no DOM para a lógica do sistema, mas não ocupa espaço. */
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"]
    .page-id > div:not(.${BRAND_CLASS}):not(.vf-header-scope) {
    display: none !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .page-id > h1,
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .page-id > small,
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .page-id > .vf-theme-toggle {
    display: none !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .page-id::after {
    content: none !important;
    display: none !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .${BRAND_CLASS} {
    display: flex !important;
    flex: 1 1 0 !important;
    align-items: center !important;
    min-width: 0 !important;
    gap: 6px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-mobile-header-logo {
    flex: 0 0 27px !important;
    width: 27px !important;
    height: 27px !important;
    min-width: 27px !important;
    max-width: 27px !important;
    object-fit: cover !important;
    border-radius: 7px !important;
    border: 1px solid rgba(56, 189, 248, 0.34) !important;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.16) !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-mobile-header-title {
    display: -webkit-box !important;
    min-width: 0 !important;
    overflow: hidden !important;
    color: inherit !important;
    font-size: 12px !important;
    line-height: 1.08 !important;
    font-weight: 850 !important;
    letter-spacing: -0.015em !important;
    white-space: normal !important;
    overflow-wrap: normal !important;
    -webkit-box-orient: vertical !important;
    -webkit-line-clamp: 2 !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-header-scope {
    display: inline-flex !important;
    flex: 0 0 118px !important;
    width: 118px !important;
    min-width: 118px !important;
    max-width: 118px !important;
    margin: 0 !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-header-scope-select-wrap {
    width: 118px !important;
    min-width: 118px !important;
    max-width: 118px !important;
  }

  /* Padronização aprovada: hambúrguer -> identidade -> escopo -> avatar.
     Controles auxiliares continuam funcionais no sistema, mas não disputam
     espaço com o cabeçalho compacto. */
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .top-actions {
    display: flex !important;
    flex: 0 0 auto !important;
    align-items: center !important;
    justify-content: flex-end !important;
    width: auto !important;
    min-width: 0 !important;
    margin: 0 !important;
    gap: 0 !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .top-actions > :not(.profile) {
    display: none !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .profile {
    display: flex !important;
    flex: 0 0 34px !important;
    width: 34px !important;
    min-width: 34px !important;
    max-width: 34px !important;
    margin: 0 !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .profile > span {
    width: 34px !important;
    height: 34px !important;
    min-width: 34px !important;
    max-width: 34px !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .profile > div,
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .profile > i {
    display: none !important;
  }

  body:has(.tse-panel-root) .tse-panel-topbar {
    display: none !important;
  }
}

@media (max-width: 430px) {
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] {
    padding-inline: 8px !important;
    gap: 5px !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .page-id,
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .${BRAND_CLASS} {
    gap: 5px !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-mobile-header-logo {
    flex-basis: 26px !important;
    width: 26px !important;
    height: 26px !important;
    min-width: 26px !important;
    max-width: 26px !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-mobile-header-title {
    font-size: 11px !important;
  }
}

@media (max-width: 360px) {
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-header-scope,
  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-header-scope-select-wrap {
    flex-basis: 108px !important;
    width: 108px !important;
    min-width: 108px !important;
    max-width: 108px !important;
  }

  .app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"][${HEADER_ATTR}="true"] .vf-mobile-header-title {
    font-size: 10px !important;
  }
}
`;

function normalizeTitle(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function getCurrentSectionTitle(topbar: HTMLElement) {
  const pageId = topbar.querySelector<HTMLElement>(".page-id");
  const heading = pageId?.querySelector<HTMLElement>("h1");
  const headingText = normalizeTitle(heading?.textContent);

  if (headingText) return headingText;
  if (document.querySelector(".tse-panel-root")) return "Painel Eleitoral";
  return "Voto Forte";
}

export default function ElectoralMobileTopbarIdentity() {
  useEffect(() => {
    let disposed = false;
    let scheduled = false;

    const ensureStyle = () => {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = MOBILE_HEADER_CSS;
      document.head.appendChild(style);
    };

    const cleanup = () => {
      document
        .querySelectorAll<HTMLElement>(`.topbar[${HEADER_ATTR}="true"]`)
        .forEach((topbar) => topbar.removeAttribute(HEADER_ATTR));
      document
        .querySelectorAll<HTMLElement>(`.${BRAND_CLASS}`)
        .forEach((brand) => brand.remove());
    };

    const sync = () => {
      scheduled = false;
      if (disposed) return;

      const topbar = document.querySelector<HTMLElement>(
        `.app-shell .topbar[${PRIMARY_HEADER_ATTR}="true"]`,
      );
      const pageId = topbar?.querySelector<HTMLElement>(".page-id");
      const isMobile = window.matchMedia("(max-width: 760px)").matches;

      if (!isMobile || !topbar || !pageId) {
        cleanup();
        return;
      }

      ensureStyle();
      if (topbar.getAttribute(HEADER_ATTR) !== "true") {
        topbar.setAttribute(HEADER_ATTR, "true");
      }

      const titleText = getCurrentSectionTitle(topbar);
      let brand = pageId.querySelector<HTMLElement>(`:scope > .${BRAND_CLASS}`);

      if (!brand) {
        brand = document.createElement("div");
        brand.className = BRAND_CLASS;

        const image = document.createElement("img");
        image.src = "/parana-icon-small.jpg";
        image.alt = "Bandeira do Paraná";
        image.className = "vf-mobile-header-logo";

        const title = document.createElement("span");
        title.className = "vf-mobile-header-title";

        brand.append(image, title);
        pageId.prepend(brand);
      }

      brand.setAttribute("aria-label", `${titleText} — Paraná`);
      const title = brand.querySelector<HTMLElement>(".vf-mobile-header-title");
      if (title && title.textContent !== titleText) title.textContent = titleText;
    };

    const scheduleSync = () => {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [PRIMARY_HEADER_ATTR, "class"],
    });
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
      cleanup();
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  return null;
}
