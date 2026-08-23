"use client";

import { useEffect } from "react";

const HEADER_ATTR = "data-vf-electoral-mobile-header";
const BRAND_CLASS = "vf-electoral-mobile-header-brand";
const STYLE_ID = "vf-electoral-mobile-header-style";

const MOBILE_HEADER_CSS = `
.${BRAND_CLASS} { display: none; }

@media (max-width: 760px) {
  .app-shell .topbar[${HEADER_ATTR}="true"] {
    min-height: 60px !important;
    height: auto !important;
    padding: 7px 10px !important;
    gap: 8px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id {
    display: flex !important;
    flex: 1 1 auto !important;
    align-items: center !important;
    min-width: 0 !important;
    gap: 8px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id > div:not(.${BRAND_CLASS}) {
    display: none !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .mobile-menu {
    flex: 0 0 38px !important;
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    margin: 0 !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .${BRAND_CLASS} {
    display: flex !important;
    flex: 1 1 auto !important;
    align-items: center !important;
    min-width: 0 !important;
    gap: 8px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-electoral-mobile-header-logo {
    flex: 0 0 30px !important;
    width: 30px !important;
    height: 30px !important;
    object-fit: cover !important;
    border-radius: 8px !important;
    border: 1px solid rgba(56, 189, 248, 0.28) !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-electoral-mobile-header-title {
    display: block !important;
    min-width: 0 !important;
    color: inherit !important;
    font-size: 11.5px !important;
    line-height: 1.18 !important;
    font-weight: 850 !important;
    letter-spacing: -0.01em !important;
    white-space: normal !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .top-actions {
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: 0 !important;
    margin: 0 !important;
    gap: 0 !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .notification,
  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-theme-toggle {
    display: none !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .profile {
    flex: 0 0 36px !important;
    width: 36px !important;
    min-width: 36px !important;
    max-width: 36px !important;
    margin: 0 !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .profile > span {
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .profile > div,
  .app-shell .topbar[${HEADER_ATTR}="true"] .profile > i {
    display: none !important;
  }

  body:has(.tse-panel-root) .tse-panel-topbar {
    display: none !important;
  }
}

@media (max-width: 390px) {
  .app-shell .topbar[${HEADER_ATTR}="true"] {
    padding-inline: 8px !important;
    gap: 6px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id {
    gap: 6px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-electoral-mobile-header-logo {
    flex-basis: 28px !important;
    width: 28px !important;
    height: 28px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-electoral-mobile-header-title {
    font-size: 10.5px !important;
  }
}
`;

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

      const electoralPanel = document.querySelector(".tse-panel-root");
      const topbar = document.querySelector<HTMLElement>(".app-shell .topbar");
      const pageId = topbar?.querySelector<HTMLElement>(".page-id");

      if (!electoralPanel || !topbar || !pageId) {
        cleanup();
        return;
      }

      ensureStyle();
      topbar.setAttribute(HEADER_ATTR, "true");

      let brand = pageId.querySelector<HTMLElement>(`:scope > .${BRAND_CLASS}`);
      if (!brand) {
        brand = document.createElement("div");
        brand.className = BRAND_CLASS;
        brand.setAttribute("aria-label", "Painel Eleitoral — Arapongas / PR");

        const image = document.createElement("img");
        image.src = "/voto-forte-bandeira-icon.jpg";
        image.alt = "Bandeira do Paraná";
        image.className = "vf-electoral-mobile-header-logo";

        const title = document.createElement("span");
        title.className = "vf-electoral-mobile-header-title";
        title.textContent = "Painel Eleitoral — Arapongas / PR";

        brand.append(image, title);
        pageId.appendChild(brand);
      }
    };

    const scheduleSync = () => {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
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
