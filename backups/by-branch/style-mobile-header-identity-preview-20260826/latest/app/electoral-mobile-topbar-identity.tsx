"use client";

import { useEffect } from "react";

const HEADER_ATTR = "data-vf-mobile-header-identity";
const BRAND_CLASS = "vf-mobile-header-brand";
const STYLE_ID = "vf-mobile-header-identity-style";

const MOBILE_HEADER_CSS = `
.${BRAND_CLASS} { display: none; }

@media (max-width: 760px) {
  .app-shell .topbar[${HEADER_ATTR}="true"] {
    min-height: 60px !important;
    height: auto !important;
    padding: 7px 10px !important;
    gap: 7px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id {
    display: flex !important;
    flex: 1 1 0 !important;
    align-items: center !important;
    min-width: 0 !important;
    gap: 6px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id > h1,
  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id > small {
    display: none !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id::after {
    content: none !important;
    display: none !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .${BRAND_CLASS} {
    display: flex !important;
    flex: 1 1 0 !important;
    align-items: center !important;
    min-width: 0 !important;
    gap: 7px !important;
    overflow: hidden !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-mobile-header-logo {
    flex: 0 0 30px !important;
    width: 30px !important;
    height: 30px !important;
    min-width: 30px !important;
    object-fit: cover !important;
    border-radius: 8px !important;
    border: 1px solid rgba(56, 189, 248, 0.32) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18) !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-mobile-header-title {
    display: block !important;
    min-width: 0 !important;
    overflow: hidden !important;
    color: inherit !important;
    font-size: 13px !important;
    line-height: 1.15 !important;
    font-weight: 850 !important;
    letter-spacing: -0.015em !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-header-scope {
    flex-shrink: 0 !important;
  }

  body:has(.tse-panel-root) .tse-panel-topbar {
    display: none !important;
  }
}

@media (max-width: 430px) {
  .app-shell .topbar[${HEADER_ATTR}="true"] {
    padding-inline: 8px !important;
    gap: 5px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .page-id,
  .app-shell .topbar[${HEADER_ATTR}="true"] .${BRAND_CLASS} {
    gap: 5px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-mobile-header-logo {
    flex-basis: 28px !important;
    width: 28px !important;
    height: 28px !important;
    min-width: 28px !important;
  }

  .app-shell .topbar[${HEADER_ATTR}="true"] .vf-mobile-header-title {
    font-size: 11.5px !important;
  }
}
`;

function normalizeTitle(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function getCurrentSectionTitle(topbar: HTMLElement) {
  if (document.querySelector(".tse-panel-root")) return "Painel Eleitoral";

  if (
    document.querySelector(
      '.management-filter[role="tablist"][aria-label="Seções administrativas"]',
    )
  ) {
    return "Administração";
  }

  const pageId = topbar.querySelector<HTMLElement>(".page-id");
  const heading = pageId?.querySelector<HTMLElement>("h1");
  const headingText = normalizeTitle(heading?.textContent);
  if (headingText) return headingText;

  const activeNavigation = document.querySelector<HTMLElement>(
    '.sidebar .active, .sidebar [aria-current="page"], nav .active, nav [aria-current="page"]',
  );
  const navigationText = normalizeTitle(activeNavigation?.textContent);
  if (navigationText) return navigationText;

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

      const topbar = document.querySelector<HTMLElement>(".app-shell .topbar");
      const pageId = topbar?.querySelector<HTMLElement>(".page-id");

      if (!topbar || !pageId) {
        cleanup();
        return;
      }

      ensureStyle();
      topbar.setAttribute(HEADER_ATTR, "true");

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
      attributeFilter: ["class", "aria-current", "aria-selected"],
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
