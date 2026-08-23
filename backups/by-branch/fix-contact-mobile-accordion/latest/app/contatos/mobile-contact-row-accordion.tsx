"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 760px)";
const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, label";

export default function MobileContactRowAccordion() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    let observer: MutationObserver | null = null;
    let disposed = false;

    const prepareRows = () => {
      if (disposed || !media.matches) return;

      document
        .querySelectorAll<HTMLTableRowElement>(
          ".contacts-route-scope .optimized-table-wrap tbody > tr",
        )
        .forEach((row) => {
          row.classList.add("vf-mobile-contact-row");
          row.tabIndex = 0;
          row.setAttribute("role", "button");
          if (!row.hasAttribute("aria-expanded")) {
            row.setAttribute("aria-expanded", "false");
          }

          if (row.dataset.vfMobileAccordion === "ready") return;
          row.dataset.vfMobileAccordion = "ready";

          const toggle = () => {
            const expanded = row.classList.toggle("is-expanded");
            row.setAttribute("aria-expanded", expanded ? "true" : "false");
          };

          row.addEventListener("click", (event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(INTERACTIVE_SELECTOR)) return;
            toggle();
          });

          row.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const target = event.target as HTMLElement | null;
            if (target?.closest(INTERACTIVE_SELECTOR)) return;
            event.preventDefault();
            toggle();
          });
        });
    };

    const attach = () => {
      prepareRows();
      const panel = document.querySelector<HTMLElement>(
        ".contacts-route-scope .contacts-panel",
      );
      if (!panel) return false;

      observer?.disconnect();
      observer = new MutationObserver(prepareRows);
      observer.observe(panel, { childList: true, subtree: true });
      return true;
    };

    if (!attach()) {
      const bodyObserver = new MutationObserver(() => {
        if (!attach()) return;
        bodyObserver.disconnect();
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });

      return () => {
        disposed = true;
        bodyObserver.disconnect();
        observer?.disconnect();
      };
    }

    const handleMediaChange = () => {
      if (media.matches) {
        prepareRows();
        return;
      }

      document
        .querySelectorAll<HTMLElement>(".contacts-route-scope .vf-mobile-contact-row")
        .forEach((row) => {
          row.classList.remove("is-expanded");
          row.removeAttribute("aria-expanded");
          row.removeAttribute("role");
          row.removeAttribute("tabindex");
        });
    };

    media.addEventListener("change", handleMediaChange);

    return () => {
      disposed = true;
      media.removeEventListener("change", handleMediaChange);
      observer?.disconnect();
    };
  }, []);

  return null;
}
