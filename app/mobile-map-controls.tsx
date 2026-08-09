"use client";

import { useLayoutEffect } from "react";

const STYLE_ID = "vf-mobile-map-controls-style";
const MOBILE_QUERY = "(max-width: 760px)";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 760px) {
      .full-map.vf-mobile-map-ui .real-map-toolbar {
        top: 8px !important;
        left: 8px !important;
        right: 8px !important;
        display: block !important;
        height: 0 !important;
        pointer-events: none !important;
      }
      .full-map.vf-mobile-map-ui .real-map-toolbar > div {
        display: inline-flex !important;
        align-items: center !important;
        width: auto !important;
        max-width: calc(100% - 58px) !important;
        min-height: 34px !important;
        margin: 0 !important;
        padding: 8px 11px !important;
        border-radius: 999px !important;
        pointer-events: auto !important;
      }
      .full-map.vf-mobile-map-ui .real-map-toolbar strong {
        max-width: 100% !important;
        margin: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 8px !important;
        line-height: 1.1 !important;
      }
      .full-map.vf-mobile-map-ui .real-map-toolbar small {
        display: none !important;
      }
      .full-map.vf-mobile-map-ui .real-map-toolbar button {
        position: absolute !important;
        right: 0 !important;
        width: 42px !important;
        height: 42px !important;
        padding: 0 !important;
        border-radius: 12px !important;
        display: grid !important;
        place-items: center !important;
        font-size: 0 !important;
        pointer-events: auto !important;
      }
      .full-map.vf-mobile-map-ui .real-map-toolbar button::before {
        content: attr(data-vf-icon);
        font-size: 18px !important;
        line-height: 1 !important;
      }
      .full-map.vf-mobile-map-ui .real-map-toolbar button:nth-of-type(1) { top: 44px !important; }
      .full-map.vf-mobile-map-ui .real-map-toolbar button:nth-of-type(2) { top: 91px !important; }
      .full-map.vf-mobile-map-ui .real-map-toolbar button:nth-of-type(3) { top: 138px !important; }

      .full-map.vf-mobile-map-ui .map-legend {
        display: none !important;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-legend-open .map-legend {
        display: block !important;
        top: 232px !important;
        left: auto !important;
        right: 8px !important;
        width: min(210px, calc(100% - 72px)) !important;
        padding: 10px 12px !important;
        border-radius: 12px !important;
        z-index: 520 !important;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-legend-open .map-legend h4 {
        margin-bottom: 8px !important;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-legend-open .map-legend label {
        margin: 7px 0 !important;
        font-size: 8px !important;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-legend-open .map-legend > strong {
        font-size: 15px !important;
      }
      .full-map.vf-mobile-map-ui .vf-mobile-legend-toggle {
        position: absolute;
        z-index: 520;
        right: 8px;
        top: 193px;
        width: 42px;
        height: 34px;
        border: 0;
        border-radius: 10px;
        background: rgba(255,255,255,.96);
        color: #173f75;
        box-shadow: 0 5px 16px rgba(7,26,51,.24);
        font: 900 14px/1 Arial,sans-serif;
        cursor: pointer;
      }
      .full-map.vf-mobile-map-ui .leaflet-control-zoom {
        margin-top: 58px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function shortStatus(text: string) {
  const match = text.match(/^(\d+)\s+ponto\(s\)\s+de\s+bairro\s+visíveis/i);
  if (match) return `${match[1]} bairros visíveis · ⓘ`;
  if (/sem referências territoriais/i.test(text)) return "Bairros sem referência · ⓘ";
  return text;
}

export default function MobileMapControls() {
  useLayoutEffect(() => {
    installStyles();
    const media = window.matchMedia(MOBILE_QUERY);
    let cleanupCurrent: (() => void) | null = null;
    let retry: number | null = null;

    const attach = () => {
      cleanupCurrent?.();
      cleanupCurrent = null;
      if (!media.matches) return false;

      const fullMap = document.querySelector<HTMLElement>(".full-map");
      const toolbar = fullMap?.querySelector<HTMLElement>(".real-map-toolbar");
      const status = toolbar?.querySelector<HTMLElement>("strong");
      const buttons = toolbar ? Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button")) : [];
      const legend = fullMap?.querySelector<HTMLElement>(".map-legend");
      if (!fullMap || !toolbar || !status || buttons.length < 3 || !legend) return false;

      fullMap.classList.add("vf-mobile-map-ui");
      const labels = ["Centralizar alfinetes", "Minha localização", "Arapongas"];
      const icons = ["⌖", "◎", "⌂"];
      buttons.slice(0, 3).forEach((button, index) => {
        button.dataset.vfIcon = icons[index];
        button.title = labels[index];
        button.setAttribute("aria-label", labels[index]);
      });

      const legendToggle = document.createElement("button");
      legendToggle.type = "button";
      legendToggle.className = "vf-mobile-legend-toggle";
      legendToggle.textContent = "☰";
      legendToggle.title = "Abrir legenda do mapa";
      legendToggle.setAttribute("aria-label", "Abrir legenda do mapa");
      legendToggle.setAttribute("aria-expanded", "false");
      legendToggle.addEventListener("click", () => {
        const open = fullMap.classList.toggle("vf-mobile-legend-open");
        legendToggle.textContent = open ? "×" : "☰";
        legendToggle.title = open ? "Fechar legenda do mapa" : "Abrir legenda do mapa";
        legendToggle.setAttribute("aria-label", legendToggle.title);
        legendToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      fullMap.appendChild(legendToggle);

      let applyingStatus = false;
      const syncStatus = () => {
        if (applyingStatus) return;
        const full = status.dataset.vfFullStatus || status.textContent || "";
        const current = status.textContent || "";
        if (!status.dataset.vfFullStatus || current !== shortStatus(status.dataset.vfFullStatus)) {
          status.dataset.vfFullStatus = current;
        }
        const shortened = shortStatus(status.dataset.vfFullStatus || current);
        if (status.textContent !== shortened) {
          applyingStatus = true;
          status.textContent = shortened;
          applyingStatus = false;
        }
        status.title = status.dataset.vfFullStatus || current;
      };
      syncStatus();
      const observer = new MutationObserver(() => {
        if (!applyingStatus) {
          const current = status.textContent || "";
          if (current && current !== shortStatus(status.dataset.vfFullStatus || "")) {
            status.dataset.vfFullStatus = current;
          }
          syncStatus();
        }
      });
      observer.observe(status, { childList: true, characterData: true, subtree: true });

      cleanupCurrent = () => {
        observer.disconnect();
        legendToggle.remove();
        fullMap.classList.remove("vf-mobile-map-ui", "vf-mobile-legend-open");
        buttons.slice(0, 3).forEach((button) => {
          delete button.dataset.vfIcon;
        });
        if (status.dataset.vfFullStatus) {
          status.textContent = status.dataset.vfFullStatus;
          delete status.dataset.vfFullStatus;
        }
      };
      return true;
    };

    const handleResize = () => attach();
    media.addEventListener("change", handleResize);
    if (!attach()) {
      retry = window.setInterval(() => {
        if (attach() && retry !== null) {
          window.clearInterval(retry);
          retry = null;
        }
      }, 150);
      window.setTimeout(() => {
        if (retry !== null) {
          window.clearInterval(retry);
          retry = null;
        }
      }, 12_000);
    }

    return () => {
      media.removeEventListener("change", handleResize);
      if (retry !== null) window.clearInterval(retry);
      cleanupCurrent?.();
    };
  }, []);

  return null;
}
