"use client";

import { useLayoutEffect } from "react";

/**
 * No mobile, mantém a lista pesada de contatos recolhida ao abrir o painel.
 * O desktop preserva o comportamento atual. O clique usa o próprio botão
 * existente para que toda a lógica de estado continue centralizada no painel.
 */
export default function MobileContactListDefaultCollapsed() {
  useLayoutEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;

    let done = false;

    const collapseIfOpen = () => {
      if (done) return true;
      const panel = document.querySelector<HTMLElement>(".contacts-panel");
      if (!panel) return false;

      const button = Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find(
        (item) => item.textContent?.trim().toLowerCase() === "ocultar lista",
      );
      if (!button) return false;

      done = true;
      button.click();
      return true;
    };

    if (collapseIfOpen()) return;

    const observer = new MutationObserver(() => {
      if (collapseIfOpen()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => observer.disconnect(), 5000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
