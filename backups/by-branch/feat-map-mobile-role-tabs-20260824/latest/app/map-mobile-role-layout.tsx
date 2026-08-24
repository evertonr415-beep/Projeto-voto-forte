"use client";

import { useLayoutEffect } from "react";
import "./map-mobile-role-layout.css";

type MapSection = "districts" | "pending";

function getPendingHost() {
  return document.querySelector<HTMLElement>(".vf-territorial-center-host");
}

function compactDistrictSummary(text: string) {
  const match = text.match(/([\d.]+)\s+contatos\s+em\s+([\d.]+)\s+bairros/i);
  if (!match) return text || "Distribuição territorial";
  return `${match[1]} contatos · ${match[2]} bairros`;
}

function compactPendingSummary(text: string) {
  const match = text.match(/([\d.]+)\s+contatos.*?([\d.]+)\s+bairros/i);
  if (match) return `${match[1]} contatos · ${match[2]} bairros`;
  const contacts = text.match(/([\d.]+)\s+contatos/i);
  return contacts ? `${contacts[1]} contatos para revisar` : "Revisão territorial";
}

export default function MapMobileRoleLayout({ isAdm }: { isAdm: boolean }) {
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    let activeSection: MapSection | null = null;
    let frame = 0;
    let returnScrollY = 0;
    let nav: HTMLElement | null = null;
    let detailHeader: HTMLElement | null = null;
    let mapControls: HTMLElement | null = null;
    let captureBanner: HTMLElement | null = null;
    let currentFullMap: HTMLElement | null = null;
    let currentDistrictHost: HTMLElement | null = null;

    const districtPanel = () =>
      currentDistrictHost?.querySelector<HTMLElement>(".vf-district-map-control") ?? null;

    const districtToggle = () =>
      currentDistrictHost?.querySelector<HTMLButtonElement>(".vf-district-map-toggle") ?? null;

    const pendingHost = () => getPendingHost();

    const pendingToggle = () =>
      pendingHost()?.querySelector<HTMLButtonElement>("[data-role='toggle']") ?? null;

    const setDistrictExpanded = (expanded: boolean) => {
      const panel = districtPanel();
      const toggle = districtToggle();
      if (panel) panel.dataset.collapsed = expanded ? "false" : "true";
      if (toggle) {
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        toggle.textContent = expanded ? "−" : "+";
      }
    };

    const ensurePendingExpanded = () => {
      const toggle = pendingToggle();
      if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click();
    };

    const updateDetailHeader = () => {
      if (!detailHeader || !activeSection) return;
      const title = detailHeader.querySelector<HTMLElement>("strong");
      const subtitle = detailHeader.querySelector<HTMLElement>("small");
      if (!title || !subtitle) return;

      if (activeSection === "districts") {
        title.textContent = "Escolha um bairro";
        subtitle.textContent = "Toque em um bairro para localizar no mapa";
      } else {
        const raw =
          pendingHost()?.querySelector<HTMLElement>(
            ".vf-territorial-center > header strong",
          )?.textContent || "";
        title.textContent = "Pendências territoriais";
        subtitle.textContent = compactPendingSummary(raw);
      }
    };

    const updateNavLabels = () => {
      if (!nav || !currentDistrictHost) return;
      const districtRaw =
        currentDistrictHost.querySelector<HTMLElement>(
          ".vf-district-map-control header small",
        )?.textContent || "";
      const districtSummary = nav.querySelector<HTMLElement>(
        "[data-vf-map-section='districts'] small",
      );
      const compactDistrict = compactDistrictSummary(districtRaw);
      if (districtSummary && districtSummary.textContent !== compactDistrict) {
        districtSummary.textContent = compactDistrict;
      }

      const pendingButton = nav.querySelector<HTMLButtonElement>(
        "[data-vf-map-section='pending']",
      );
      if (pendingButton) {
        const host = pendingHost();
        pendingButton.disabled = !host;
        const pendingRaw =
          host?.querySelector<HTMLElement>(".vf-territorial-center > header strong")
            ?.textContent || "";
        const summary = pendingButton.querySelector<HTMLElement>("small");
        const compact = compactPendingSummary(pendingRaw);
        if (summary && summary.textContent !== compact) summary.textContent = compact;
      }
    };

    const removeCaptureBanner = () => {
      captureBanner?.remove();
      captureBanner = null;
    };

    const showCaptureBanner = (district: string) => {
      if (!currentFullMap) return;
      removeCaptureBanner();
      captureBanner = document.createElement("div");
      captureBanner.className = "vf-map-capture-banner";
      captureBanner.innerHTML = `<strong>Marcar referência</strong><small>Toque no mapa para posicionar ${district || "o bairro"}.</small>`;
      currentFullMap.appendChild(captureBanner);
    };

    const refreshCaptureBanner = () => {
      if (!captureBanner) return;
      const captureStillActive = Boolean(
        pendingHost()?.querySelector(".vf-territorial-capture"),
      );
      if (!captureStillActive) removeCaptureBanner();
    };

    const refreshMapAfterReturn = () => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: returnScrollY, behavior: "auto" });
        window.requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
          window.dispatchEvent(new Event("voto-forte:electoral-map-ready"));
        });
      });
    };

    const applyViewState = () => {
      if (!currentFullMap || !currentDistrictHost || !nav || !detailHeader) return;
      const pending = pendingHost();
      const showingDetail = activeSection !== null;

      currentFullMap.classList.toggle("vf-map-mobile-map-hidden", showingDetail);
      nav.classList.toggle("vf-map-mobile-nav-hidden", showingDetail);
      detailHeader.classList.toggle("vf-map-mobile-detail-header-open", showingDetail);
      currentDistrictHost.classList.toggle(
        "vf-map-mobile-detail-panel-active",
        activeSection === "districts",
      );
      pending?.classList.toggle(
        "vf-map-mobile-detail-panel-active",
        activeSection === "pending" && isAdm,
      );

      if (activeSection === "districts") setDistrictExpanded(true);
      else setDistrictExpanded(false);

      if (activeSection === "pending" && isAdm && pending) ensurePendingExpanded();
      updateDetailHeader();
      updateNavLabels();
    };

    const closeDetail = () => {
      if (!activeSection) return;
      activeSection = null;
      applyViewState();
      refreshMapAfterReturn();
    };

    const openDetail = (section: MapSection) => {
      if (section === "pending" && (!isAdm || !pendingHost())) return;
      returnScrollY = window.scrollY;
      activeSection = section;
      applyViewState();
    };

    const makeNavButton = (label: string, section: MapSection) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vf-map-mobile-nav-button";
      button.dataset.vfMapSection = section;
      button.innerHTML = `<span><b>${label}</b><small>${
        section === "districts" ? "Distribuição territorial" : "Revisão territorial"
      }</small></span><i aria-hidden="true">›</i>`;
      button.addEventListener("click", () => openDetail(section));
      return button;
    };

    const ensureNav = (fullMap: HTMLElement) => {
      if (nav?.isConnected && nav.nextElementSibling === fullMap) return;
      nav?.remove();
      nav = document.createElement("nav");
      nav.className = `vf-map-mobile-nav ${isAdm ? "vf-map-mobile-nav-adm" : "vf-map-mobile-nav-gestor"}`;
      nav.setAttribute("aria-label", "Ferramentas territoriais");
      nav.appendChild(makeNavButton("Bairros", "districts"));
      if (isAdm) nav.appendChild(makeNavButton("Pendências", "pending"));
      fullMap.insertAdjacentElement("beforebegin", nav);
    };

    const ensureDetailHeader = (districtHost: HTMLElement) => {
      if (detailHeader?.isConnected) return;
      detailHeader = document.createElement("div");
      detailHeader.className = "vf-map-mobile-detail-header";
      detailHeader.innerHTML = `
        <button type="button" aria-label="Voltar ao mapa"><span aria-hidden="true">‹</span> Mapa</button>
        <div><strong>Detalhes territoriais</strong><small></small></div>
      `;
      detailHeader.querySelector("button")?.addEventListener("click", closeDetail);
      districtHost.insertAdjacentElement("beforebegin", detailHeader);
    };

    const ensureMapControls = (fullMap: HTMLElement) => {
      if (mapControls?.isConnected && mapControls.parentElement === fullMap) return;
      mapControls?.remove();
      const sourceButtons = Array.from(
        fullMap.querySelectorAll<HTMLButtonElement>(".real-map-toolbar button"),
      );
      if (sourceButtons.length < 2) return;

      mapControls = document.createElement("div");
      mapControls.className = "vf-map-mobile-controls";
      const labels = ["Centralizar mapa", "Minha localização"];
      const icons = ["⌖", "◎"];
      sourceButtons.slice(0, 2).forEach((source, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.title = labels[index];
        button.setAttribute("aria-label", labels[index]);
        button.textContent = icons[index];
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          source.click();
        });
        mapControls!.appendChild(button);
      });
      fullMap.appendChild(mapControls);
    };

    const clearGeneratedUi = () => {
      activeSection = null;
      setDistrictExpanded(false);
      currentFullMap?.classList.remove("vf-map-mobile-map-hidden");
      currentDistrictHost?.classList.remove("vf-map-mobile-detail-panel-active");
      pendingHost()?.classList.remove("vf-map-mobile-detail-panel-active");
      nav?.remove();
      detailHeader?.remove();
      mapControls?.remove();
      removeCaptureBanner();
      nav = null;
      detailHeader = null;
      mapControls = null;
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

      ensureNav(fullMap);
      ensureDetailHeader(districtHost);
      ensureMapControls(fullMap);
      applyViewState();
      refreshCaptureBanner();
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    const handleDistrictSelection = (event: Event) => {
      if (activeSection !== "districts") return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>(".vf-district-map-row");
      if (!button || button.disabled) return;

      // O handler original da linha ja centraliza, destaca e agenda a abertura
      // do popup. Apenas restauramos o mapa logo depois, antes do popup abrir.
      window.setTimeout(() => {
        if (activeSection !== "districts") return;
        activeSection = null;
        applyViewState();
        refreshMapAfterReturn();
      }, 0);
    };

    const handleCaptureAction = (event: Event) => {
      if (!isAdm || activeSection !== "pending") return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button[data-role='capture']");
      if (!button) return;
      const district =
        button.closest<HTMLElement>("[data-ref-district]")?.dataset.refDistrict || "";
      window.setTimeout(() => {
        if (!pendingHost()?.querySelector(".vf-territorial-capture")) return;
        activeSection = null;
        applyViewState();
        showCaptureBanner(district);
        refreshMapAfterReturn();
      }, 0);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeSection) closeDetail();
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
    document.addEventListener("click", handleDistrictSelection);
    document.addEventListener("click", handleCaptureAction);
    document.addEventListener("keydown", handleKey);
    sync();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      window.removeEventListener("voto-forte:electoral-map-ready", scheduleSync);
      document.removeEventListener("click", handleDistrictSelection);
      document.removeEventListener("click", handleCaptureAction);
      document.removeEventListener("keydown", handleKey);
      if (frame) window.cancelAnimationFrame(frame);
      clearGeneratedUi();
    };
  }, [isAdm]);

  return null;
}
