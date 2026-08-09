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

      .full-map.vf-mobile-map-ui .vf-map-contact-control {
        display: none !important;
        position: absolute !important;
        top: 193px !important;
        right: 58px !important;
        width: min(235px, calc(100vw - 92px)) !important;
        min-width: 0 !important;
        max-width: none !important;
        margin: 0 !important;
        z-index: 520 !important;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-contacts-open .vf-map-contact-control {
        display: block !important;
      }
      .full-map.vf-mobile-map-ui .vf-mobile-contacts-toggle {
        position: absolute;
        z-index: 530;
        right: 8px;
        top: 193px;
        min-width: 42px;
        height: 42px;
        padding: 0 10px;
        border: 0;
        border-radius: 12px;
        background: rgba(255,255,255,.97);
        color: #173f75;
        box-shadow: 0 5px 16px rgba(7,26,51,.24);
        font: 800 11px/1 Arial,sans-serif;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-contacts-open .vf-mobile-contacts-toggle {
        background: #173f75;
        color: #fff;
      }
      .full-map.vf-mobile-map-ui .vf-mobile-contacts-toggle .vf-mobile-contacts-label {
        display: none;
      }
      .full-map.vf-mobile-map-ui.vf-mobile-contacts-open .vf-mobile-contacts-toggle .vf-mobile-contacts-label {
        display: inline;
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
      const contactPanel = fullMap?.querySelector<HTMLElement>(".vf-map-contact-control");
      if (!fullMap || !toolbar || !status || buttons.length < 3 || !contactPanel) return false;

      fullMap.classList.add("vf-mobile-map-ui");
      fullMap.classList.remove("vf-mobile-contacts-open");
      const labels = ["Centralizar alfinetes", "Minha localização", "Arapongas"];
      const icons = ["⌖", "◎", "⌂"];
      buttons.slice(0, 3).forEach((button, index) => {
        button.dataset.vfIcon = icons[index];
        button.title = labels[index];
        button.setAttribute("aria-label", labels[index]);
      });

      const contactsToggle = document.createElement("button");
      contactsToggle.type = "button";
      contactsToggle.className = "vf-mobile-contacts-toggle";
      contactsToggle.innerHTML = '<span aria-hidden="true">👥</span><span class="vf-mobile-contacts-label">Contatos</span>';
      contactsToggle.title = "Abrir contatos no mapa";
      contactsToggle.setAttribute("aria-label", "Abrir contatos no mapa");
      contactsToggle.setAttribute("aria-expanded", "false");
      contactsToggle.addEventListener("click", () => {
        const open = fullMap.classList.toggle("vf-mobile-contacts-open");
        contactsToggle.title = open ? "Fechar contatos no mapa" : "Abrir contatos no mapa";
        contactsToggle.setAttribute("aria-label", contactsToggle.title);
        contactsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      fullMap.appendChild(contactsToggle);

      let applyingStatus = false;
      const syncStatus = () => {
        if (applyingStatus) return;
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
        contactsToggle.remove();
        fullMap.classList.remove("vf-mobile-map-ui", "vf-mobile-contacts-open");
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
