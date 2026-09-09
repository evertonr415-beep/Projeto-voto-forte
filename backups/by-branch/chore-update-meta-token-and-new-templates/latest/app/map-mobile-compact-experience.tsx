"use client";

import { useLayoutEffect } from "react";

const MEDIA = "(max-width: 760px)";
type Panel = "contacts" | "districts" | "pending" | null;

function closestPendingHost(fullMap: HTMLElement | null) {
  const parent = fullMap?.parentElement;
  if (!parent) return null;
  return (
    (Array.from(parent.children).find(
      (node) =>
        node instanceof HTMLElement &&
        node.classList.contains("vf-territorial-center-host"),
    ) as HTMLElement | undefined) ?? null
  );
}

function makeTool(label: string, icon: string, action: Exclude<Panel, null>) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vf-map-mobile-tool";
  button.dataset.vfMapMobileAction = action;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `<span class="vf-map-mobile-tool-icon" aria-hidden="true">${icon}</span><b>${label}</b>`;
  return button;
}

function compactDistrictSummary(text: string) {
  const match = text.match(/([\d.]+)\s+contatos\s+em\s+([\d.]+)\s+bairros/i);
  if (match) {
    const contacts = Number(match[1].replace(/\D/g, ""));
    const districts = Number(match[2].replace(/\D/g, ""));
    if (contacts > 0 || districts > 0) return `${match[1]} contatos · ${match[2]} bairros`;
  }
  return "Arapongas · mapa territorial";
}

export default function MapMobileCompactExperience({ isAdm }: { isAdm: boolean }) {
  useLayoutEffect(() => {
    const media = window.matchMedia(MEDIA);
    let frame = 0;
    let activePanel: Panel = null;
    let syncingPendingToggle = false;
    let cleanupFns: Array<() => void> = [];
    let shell: HTMLElement | null = null;
    let title: HTMLElement | null = null;
    let mapSummary: HTMLElement | null = null;
    let mapActions: HTMLElement | null = null;
    let districtSearch: HTMLElement | null = null;
    let captureBanner: HTMLElement | null = null;
    let currentMap: HTMLElement | null = null;
    let currentPageHead: HTMLElement | null = null;
    let currentContactsHost: HTMLElement | null = null;
    let currentDistrictHost: HTMLElement | null = null;

    const pendingHost = () => closestPendingHost(currentMap);

    const filterDistrictRows = () => {
      if (!districtSearch || !currentDistrictHost) return;
      const query =
        districtSearch.querySelector<HTMLInputElement>("input")?.value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase() || "";

      currentDistrictHost
        .querySelectorAll<HTMLElement>(".vf-district-map-row")
        .forEach((row) => {
          const text = (row.textContent || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          row.hidden = Boolean(query) && !text.includes(query);
        });
    };

    const updateSummary = () => {
      if (!mapSummary || !currentDistrictHost) return;
      const raw =
        currentDistrictHost.querySelector<HTMLElement>(
          ".vf-district-map-control header small",
        )?.textContent || "";
      const next = compactDistrictSummary(raw);
      if (mapSummary.textContent !== next) mapSummary.textContent = next;
    };

    const removeCaptureBanner = () => {
      captureBanner?.remove();
      captureBanner = null;
    };

    const showCaptureBanner = (district: string) => {
      if (!currentMap) return;
      removeCaptureBanner();
      captureBanner = document.createElement("div");
      captureBanner.className = "vf-map-mobile-capture-banner";
      captureBanner.innerHTML = `<strong>Modo de marcação</strong><small>Toque no mapa para posicionar ${district || "o bairro"}.</small>`;
      currentMap.appendChild(captureBanner);
    };

    const syncCaptureBanner = () => {
      if (!captureBanner) return;
      if (!pendingHost()?.querySelector(".vf-territorial-capture")) removeCaptureBanner();
    };

    const clickPendingToggle = (toggle: HTMLButtonElement) => {
      syncingPendingToggle = true;
      try {
        toggle.click();
      } finally {
        syncingPendingToggle = false;
      }
    };

    const applyPanelState = () => {
      if (!currentContactsHost || !currentDistrictHost || !currentMap) return;
      const pending = pendingHost();

      const pairs: Array<[HTMLElement | null, boolean]> = [
        [currentContactsHost, activePanel === "contacts"],
        [currentDistrictHost, activePanel === "districts"],
        [pending, activePanel === "pending"],
      ];

      pairs.forEach(([host, open]) => {
        if (!host) return;
        host.classList.toggle("vf-map-mobile-panel-open", open);
        host.classList.toggle("vf-map-mobile-panel-hidden", !open);
      });

      shell
        ?.querySelectorAll<HTMLButtonElement>("[data-vf-map-mobile-action]")
        .forEach((button) => {
          const action = button.dataset.vfMapMobileAction;
          const active = action === activePanel;
          button.setAttribute("aria-pressed", active ? "true" : "false");
          button.setAttribute("aria-expanded", active ? "true" : "false");
          if (action === "pending") button.disabled = isAdm && !pending;
        });

      currentContactsHost.classList.toggle(
        "vf-mobile-contacts-open",
        activePanel === "contacts",
      );

      const districtPanel = currentDistrictHost.querySelector<HTMLElement>(
        ".vf-district-map-control",
      );
      const districtsOpen = activePanel === "districts";
      if (districtPanel) districtPanel.dataset.collapsed = districtsOpen ? "false" : "true";

      const districtToggle = currentDistrictHost.querySelector<HTMLButtonElement>(
        ".vf-district-map-toggle",
      );
      if (districtToggle) {
        districtToggle.textContent = districtsOpen ? "−" : "+";
        districtToggle.setAttribute("aria-expanded", districtsOpen ? "true" : "false");
      }

      if (districtsOpen) {
        window.requestAnimationFrame(() =>
          districtSearch?.querySelector<HTMLInputElement>("input")?.focus({
            preventScroll: true,
          }),
        );
      }

      if (pending) {
        const toggle = pending.querySelector<HTMLButtonElement>("[data-role='toggle']");
        const expanded = toggle?.getAttribute("aria-expanded") === "true";
        if (activePanel === "pending" && toggle && !expanded) clickPendingToggle(toggle);
        if (activePanel !== "pending" && toggle && expanded) clickPendingToggle(toggle);
      }
    };

    const setPanel = (panel: Panel) => {
      activePanel = panel;
      applyPanelState();
    };

    const ensureTitle = (topbarPageId: HTMLElement) => {
      const mobileMenu = topbarPageId.querySelector<HTMLElement>(".mobile-menu");
      if (!title?.isConnected) {
        title = document.createElement("div");
        title.className = "vf-map-mobile-title";
        title.setAttribute("aria-label", "Mapa eleitoral de Arapongas");
        title.innerHTML = "<strong>Mapa eleitoral</strong>";
      }
      if (mobileMenu) {
        if (title.previousElementSibling !== mobileMenu) {
          mobileMenu.insertAdjacentElement("afterend", title);
        }
      } else if (!title.parentElement) {
        topbarPageId.prepend(title);
      }
    };

    const ensureShell = () => {
      if (!currentContactsHost || shell?.isConnected) return;
      shell = document.createElement("nav");
      shell.className = `vf-map-mobile-tools${isAdm ? " is-adm" : ""}`;
      shell.dataset.vfMapRole = isAdm ? "adm" : "gestor";
      shell.setAttribute("aria-label", "Ferramentas do mapa eleitoral");

      shell.append(
        makeTool("Contatos", "👥", "contacts"),
        makeTool("Bairros", "⌖", "districts"),
      );
      if (isAdm) shell.append(makeTool("Pendências", "!", "pending"));

      currentContactsHost.insertAdjacentElement("beforebegin", shell);
      shell
        .querySelectorAll<HTMLButtonElement>("[data-vf-map-mobile-action]")
        .forEach((button) => {
          const handler = () => {
            const action = button.dataset.vfMapMobileAction as Exclude<Panel, null>;
            setPanel(activePanel === action ? null : action);
          };
          button.addEventListener("click", handler);
          cleanupFns.push(() => button.removeEventListener("click", handler));
        });
    };

    const ensureMapChrome = () => {
      if (!currentMap) return;

      if (!mapSummary?.isConnected) {
        mapSummary = document.createElement("div");
        mapSummary.className = "vf-map-mobile-summary";
        mapSummary.setAttribute("aria-live", "polite");
        mapSummary.textContent = "Arapongas · mapa territorial";
        currentMap.appendChild(mapSummary);
      }

      if (!mapActions?.isConnected) {
        mapActions = document.createElement("div");
        mapActions.className = "vf-map-mobile-actions";

        const labels = ["Centralizar mapa", "Minha localização"];
        const icons = ["⌖", "◎"];
        labels.forEach((label, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.title = label;
          button.setAttribute("aria-label", label);
          button.textContent = icons[index];
          const handler = () => {
            currentMap
              ?.querySelectorAll<HTMLButtonElement>(".real-map-toolbar button")
              .item(index)
              ?.click();
          };
          button.addEventListener("click", handler);
          cleanupFns.push(() => button.removeEventListener("click", handler));
          mapActions!.appendChild(button);
        });

        currentMap.appendChild(mapActions);
      }
    };

    const ensureDistrictSearch = () => {
      if (!currentDistrictHost) return;
      const panel = currentDistrictHost.querySelector<HTMLElement>(
        ".vf-district-map-control",
      );
      const header = panel?.querySelector<HTMLElement>("header");
      if (!panel || !header) return;

      if (!districtSearch?.isConnected) {
        districtSearch = document.createElement("label");
        districtSearch.className = "vf-map-district-search";
        districtSearch.innerHTML = `<span aria-hidden="true">⌕</span><input type="search" inputmode="search" autocomplete="off" placeholder="Buscar bairro…" aria-label="Buscar bairro" />`;
        header.insertAdjacentElement("afterend", districtSearch);
        const input = districtSearch.querySelector<HTMLInputElement>("input")!;
        const handler = () => filterDistrictRows();
        input.addEventListener("input", handler);
        cleanupFns.push(() => input.removeEventListener("input", handler));
      }
      filterDistrictRows();
    };

    const bindHostActions = () => {
      if (currentDistrictHost && !currentDistrictHost.dataset.vfProBound) {
        currentDistrictHost.dataset.vfProBound = "true";
        const host = currentDistrictHost;
        const handler = (event: Event) => {
          const target = event.target instanceof Element ? event.target : null;
          const row = target?.closest<HTMLButtonElement>(".vf-district-map-row");
          if (!row || row.disabled) return;
          window.setTimeout(() => {
            if (activePanel === "districts") setPanel(null);
          }, 0);
        };
        host.addEventListener("click", handler);
        cleanupFns.push(() => {
          host.removeEventListener("click", handler);
          delete host.dataset.vfProBound;
        });
      }

      if (currentContactsHost && !currentContactsHost.dataset.vfProBound) {
        currentContactsHost.dataset.vfProBound = "true";
        const host = currentContactsHost;
        const handler = (event: Event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target?.closest<HTMLButtonElement>("[data-profile]")) return;
          window.setTimeout(() => {
            if (activePanel === "contacts") setPanel(null);
          }, 140);
        };
        host.addEventListener("click", handler);
        cleanupFns.push(() => {
          host.removeEventListener("click", handler);
          delete host.dataset.vfProBound;
        });
      }

      const pending = pendingHost();
      if (pending && !pending.dataset.vfProBound) {
        pending.dataset.vfProBound = "true";
        const handler = (event: Event) => {
          const target = event.target instanceof Element ? event.target : null;

          const toggle = target?.closest<HTMLButtonElement>("button[data-role='toggle']");
          if (toggle) {
            if (!syncingPendingToggle && activePanel === "pending") setPanel(null);
            return;
          }

          const capture = target?.closest<HTMLButtonElement>("button[data-role='capture']");
          if (!capture) return;
          const district =
            capture.closest<HTMLElement>("[data-ref-district]")?.dataset.refDistrict || "";
          window.setTimeout(() => {
            if (!pending.querySelector(".vf-territorial-capture")) return;
            setPanel(null);
            showCaptureBanner(district);
          }, 0);
        };
        pending.addEventListener("click", handler);
        cleanupFns.push(() => {
          pending.removeEventListener("click", handler);
          delete pending.dataset.vfProBound;
        });
      }
    };

    const teardown = () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
      shell?.remove();
      title?.remove();
      mapSummary?.remove();
      mapActions?.remove();
      districtSearch?.remove();
      removeCaptureBanner();

      currentPageHead?.classList.remove("vf-map-mobile-head-hidden");
      currentContactsHost?.classList.remove(
        "vf-map-mobile-panel-open",
        "vf-map-mobile-panel-hidden",
        "vf-mobile-contacts-open",
      );
      currentDistrictHost?.classList.remove(
        "vf-map-mobile-panel-open",
        "vf-map-mobile-panel-hidden",
      );
      pendingHost()?.classList.remove(
        "vf-map-mobile-panel-open",
        "vf-map-mobile-panel-hidden",
      );

      shell = null;
      title = null;
      mapSummary = null;
      mapActions = null;
      districtSearch = null;
      activePanel = null;
      currentMap = null;
      currentPageHead = null;
      currentContactsHost = null;
      currentDistrictHost = null;
    };

    const mount = () => {
      if (!media.matches) {
        teardown();
        return;
      }

      const fullMap = document.querySelector<HTMLElement>(".full-map");
      const pageHead = document.querySelector<HTMLElement>(".workspace > .page-head");
      const contactsHost = document.querySelector<HTMLElement>(".vf-mobile-contacts-host");
      const districtHost = document.querySelector<HTMLElement>(".vf-mobile-district-host");
      const topbarPageId = document.querySelector<HTMLElement>(".app-shell .topbar .page-id");
      if (!fullMap || !pageHead || !contactsHost || !districtHost || !topbarPageId) return;

      if (currentMap && currentMap !== fullMap) teardown();
      currentMap = fullMap;
      currentPageHead = pageHead;
      currentContactsHost = contactsHost;
      currentDistrictHost = districtHost;

      pageHead.classList.add("vf-map-mobile-head-hidden");
      ensureTitle(topbarPageId);
      ensureShell();
      ensureMapChrome();
      ensureDistrictSearch();
      bindHostActions();
      updateSummary();
      applyPanelState();
      syncCaptureBanner();
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        mount();
      });
    };

    const handleDistrictSelected = () => {
      if (activePanel === "districts") setPanel(null);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    media.addEventListener("change", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("voto-forte:electoral-map-ready", schedule);
    window.addEventListener("voto-forte:district-selected", handleDistrictSelected);
    schedule();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", schedule);
      window.removeEventListener("pageshow", schedule);
      window.removeEventListener("voto-forte:electoral-map-ready", schedule);
      window.removeEventListener("voto-forte:district-selected", handleDistrictSelected);
      if (frame) window.cancelAnimationFrame(frame);
      teardown();
    };
  }, [isAdm]);

  return null;
}
