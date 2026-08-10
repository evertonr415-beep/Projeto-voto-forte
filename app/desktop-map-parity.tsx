"use client";

import { useLayoutEffect } from "react";

const DESKTOP_QUERY = "(min-width: 761px)";

function initializeDistrictCard(node: HTMLElement) {
  if (node.dataset.vfDesktopParityReady === "true") return;
  node.dataset.vfDesktopParityReady = "true";
  node.dataset.collapsed = "true";

  const toggle = node.querySelector<HTMLButtonElement>(".vf-district-map-toggle");
  if (!toggle) return;
  toggle.textContent = "+";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Abrir contatos por bairro");
}

export default function DesktopMapParity() {
  useLayoutEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);

    const sync = () => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(".vf-district-map-control"),
      );

      if (!media.matches) {
        cards.forEach((card) => delete card.dataset.vfDesktopParityReady);
        return;
      }

      cards.forEach(initializeDistrictCard);
    };

    let frame: number | null = null;
    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        sync();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", scheduleSync);
    sync();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", scheduleSync);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
