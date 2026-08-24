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

function compactDistrictSummary(text: string) {
  const match = text.match(/([\d.]+)\s+contatos\s+em\s+([\d.]+)\s+bairros/i);
  if (!match) return text || "Distribuição territorial";
  return `${match[1]} contatos · ${match[2]} bairros`;
}

function compactPendingSummary(text: string) {
  const match = text.match(/([\d.]+)\s+contatos/i);
  return match ? `${match[1]} para revisar` : "Revisão territorial";
}

export default function MapMobileRoleLayout({ isAdm }: { isAdm: boolean }) {
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    let activeSection: MapSection = "districts";
    let sheetOpen = false;
    let frame = 0;
    let launcher: HTMLElement | null = null;
    let scrim: HTMLButtonElement | null = null;
    let currentFullMap: HTMLElement | null = null;
    let currentDistrictHost: HTMLElement | null = null;
    let districtCloseButton: HTMLButtonElement | null = null;
    let pendingCloseButton: HTMLButtonElement | null = null;

    const pendingHost = () =>
      currentFullMap ? directPendingHost(currentFullMap) : null;

    const handleDistrictClose = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeSheet();
    };

    const handlePendingClose = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeSheet();
    };

    const restoreDistrictToggle = () => {
      if (districtCloseButton) {
        districtCloseButton.removeEventListener("click", handleDistrictClose, true);
      }
      districtCloseButton = null;
      const panel = currentDistrictHost?.querySelector<HTMLElement>(
        ".vf-district-map-control",
      );
      const toggle = panel?.querySelector<HTMLButtonElement>(".vf-district-map-toggle");
      if (panel) panel.dataset.collapsed = "true";
      if (toggle) {
        toggle.textContent = "+";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir contatos por bairro");
        toggle.title = "Abrir contatos por bairro";
      }
    };

    const restorePendingToggle = () => {
      if (pendingCloseButton) {
        pendingCloseButton.removeEventListener("click", handlePendingClose, true);
      }
      pendingCloseButton = null;
      const toggle = pendingHost()?.querySelector<HTMLButtonElement>("[data-role='toggle']");
      if (toggle) {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.textContent = expanded ? "Fechar" : "Revisar";
        toggle.removeAttribute("title");
      }
    };

    const closeSheet = () => {
      sheetOpen = false;
      document.body.classList.remove("vf-map-mobile-sheet-lock");
      scrim?.classList.remove("vf-map-sheet-scrim-open");
      scrim?.setAttribute("aria-hidden", "true");
      currentDistrictHost?.classList.remove("vf-map-sheet-open");
      pendingHost()?.classList.remove("vf-map-sheet-open");
      restoreDistrictToggle();
      restorePendingToggle();
      syncLauncherState();
    };

    const openDistrictSheet = () => {
      const panel = currentDistrictHost?.querySelector<HTMLElement>(
        ".vf-district-map-control",
      );
      const toggle = panel?.querySelector<HTMLButtonElement>(".vf-district-map-toggle");
      if (!panel || !toggle) return;
      panel.dataset.collapsed = "false";
      toggle.textContent = "×";
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Fechar bairros");
      toggle.title = "Fechar bairros";
      if (districtCloseButton !== toggle) {
        districtCloseButton?.removeEventListener("click", handleDistrictClose, true);
        toggle.addEventListener("click", handleDistrictClose, true);
        districtCloseButton = toggle;
      }
    };

    const openPendingSheet = () => {
      const host = pendingHost();
      if (!host) return;
      const toggle = host.querySelector<HTMLButtonElement>("[data-role='toggle']");
      if (!toggle) return;
      if (toggle.getAttribute("aria-expanded") !== "true") {
        toggle.click();
        return;
      }
      toggle.textContent = "×";
      toggle.setAttribute("aria-label", "Fechar pendências");
      toggle.title = "Fechar pendências";
      if (pendingCloseButton !== toggle) {
        pendingCloseButton?.removeEventListener("click", handlePendingClose, true);
        toggle.addEventListener("click", handlePendingClose, true);
        pendingCloseButton = toggle;
      }
    };

    const syncLauncherLabels = () => {
      if (!launcher || !currentDistrictHost) return;
      const districtText =
        currentDistrictHost.querySelector<HTMLElement>(
          ".vf-district-map-control header small",
        )?.textContent || "";
      const districtButton = launcher.querySelector<HTMLButtonElement>(
        "[data-vf-map-section='districts']",
      );
      const districtSummary = compactDistrictSummary(districtText);
      const districtSmall = districtButton?.querySelector<HTMLElement>("small");
      if (districtSmall && districtSmall.textContent !== districtSummary) {
        districtSmall.textContent = districtSummary;
      }

      const host = pendingHost();
      const pendingButton = launcher.querySelector<HTMLButtonElement>(
        "[data-vf-map-section='pending']",
      );
      if (pendingButton) {
        pendingButton.disabled = !host;
        const pendingText =
          host?.querySelector<HTMLElement>(".vf-territorial-center > header strong")
            ?.textContent || "";
        const small = pendingButton.querySelector<HTMLElement>("small");
        const summary = compactPendingSummary(pendingText);
        if (small && small.textContent !== summary) small.textContent = summary;
      }
    };

    const syncLauncherState = () => {
      launcher
        ?.querySelectorAll<HTMLButtonElement>("[data-vf-map-section]")
        .forEach((button) => {
          const selected =
            sheetOpen && button.dataset.vfMapSection === activeSection;
          button.setAttribute("aria-pressed", selected ? "true" : "false");
        });
    };

    const applySheetState = () => {
      if (!currentDistrictHost) return;
      const host = pendingHost();

      currentDistrictHost.classList.toggle(
        "vf-map-sheet-open",
        sheetOpen && activeSection === "districts",
      );
      host?.classList.toggle(
        "vf-map-sheet-open",
        sheetOpen && activeSection === "pending" && isAdm,
      );

      if (sheetOpen) {
        document.body.classList.add("vf-map-mobile-sheet-lock");
        scrim?.classList.add("vf-map-sheet-scrim-open");
        scrim?.setAttribute("aria-hidden", "false");
        if (activeSection === "districts") {
          restorePendingToggle();
          openDistrictSheet();
        } else if (isAdm && host) {
          restoreDistrictToggle();
          openPendingSheet();
        }
      } else {
        document.body.classList.remove("vf-map-mobile-sheet-lock");
        scrim?.classList.remove("vf-map-sheet-scrim-open");
        scrim?.setAttribute("aria-hidden", "true");
      }
      syncLauncherState();
      syncLauncherLabels();
    };

    const selectSection = (section: MapSection) => {
      if (section === "pending" && (!isAdm || !pendingHost())) return;
      if (sheetOpen && activeSection === section) {
        closeSheet();
        return;
      }
      activeSection = section;
      sheetOpen = true;
      applySheetState();
    };

    const makeLauncherButton = (label: string, section: MapSection) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vf-map-mobile-launcher-button";
      button.dataset.vfMapSection = section;
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `<span>${label}</span><small>${
        section === "districts" ? "Distribuição territorial" : "Revisão territorial"
      }</small>`;
      button.addEventListener("click", () => selectSection(section));
      return button;
    };

    const ensureLauncher = (fullMap: HTMLElement) => {
      if (launcher?.isConnected && launcher.parentElement === fullMap) return;
      launcher?.remove();
      launcher = document.createElement("div");
      launcher.className = `vf-map-mobile-launcher ${
        isAdm ? "vf-map-mobile-launcher-adm" : "vf-map-mobile-launcher-gestor"
      }`;
      launcher.setAttribute("aria-label", "Ferramentas territoriais do mapa");
      launcher.appendChild(makeLauncherButton("Bairros", "districts"));
      if (isAdm) launcher.appendChild(makeLauncherButton("Pendências", "pending"));
      fullMap.appendChild(launcher);
    };

    const ensureScrim = () => {
      if (scrim?.isConnected) return;
      scrim = document.createElement("button");
      scrim.type = "button";
      scrim.className = "vf-map-sheet-scrim";
      scrim.setAttribute("aria-label", "Fechar painel do mapa");
      scrim.setAttribute("aria-hidden", "true");
      scrim.addEventListener("click", closeSheet);
      document.body.appendChild(scrim);
    };

    const clearGeneratedUi = () => {
      closeSheet();
      launcher?.remove();
      scrim?.removeEventListener("click", closeSheet);
      scrim?.remove();
      launcher = null;
      scrim = null;
      currentFullMap = null;
      currentDistrictHost = null;
    };

    const sync = () => {
      if (!media.matches) {
        clearGeneratedUi();
        return;
      }

      const fullMap = document.querySelector<HTMLElement>(".full-map");
      const districtHost = document.querySelector<HTMLElement>(".vf-mobile-district-host");
      if (!fullMap || !districtHost) {
        clearGeneratedUi();
        return;
      }

      if (currentFullMap && currentFullMap !== fullMap) clearGeneratedUi();
      currentFullMap = fullMap;
      currentDistrictHost = districtHost;

      ensureLauncher(fullMap);
      ensureScrim();
      applySheetState();
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sheetOpen) closeSheet();
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    media.addEventListener("change", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);
    window.addEventListener("voto-forte:electoral-map-ready", scheduleSync);
    document.addEventListener("keydown", handleKey);
    sync();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      window.removeEventListener("voto-forte:electoral-map-ready", scheduleSync);
      document.removeEventListener("keydown", handleKey);
      if (frame) window.cancelAnimationFrame(frame);
      clearGeneratedUi();
    };
  }, [isAdm]);

  return null;
}
