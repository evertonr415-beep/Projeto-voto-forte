"use client";

import { useEffect } from "react";

const MEDIA = "(min-width: 1024px)";
const HEADER_ATTR = "data-vf-desktop-header-identity";
const BRAND_CLASS = "vf-desktop-header-brand";

function normalizeTitle(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isSpecialShell(shell: HTMLElement) {
  return (
    shell.classList.contains("vf-agenda-official-shell") ||
    shell.classList.contains("vf-export-official-shell")
  );
}

export default function ElectoralDesktopTopbarIdentity() {
  useEffect(() => {
    const media = window.matchMedia(MEDIA);
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
      if (!media.matches) {
        cleanup();
        return;
      }

      document.querySelectorAll<HTMLElement>(".app-shell").forEach((shell) => {
        if (isSpecialShell(shell)) return;
        const topbar = shell.querySelector<HTMLElement>(":scope > .main > .topbar");
        const pageId = topbar?.querySelector<HTMLElement>(":scope > .page-id");
        const heading = pageId?.querySelector<HTMLElement>("h1");
        const titleText = normalizeTitle(heading?.textContent);
        if (!topbar || !pageId || !titleText) return;

        topbar.setAttribute(HEADER_ATTR, "true");
        let brand = pageId.querySelector<HTMLElement>(`:scope > .${BRAND_CLASS}`);
        if (!brand) {
          brand = document.createElement("div");
          brand.className = BRAND_CLASS;

          const image = document.createElement("img");
          image.src = "/voto-forte-bandeira-icon.jpg";
          image.alt = "Paraná";
          image.className = "vf-desktop-header-logo";

          const label = document.createElement("span");
          label.className = "vf-desktop-header-title";
          brand.append(image, label);

          const mobileMenu = pageId.querySelector<HTMLElement>(":scope > .mobile-menu");
          if (mobileMenu) mobileMenu.insertAdjacentElement("afterend", brand);
          else pageId.prepend(brand);
        }

        const label = brand.querySelector<HTMLElement>(".vf-desktop-header-title");
        if (label && label.textContent !== titleText) label.textContent = titleText;
      });
    };

    const schedule = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    media.addEventListener("change", schedule);

    return () => {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", schedule);
      cleanup();
    };
  }, []);

  return null;
}
