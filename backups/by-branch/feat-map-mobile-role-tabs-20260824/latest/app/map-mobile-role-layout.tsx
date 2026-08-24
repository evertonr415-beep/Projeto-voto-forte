"use client";

import { useLayoutEffect } from "react";
import "./map-mobile-role-layout.css";

type MapSection = "districts" | "pending";

function directPendingHost(fullMap: HTMLElement) {
  const parent = fullMap.parentElement;
  if (!parent) return null;
  return (
    Array.from(parent.children).find(
      (node) =>
        node instanceof HTMLElement &&
        node.classList.contains("vf-territorial-center-host"),
    ) as HTMLElement | undefined
  ) ?? null;
}

export default function MapMobileRoleLayout({ isAdm }: { isAdm: boolean }) {
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    let activeSection: MapSection = "districts";
    let frame = 0;
    let tabs: HTMLElement | null = null;
    let recenterButton: HTMLButtonElement | null = null;
    let currentFullMap: HTMLElement | null = null;
    let currentDistrictHost: HTMLElement | null = null;

    const clearSectionClasses = () => {
      currentDistrictHost?.classList.remove("vf-mobile-map-section-hidden");
      const pending = currentFullMap ? directPendingHost(currentFullMap) : null;
      pending?.classList.remove("vf-mobile-map-section-hidden");
    };

    const teardownGeneratedUi = () => {
      clearSectionClasses();
      tabs?.remove();
      recenterButton?.remove();
      tabs = null;
      recenterButton = null;
      currentFullMap = null;
      currentDistrictHost = null;
    };

    const applySection = () => {
      if (!currentFullMap || !currentDistrictHost) return;
      const pendingHost = directPendingHost(currentFullMap);
      const pendingAvailable = Boolean(isAdm && pendingHost);

      if (!isAdm) {
        activeSection = "districts";
        currentDistrictHost.classList.remove("vf-mobile-map-section-hidden");
        pendingHost?.classList.add("vf-mobile-map-section-hidden");
        return;
      }

      if (activeSection === "pending" && !pendingAvailable) {
        activeSection = "districts";
      }

      currentDistrictHost.classList.toggle(
        "vf-mobile-map-section-hidden",
        activeSection !== "districts",
      );

      if (pendingHost) {
        pendingHost.classList.toggle(
          "vf-mobile-map-section-hidden",
          activeSection !== "pending",
        );
      }

      tabs
        ?.querySelectorAll<HTMLButtonElement>("[data-vf-map-section]")
        .forEach((button) => {
          const selected = button.dataset.vfMapSection === activeSection;
          button.setAttribute("aria-selected", selected ? "true" : "false");
          button.tabIndex = selected ? 0 : -1;
          if (button.dataset.vfMapSection === "pending") {
            button.disabled = !pendingAvailable;
          }
        });
    };

    const makeTab = (label: string, section: MapSection) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vf-mobile-map-tab";
      button.dataset.vfMapSection = section;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", section === activeSection ? "true" : "false");
      button.textContent = label;
      button.addEventListener("click", () => {
        activeSection = section;
        applySection();
      });
      return button;
    };

    const ensureTabs = (districtHost: HTMLElement) => {
      if (!isAdm) {
        tabs?.remove();
        tabs = null;
        return;
      }
      if (tabs?.isConnected && tabs.nextElementSibling === districtHost) return;
      tabs?.remove();
      tabs = document.createElement("div");
      tabs.className = "vf-mobile-map-tabs";
      tabs.setAttribute("role", "tablist");
      tabs.setAttribute("aria-label", "Seções do mapa eleitoral");
      tabs.appendChild(makeTab("Bairros", "districts"));
      tabs.appendChild(makeTab("Pendências", "pending"));
      districtHost.insertAdjacentElement("beforebegin", tabs);
    };

    const ensureRecenter = (fullMap: HTMLElement) => {
      if (recenterButton?.isConnected && recenterButton.parentElement === fullMap) return;
      recenterButton?.remove();
      recenterButton = document.createElement("button");
      recenterButton.type = "button";
      recenterButton.className = "vf-mobile-map-recenter";
      recenterButton.title = "Centralizar mapa";
      recenterButton.setAttribute("aria-label", "Centralizar mapa nos alfinetes");
      recenterButton.innerHTML = '<span aria-hidden="true">⌖</span>';
      recenterButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceButton = fullMap.querySelector<HTMLButtonElement>(
          ".real-map-toolbar button:not(.map-home)",
        );
        sourceButton?.click();
      });
      fullMap.appendChild(recenterButton);
    };

    const sync = () => {
      if (!media.matches) {
        teardownGeneratedUi();
        return;
      }

      const fullMap = document.querySelector<HTMLElement>(".full-map");
      const districtHost = document.querySelector<HTMLElement>(".vf-mobile-district-host");
      if (!fullMap || !districtHost) {
        teardownGeneratedUi();
        return;
      }

      if (currentFullMap && currentFullMap !== fullMap) teardownGeneratedUi();
      currentFullMap = fullMap;
      currentDistrictHost = districtHost;

      ensureTabs(districtHost);
      ensureRecenter(fullMap);
      applySection();
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);
    window.addEventListener("voto-forte:electoral-map-ready", scheduleSync);
    sync();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      window.removeEventListener("voto-forte:electoral-map-ready", scheduleSync);
      if (frame) window.cancelAnimationFrame(frame);
      teardownGeneratedUi();
    };
  }, [isAdm]);

  return null;
}
