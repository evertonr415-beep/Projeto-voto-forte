"use client";

import { useLayoutEffect } from "react";

const MEDIA = "(min-width: 1024px)";
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
  button.className = "vf-map-desktop-tool";
  button.dataset.vfMapDesktopAction = action;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `<span aria-hidden="true">${icon}</span><b>${label}</b>`;
  return button;
}

export default function MapDesktopCompactExperience({ isAdm }: { isAdm: boolean }) {
  useLayoutEffect(() => {
    const media = window.matchMedia(MEDIA);
    let shell: HTMLElement | null = null;
    let activePanel: Panel = null;
    let map: HTMLElement | null = null;
    let contactsHost: HTMLElement | null = null;
    let districtHost: HTMLElement | null = null;
    let pendingHost: HTMLElement | null = null;
    let cleanupFns: Array<() => void> = [];

    const apply = () => {
      const pairs: Array<[HTMLElement | null, boolean]> = [
        [contactsHost, activePanel === "contacts"],
        [districtHost, activePanel === "districts"],
        [pendingHost, activePanel === "pending"],
      ];
      pairs.forEach(([host, open]) => {
        if (!host) return;
        host.classList.toggle("vf-map-desktop-panel-open", open);
        host.classList.toggle("vf-map-desktop-panel-hidden", !open);
      });
      shell
        ?.querySelectorAll<HTMLButtonElement>("[data-vf-map-desktop-action]")
        .forEach((button) => {
          const active = button.dataset.vfMapDesktopAction === activePanel;
          button.setAttribute("aria-pressed", active ? "true" : "false");
          button.setAttribute("aria-expanded", active ? "true" : "false");
        });
    };

    const setPanel = (panel: Panel) => {
      activePanel = activePanel === panel ? null : panel;
      apply();
    };

    const teardown = () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
      shell?.remove();
      [contactsHost, districtHost, pendingHost].forEach((host) => {
        host?.classList.remove("vf-map-desktop-panel-open", "vf-map-desktop-panel-hidden");
      });
      shell = null;
      activePanel = null;
      map = null;
      contactsHost = null;
      districtHost = null;
      pendingHost = null;
    };

    const mount = () => {
      if (!media.matches) {
        teardown();
        return;
      }
      const fullMap = document.querySelector<HTMLElement>(".workspace .full-map");
      const contacts = document.querySelector<HTMLElement>(".vf-mobile-contacts-host");
      const districts = document.querySelector<HTMLElement>(".vf-mobile-district-host");
      if (!fullMap || !contacts || !districts) return;

      if (map && map !== fullMap) teardown();
      map = fullMap;
      contactsHost = contacts;
      districtHost = districts;
      pendingHost = isAdm ? closestPendingHost(fullMap) : null;

      if (!shell?.isConnected) {
        shell = document.createElement("nav");
        shell.className = `vf-map-desktop-tools${isAdm ? " is-adm" : ""}`;
        shell.setAttribute("aria-label", "Ferramentas do mapa eleitoral");
        shell.append(makeTool("Contatos", "👥", "contacts"), makeTool("Bairros", "⌖", "districts"));
        if (isAdm) shell.append(makeTool("Pendências", "!", "pending"));
        contactsHost.insertAdjacentElement("beforebegin", shell);
        shell
          .querySelectorAll<HTMLButtonElement>("[data-vf-map-desktop-action]")
          .forEach((button) => {
            const handler = () => setPanel(button.dataset.vfMapDesktopAction as Exclude<Panel, null>);
            button.addEventListener("click", handler);
            cleanupFns.push(() => button.removeEventListener("click", handler));
          });
      }
      apply();
    };

    mount();
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", mount);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", mount);
      teardown();
    };
  }, [isAdm]);

  return null;
}
