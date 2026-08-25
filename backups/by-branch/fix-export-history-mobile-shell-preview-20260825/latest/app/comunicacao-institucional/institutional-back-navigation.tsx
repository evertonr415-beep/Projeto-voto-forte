"use client";

import { useEffect } from "react";
import styles from "../shared-back-navigation.module.css";

export default function InstitutionalBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let backLink: HTMLAnchorElement | null = null;

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".vf-ic-shell");
      if (!shell) return false;

      // Verifica se já existe
      if (shell.querySelector(".vf-ic-back-link")) return true;

      backLink = document.createElement("a");
      backLink.href = "/contatos";
      backLink.className = `${styles.backLink} vf-ic-back-link`;
      backLink.setAttribute("aria-label", "Voltar ao painel principal");

      const arrow = document.createElement("span");
      arrow.className = styles.arrow;
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "←";

      const label = document.createElement("span");
      label.textContent = "Voltar ao Painel Geral";

      backLink.append(arrow, label);
      shell.prepend(backLink);
      return true;
    };

    if (install()) {
      return () => {
        cancelled = true;
        backLink?.remove();
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
    };
  }, []);

  return null;
}
