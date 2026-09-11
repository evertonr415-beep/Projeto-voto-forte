"use client";

import { useEffect } from "react";

const VIEW_PARAM = "view";
const ALLOWED_VIEWS = new Set([
  "Visão Geral",
  "Mapa Eleitoral",
  "Painel Eleitoral",
  "WhatsApp",
  "Administração",
]);

export default function DashboardRouteViewEnhancer() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get(VIEW_PARAM);
    if (!requestedView || !ALLOWED_VIEWS.has(requestedView)) return;

    let done = false;
    let observer: MutationObserver | null = null;
    let frame = 0;

    const clearParam = () => {
      params.delete(VIEW_PARAM);
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    };

    const openView = () => {
      if (done) return true;
      const shell = document.querySelector<HTMLElement>(".app-shell");
      if (!shell) return false;

      const target = Array.from(
        shell.querySelectorAll<HTMLButtonElement>(".sidebar nav button"),
      ).find(
        (button) =>
          button.querySelector(".nav-name")?.textContent?.trim() === requestedView,
      );

      if (!target) return false;
      done = true;
      target.click();
      clearParam();
      observer?.disconnect();
      return true;
    };

    if (!openView()) {
      observer = new MutationObserver(openView);
      observer.observe(document.body, { childList: true, subtree: true });
      frame = window.requestAnimationFrame(openView);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return null;
}
