"use client";

import { useEffect } from "react";
import styles from "../shared-back-navigation.module.css";
import "./team-back-navigation.module.css";

export default function TeamBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let backLink: HTMLAnchorElement | null = null;
    let actions: HTMLElement | null = null;

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".team-intelligence-shell");
      actions = document.querySelector<HTMLElement>(".team-intelligence-header-actions");
      if (!shell || !actions) return false;

      actions.classList.add("vf-team-actions-hidden");

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
        actions?.classList.remove("vf-team-actions-hidden");
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
      actions?.classList.remove("vf-team-actions-hidden");
    };
  }, []);

  return null;
}
