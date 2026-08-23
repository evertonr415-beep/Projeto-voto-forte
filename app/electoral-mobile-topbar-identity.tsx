"use client";

import { useEffect } from "react";

const HEADER_ATTR = "data-vf-electoral-mobile-header";
const BRAND_CLASS = "vf-electoral-mobile-header-brand";

export default function ElectoralMobileTopbarIdentity() {
  useEffect(() => {
    let disposed = false;
    let scheduled = false;

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
    };
  }, []);

  return null;
}
