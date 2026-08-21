"use client";

import { useEffect } from "react";

/**
 * No mobile, mantém a lista pesada de contatos recolhida ao abrir o painel.
 * Aguarda a hidratação do React antes de acionar o botão existente e confirma
 * que o estado visual realmente mudou para "Ver lista".
 */
export default function MobileContactListDefaultCollapsed() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;

    let disposed = false;
    let attempts = 0;
    let timer: number | undefined;

    const findToggleButton = () => {
      const panel = document.querySelector<HTMLElement>(".contacts-panel");
      if (!panel) return null;

      return Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const label = button.textContent?.trim().toLowerCase();
        return label === "ocultar lista" || label === "ver lista";
      }) || null;
    };

    const ensureCollapsed = () => {
      if (disposed) return;

      const button = findToggleButton();
      const label = button?.textContent?.trim().toLowerCase();

      if (label === "ver lista") return;

      if (button && label === "ocultar lista" && !button.disabled) {
        button.click();
      }

      attempts += 1;
      if (attempts < 40) {
        timer = window.setTimeout(ensureCollapsed, 125);
      }
    };

    // Pequeno atraso para garantir que os handlers do painel já estejam hidratados.
    timer = window.setTimeout(ensureCollapsed, 250);

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
