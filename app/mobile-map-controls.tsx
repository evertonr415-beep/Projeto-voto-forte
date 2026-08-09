"use client";

import { useLayoutEffect } from "react";

const STYLE_ID = "vf-mobile-map-controls-style";
const MOBILE_QUERY = "(max-width: 760px)";

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vf-map-pin.voter {
      width: 22px !important;
      height: 22px !important;
      margin: 4px 0 0 4px;
    }
    .vf-map-pin.voter i {
      font-size: 9px !important;
    }
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
      .full-map.vf-mobile-map-ui .real-map-toolbar button:nth-of-type(3) { display: none !important; }

      .full-map.vf-mobile-map-ui .map-legend {
        display: none !important;
      }

      .vf-mobile-contacts-host {
        display: none;
        width: 100%;
        margin: -2px 0 14px;
      }
      .vf-mobile-contacts-host.vf-mobile-contacts-open {
        display: block;
      }
      .vf-mobile-contacts-host .vf-map-contact-control {
        display: block !important;
        position: relative !important;
        top: auto !important;
        right: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        margin: 0 !important;
        z-index: auto !important;
        box-sizing: border-box !important;
      }
      .vf-mobile-district-host {
        display: block;
        width: 100%;
        margin: 0 0 14px;
      }
      .vf-mobile-district-host .vf-district-map-control {
        display: block !important;
        position: relative !important;
        width: 100% !important;
        max-width: none !important;
        min-width: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      }
      .page-head .vf-mobile-page-contacts-toggle[aria-expanded="true"] {
        box-shadow: 0 8px 24px rgba(157, 101, 12, .24);
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
      const districtPanel = fullMap?.querySelector<HTMLElement>(".vf-district-map-control");
      const pageHead =
        fullMap?.previousElementSibling instanceof HTMLElement &&
        fullMap.previousElementSibling.classList.contains("page-head")
          ? fullMap.previousElementSibling
          : document.querySelector<HTMLElement>(".page-head");
      const pageAction = pageHead?.querySelector<HTMLButtonElement>(":scope > button");
      if (
        !fullMap ||
        !toolbar ||
        !status ||
        buttons.length < 3 ||
        !contactPanel ||
        !districtPanel ||
        !pageHead ||
        !pageAction
      ) {
        return false;
      }

      fullMap.classList.add("vf-mobile-map-ui");
      fullMap.classList.remove("vf-mobile-contacts-open");
      const labels = ["Centralizar alfinetes", "Minha localização", "Arapongas"];
      const icons = ["⌖", "◎", "⌂"];
      buttons.slice(0, 3).forEach((button, index) => {
        button.dataset.vfIcon = icons[index];
        button.title = labels[index];
        button.setAttribute("aria-label", labels[index]);
      });
      const homeButton = buttons[2];
      const originalHomeAriaHidden = homeButton.getAttribute("aria-hidden");
      const originalHomeTabIndex = homeButton.getAttribute("tabindex");
      homeButton.setAttribute("aria-hidden", "true");
      homeButton.tabIndex = -1;

      const originalPanelParent = contactPanel.parentNode;
      const originalPanelNextSibling = contactPanel.nextSibling;
      const contactsHost = document.createElement("div");
      contactsHost.className = "vf-mobile-contacts-host";
      pageHead.insertAdjacentElement("afterend", contactsHost);
      contactsHost.appendChild(contactPanel);

      const originalDistrictParent = districtPanel.parentNode;
      const originalDistrictNextSibling = districtPanel.nextSibling;
      const districtHost = document.createElement("div");
      districtHost.className = "vf-mobile-district-host";
      contactsHost.insertAdjacentElement("afterend", districtHost);
      districtHost.appendChild(districtPanel);

      const originalActionText = pageAction.textContent || "Filtros do mapa";
      const originalActionTitle = pageAction.getAttribute("title");
      const originalActionAriaLabel = pageAction.getAttribute("aria-label");
      const originalActionAriaExpanded = pageAction.getAttribute("aria-expanded");
      pageAction.classList.add("vf-mobile-page-contacts-toggle");
      pageAction.textContent = "👥 Contatos";
      pageAction.title = "Abrir contatos no mapa";
      pageAction.setAttribute("aria-label", "Abrir contatos no mapa");
      pageAction.setAttribute("aria-expanded", "false");

      const setContactsOpen = (open: boolean) => {
        contactsHost.classList.toggle("vf-mobile-contacts-open", open);
        pageAction.textContent = open ? "× Contatos" : "👥 Contatos";
        pageAction.title = open ? "Fechar contatos no mapa" : "Abrir contatos no mapa";
        pageAction.setAttribute("aria-label", pageAction.title);
        pageAction.setAttribute("aria-expanded", open ? "true" : "false");
      };

      const handleContactsToggle = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setContactsOpen(!contactsHost.classList.contains("vf-mobile-contacts-open"));
      };
      pageAction.addEventListener("click", handleContactsToggle, true);

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
        pageAction.removeEventListener("click", handleContactsToggle, true);
        pageAction.classList.remove("vf-mobile-page-contacts-toggle");
        pageAction.textContent = originalActionText;
        if (originalActionTitle === null) pageAction.removeAttribute("title");
        else pageAction.setAttribute("title", originalActionTitle);
        if (originalActionAriaLabel === null) pageAction.removeAttribute("aria-label");
        else pageAction.setAttribute("aria-label", originalActionAriaLabel);
        if (originalActionAriaExpanded === null) pageAction.removeAttribute("aria-expanded");
        else pageAction.setAttribute("aria-expanded", originalActionAriaExpanded);

        if (originalHomeAriaHidden === null) homeButton.removeAttribute("aria-hidden");
        else homeButton.setAttribute("aria-hidden", originalHomeAriaHidden);
        if (originalHomeTabIndex === null) homeButton.removeAttribute("tabindex");
        else homeButton.setAttribute("tabindex", originalHomeTabIndex);

        if (originalDistrictParent) {
          if (originalDistrictNextSibling && originalDistrictNextSibling.parentNode === originalDistrictParent) {
            originalDistrictParent.insertBefore(districtPanel, originalDistrictNextSibling);
          } else {
            originalDistrictParent.appendChild(districtPanel);
          }
        }
        districtHost.remove();

        if (originalPanelParent) {
          if (originalPanelNextSibling && originalPanelNextSibling.parentNode === originalPanelParent) {
            originalPanelParent.insertBefore(contactPanel, originalPanelNextSibling);
          } else {
            originalPanelParent.appendChild(contactPanel);
          }
        }
        contactsHost.remove();
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
