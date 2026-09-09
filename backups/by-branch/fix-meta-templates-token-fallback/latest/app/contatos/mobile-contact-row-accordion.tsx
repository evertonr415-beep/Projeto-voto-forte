"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 760px)";
const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, label";

function setExpanded(row: HTMLTableRowElement, expanded: boolean) {
  row.classList.toggle("is-expanded", expanded);
  const toggle = row.querySelector<HTMLButtonElement>(".vf-mobile-contact-toggle");
  if (!toggle) return;
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.setAttribute(
    "aria-label",
    expanded ? "Ocultar detalhes do contato" : "Mostrar detalhes do contato",
  );
}

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
          if (row.dataset.vfMobileAccordion === "ready") return;

          const contactCell = row.querySelector<HTMLElement>(".optimized-contact-cell");
          if (!contactCell) return;

          row.dataset.vfMobileAccordion = "ready";
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "vf-mobile-contact-toggle";
          toggle.textContent = "›";
          toggle.setAttribute("aria-expanded", "false");
          toggle.setAttribute("aria-label", "Mostrar detalhes do contato");
          contactCell.appendChild(toggle);

          const toggleRow = () => setExpanded(row, !row.classList.contains("is-expanded"));

          toggle.addEventListener("click", toggleRow);
          row.addEventListener("click", (event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest(INTERACTIVE_SELECTOR)) return;
            toggleRow();
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
        .querySelectorAll<HTMLTableRowElement>(".contacts-route-scope .vf-mobile-contact-row")
        .forEach((row) => setExpanded(row, false));
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
