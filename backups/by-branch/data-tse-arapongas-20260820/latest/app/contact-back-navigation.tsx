"use client";

import { useEffect } from "react";
import styles from "./shared-back-navigation.module.css";
import "./contact-back-navigation.module.css";

export default function ContactBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let backLink: HTMLAnchorElement | null = null;
    let hiddenSystemLink: HTMLElement | null = null;
    let hiddenRefreshButton: HTMLElement | null = null;
    let actions: HTMLElement | null = null;

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".optimized-shell");
      actions = document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (!shell || !actions) return false;

      const systemLink = Array.from(actions.querySelectorAll<HTMLElement>("a")).find(
        (item) => item.textContent?.includes("Sistema completo"),
      );
      const refreshButton = Array.from(actions.querySelectorAll<HTMLElement>("button")).find(
        (item) => item.textContent?.includes("Atualizar painel"),
      );

      if (systemLink) {
        hiddenSystemLink = systemLink;
        systemLink.style.display = "none";
      }

      if (refreshButton) {
        hiddenRefreshButton = refreshButton;
        refreshButton.style.display = "none";
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

    const restore = () => {
      backLink?.remove();
      hiddenSystemLink?.style.removeProperty("display");
      hiddenRefreshButton?.style.removeProperty("display");
      actions?.classList.remove("vf-contact-actions");
    };

    if (install()) {
      return () => {
        cancelled = true;
        restore();
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
      restore();
    };
  }, []);

  return null;
}
