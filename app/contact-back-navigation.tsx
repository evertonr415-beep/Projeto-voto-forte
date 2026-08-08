"use client";

import { useEffect } from "react";
import styles from "./contact-back-navigation.module.css";

export default function ContactBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let backLink: HTMLAnchorElement | null = null;
    let hiddenLink: HTMLElement | null = null;
    let actions: HTMLElement | null = null;

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".optimized-shell");
      actions = document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (!shell || !actions) return false;

      const systemLink = Array.from(actions.querySelectorAll<HTMLElement>("a")).find(
        (item) => item.textContent?.includes("Sistema completo"),
      );

      if (systemLink) {
        hiddenLink = systemLink;
        systemLink.style.display = "none";
      }

      actions.classList.add("vf-contact-actions");

      backLink = document.createElement("a");
      backLink.href = "/sistema-completo";
      backLink.className = styles.backLink;
      backLink.setAttribute("aria-label", "Voltar ao sistema completo");

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
        actions?.classList.remove("vf-contact-actions");
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
      actions?.classList.remove("vf-contact-actions");
    };
  }, []);

  return null;
}
