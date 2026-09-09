"use client";

import { useEffect } from "react";
import styles from "../shared-back-navigation.module.css";

export default function QualityBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let backLink: HTMLAnchorElement | null = null;
    let hiddenLink: HTMLElement | null = null;

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".issues-shell");
      const actions = document.querySelector<HTMLElement>(".issues-actions");
      if (!shell || !actions) return false;

      const currentBack = Array.from(actions.querySelectorAll<HTMLElement>("a")).find(
        (item) => item.textContent?.includes("Voltar ao painel"),
      );

      if (currentBack) {
        hiddenLink = currentBack;
        currentBack.style.display = "none";
      }

      backLink = document.createElement("a");
      backLink.href = "/contatos";
      backLink.className = styles.backLink;
      backLink.setAttribute("aria-label", "Voltar ao painel de contatos");

      const arrow = document.createElement("span");
      arrow.className = styles.arrow;
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "←";

      const label = document.createElement("span");
      label.textContent = "Voltar";

      backLink.append(arrow, label);
      shell.prepend(backLink);
      return true;
    };

    if (install()) {
      return () => {
        cancelled = true;
        backLink?.remove();
        if (hiddenLink) hiddenLink.style.removeProperty("display");
      };
    }

    const observer = new MutationObserver(() => {
      if (!install()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      backLink?.remove();
      if (hiddenLink) hiddenLink.style.removeProperty("display");
    };
  }, []);

  return null;
}
