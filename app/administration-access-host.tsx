"use client";

import { useEffect, useState } from "react";
import UserHierarchyPanel from "./user-hierarchy-panel";

const FILTER_SELECTOR = '.management-filter[role="tablist"][aria-label="Seções administrativas"]';
const HOST_SELECTOR = ':scope > [data-vf-access-stable-host]';
const SUSPENDED_SELECTOR = '[data-vf-native-users-grid-suspended="true"]';

function restoreNativeGrids() {
  document.querySelectorAll<HTMLElement>(SUSPENDED_SELECTOR).forEach((grid) => {
    grid.classList.add("users-admin-grid");
    delete grid.dataset.vfNativeUsersGridSuspended;
  });
}

function suspendNativeGrids(host: HTMLElement) {
  document.querySelectorAll<HTMLElement>(".users-admin-grid").forEach((grid) => {
    if (grid === host) return;
    grid.classList.remove("users-admin-grid");
    grid.dataset.vfNativeUsersGridSuspended = "true";
  });
}

export default function AdministrationAccessHost() {
  const [accessActive, setAccessActive] = useState(false);

  useEffect(() => {
    let frame = 0;
    let currentParent: HTMLElement | null = null;
    let currentHost: HTMLElement | null = null;

    const deactivate = () => {
      setAccessActive(false);
      restoreNativeGrids();
      currentParent?.removeAttribute("data-vf-access-stable-active");
      currentHost?.style.setProperty("display", "none", "important");
    };

    const sync = () => {
      const filter = document.querySelector<HTMLElement>(FILTER_SELECTOR);
      if (!filter) {
        deactivate();
        currentParent = null;
        currentHost = null;
        return;
      }

      const parent = filter.parentElement;
      if (!parent) {
        deactivate();
        return;
      }

      if (currentParent && currentParent !== parent) {
        restoreNativeGrids();
        currentParent.removeAttribute("data-vf-access-stable-active");
      }
      currentParent = parent;

      let host = parent.querySelector<HTMLElement>(HOST_SELECTOR);
      if (!host) {
        host = document.createElement("div");
        host.className = "users-admin-grid vf-access-stable-host";
        host.dataset.vfAccessStableHost = "true";
        filter.insertAdjacentElement("afterend", host);
      }
      currentHost = host;

      const nativeTabs = Array.from(
        filter.querySelectorAll<HTMLButtonElement>("button:not([data-vf-municipalities-tab])"),
      );
      const accessButton = nativeTabs[0] || null;
      const accessSelected = Boolean(
        accessButton &&
          (accessButton.classList.contains("active") ||
            accessButton.getAttribute("aria-selected") === "true"),
      );
      const municipalitiesSelected = parent.dataset.vfMunicipalitiesActive === "true";
      const active = accessSelected && !municipalitiesSelected;

      if (active) {
        host.classList.add("users-admin-grid");
        suspendNativeGrids(host);
        parent.dataset.vfAccessStableActive = "true";
        host.style.setProperty("display", "block", "important");
        setAccessActive(true);
      } else {
        deactivate();
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected"],
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      restoreNativeGrids();
      currentParent?.removeAttribute("data-vf-access-stable-active");
      currentHost?.remove();
    };
  }, []);

  return (
    <>
      {accessActive ? <UserHierarchyPanel /> : null}
      <style jsx global>{`
        [data-vf-access-stable-active="true"]
          > .management-filter[role="tablist"][aria-label="Seções administrativas"]
          ~ *:not([data-vf-access-stable-host]) {
          display: none !important;
        }

        [data-vf-access-stable-host] {
          display: none !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        [data-vf-access-stable-active="true"] > [data-vf-access-stable-host] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </>
  );
}
