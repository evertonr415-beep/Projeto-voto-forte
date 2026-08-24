"use client";

import { useLayoutEffect } from "react";

const MEDIA = "(max-width: 760px)";

function closestPendingHost(fullMap: HTMLElement) {
  const parent = fullMap.parentElement;
  if (!parent) return null;
  return Array.from(parent.children).find(
    (node) =>
      node instanceof HTMLElement &&
      node.classList.contains("vf-territorial-center-host"),
  ) as HTMLElement | undefined | null;
}

function makeTool(label: string, icon: string, action: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vf-map-mobile-tool";
  button.dataset.vfMapMobileAction = action;
  button.innerHTML = `<span aria-hidden="true">${icon}</span><b>${label}</b>`;
  return button;
}

export default function MapMobileCompactExperience({ isAdm }: { isAdm: boolean }) {
  useLayoutEffect(() => {
    const media = window.matchMedia(MEDIA);
    let frame = 0;
    let cleanupFns: Array<() => void> = [];
    let shell: HTMLElement | null = null;
    let title: HTMLElement | null = null;
    let recenter: HTMLButtonElement | null = null;
    let currentMap: HTMLElement | null = null;
    let currentPageHead: HTMLElement | null = null;
    let currentContactsHost: HTMLElement | null = null;
    let currentDistrictHost: HTMLElement | null = null;

    const teardown = () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
      shell?.remove();
      title?.remove();
      recenter?.remove();
      shell = null;
      title = null;
      recenter = null;

      currentPageHead?.classList.remove("vf-map-mobile-head-hidden");
      currentContactsHost?.classList.remove("vf-map-mobile-panel-open", "vf-map-mobile-panel-hidden");
      currentDistrictHost?.classList.remove("vf-map-mobile-panel-open", "vf-map-mobile-panel-hidden");
      closestPendingHost(currentMap as HTMLElement)?.classList.remove(
        "vf-map-mobile-panel-open",
        "vf-map-mobile-panel-hidden",
      );

      currentMap = null;
      currentPageHead = null;
      currentContactsHost = null;
      currentDistrictHost = null;
    };

    const setPanel = (panel: "contacts" | "districts" | "pending" | null) => {
      if (!currentContactsHost || !currentDistrictHost || !currentMap) return;
      const pending = closestPendingHost(currentMap);

      const pairs: Array<[HTMLElement | null | undefined, boolean]> = [
        [currentContactsHost, panel === "contacts"],
        [currentDistrictHost, panel === "districts"],
        [pending, panel === "pending"],
      ];

      pairs.forEach(([host, open]) => {
        if (!host) return;
        host.classList.toggle("vf-map-mobile-panel-open", open);
        host.classList.toggle("vf-map-mobile-panel-hidden", !open);
      });

      shell
        ?.querySelectorAll<HTMLButtonElement>("[data-vf-map-mobile-action]")
        .forEach((button) => {
          const active = button.dataset.vfMapMobileAction === panel;
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });

      if (panel === "contacts") {
        currentContactsHost.classList.add("vf-mobile-contacts-open");
      } else {
        currentContactsHost.classList.remove("vf-mobile-contacts-open");
      }

      if (panel === "districts") {
        const panelNode = currentDistrictHost.querySelector<HTMLElement>(".vf-district-map-control");
        const toggle = currentDistrictHost.querySelector<HTMLButtonElement>(".vf-district-map-toggle");
        if (panelNode) panelNode.dataset.collapsed = "false";
        if (toggle) {
          toggle.textContent = "−";
          toggle.setAttribute("aria-expanded", "true");
        }
      }

      if (panel === "pending" && pending) {
        const toggle = pending.querySelector<HTMLButtonElement>("[data-role='toggle']");
        if (toggle?.getAttribute("aria-expanded") !== "true") toggle?.click();
      }
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

      if (!title?.isConnected) {
        title = document.createElement("div");
        title.className = "vf-map-mobile-title";
        title.setAttribute("aria-label", "Mapa eleitoral de Arapongas");
        title.innerHTML = "<strong>Mapa eleitoral</strong><small>Arapongas</small>";
        topbarPageId.prepend(title);
      }

      if (!shell?.isConnected) {
        shell = document.createElement("nav");
        shell.className = `vf-map-mobile-tools${isAdm ? " is-adm" : ""}`;
        shell.setAttribute("aria-label", "Ferramentas do mapa eleitoral");

        const contactsButton = makeTool("Contatos", "👥", "contacts");
        const districtsButton = makeTool("Bairros", "⌖", "districts");
        shell.append(contactsButton, districtsButton);

        if (isAdm) shell.append(makeTool("Pendências", "⚠", "pending"));

        const mountPoint = contactsHost;
        mountPoint.insertAdjacentElement("beforebegin", shell);

        shell.querySelectorAll<HTMLButtonElement>("[data-vf-map-mobile-action]").forEach((button) => {
          const handler = () => {
            const action = button.dataset.vfMapMobileAction as "contacts" | "districts" | "pending";
            const isActive = button.getAttribute("aria-pressed") === "true";
            setPanel(isActive ? null : action);
          };
          button.addEventListener("click", handler);
          cleanupFns.push(() => button.removeEventListener("click", handler));
        });
      }

      if (!recenter?.isConnected) {
        recenter = document.createElement("button");
        recenter.type = "button";
        recenter.className = "vf-map-mobile-recenter";
        recenter.setAttribute("aria-label", "Centralizar alfinetes");
        recenter.title = "Centralizar alfinetes";
        recenter.textContent = "⌖";
        const handler = () => {
          fullMap
            .querySelector<HTMLButtonElement>(".real-map-toolbar button:nth-of-type(1)")
            ?.click();
        };
        recenter.addEventListener("click", handler);
        cleanupFns.push(() => recenter?.removeEventListener("click", handler));
        fullMap.appendChild(recenter);
      }

      setPanel(null);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        mount();
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("voto-forte:electoral-map-ready", schedule);
    schedule();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", schedule);
      window.removeEventListener("pageshow", schedule);
      window.removeEventListener("voto-forte:electoral-map-ready", schedule);
      if (frame) cancelAnimationFrame(frame);
      teardown();
    };
  }, [isAdm]);

  return null;
}
