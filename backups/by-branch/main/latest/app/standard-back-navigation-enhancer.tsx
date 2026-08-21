"use client";

import { useEffect } from "react";
import styles from "./shared-back-navigation.module.css";

type Target = {
  rootSelector: string;
  shellSelector: string;
  legacySelector: string;
};

const targets: Target[] = [
  {
    rootSelector: ".tse-panel-root",
    shellSelector: ".tse-panel-shell",
    legacySelector: ".vf-back-dashboard-btn",
  },
  {
    rootSelector: ".ae-root",
    shellSelector: ".ae-shell",
    legacySelector: ".ae-btn-ghost",
  },
];

export default function StandardBackNavigationEnhancer() {
  useEffect(() => {
    let cancelled = false;

    const install = () => {
      if (cancelled) return;

      targets.forEach(({ rootSelector, shellSelector, legacySelector }) => {
        const root = document.querySelector<HTMLElement>(rootSelector);
        const shell = root?.querySelector<HTMLElement>(shellSelector);
        if (!root || !shell) return;

        if (!shell.querySelector("[data-vf-standard-back='true']")) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.vfStandardBack = "true";
          button.className = styles.backLink;
          button.setAttribute("aria-label", "Voltar para a Visão Geral");

          const arrow = document.createElement("span");
          arrow.className = styles.arrow;
          arrow.setAttribute("aria-hidden", "true");
          arrow.textContent = "←";

          const label = document.createElement("span");
          label.textContent = "Voltar";

          button.append(arrow, label);
          button.addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("voto-forte:navigate-overview"));
          });

          shell.prepend(button);
        }

        root.querySelectorAll<HTMLElement>(legacySelector).forEach((legacy) => {
          const text = (legacy.textContent || "").toLocaleLowerCase("pt-BR");
          if (
            rootSelector === ".tse-panel-root" ||
            text.includes("dashboard") ||
            text.includes("voltar")
          ) {
            legacy.dataset.vfHiddenLegacyBack = "true";
            legacy.style.display = "none";
          }
        });
      });
    };

    install();

    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();

      document
        .querySelectorAll<HTMLElement>("[data-vf-standard-back='true']")
        .forEach((element) => element.remove());

      document
        .querySelectorAll<HTMLElement>("[data-vf-hidden-legacy-back='true']")
        .forEach((element) => {
          element.style.removeProperty("display");
          delete element.dataset.vfHiddenLegacyBack;
        });
    };
  }, []);

  return null;
}
