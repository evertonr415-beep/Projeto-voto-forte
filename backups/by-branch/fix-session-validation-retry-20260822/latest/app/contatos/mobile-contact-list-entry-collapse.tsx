"use client";

import { useEffect } from "react";

/**
 * Executa somente na rota /contatos. No mobile, garante que a primeira
 * apresentação do painel venha recolhida. Como este componente monta junto
 * com a própria rota, ele funciona também na navegação SPA sem depender do
 * carregamento inicial da aplicação.
 */
export default function MobileContactListEntryCollapse() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;

    let disposed = false;
    let finished = false;
    let timer: number | undefined;

    const findToggle = () => {
      const panel = document.querySelector<HTMLElement>(".contacts-panel");
      if (!panel) return null;
      return (
        Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => {
            const label = button.textContent?.trim().toLowerCase();
            return label === "ocultar lista" || label === "ver lista";
          },
        ) || null
      );
    };

    const ensureCollapsed = () => {
      if (disposed || finished) return;

      const button = findToggle();
      const label = button?.textContent?.trim().toLowerCase();

      if (label === "ver lista") {
        finished = true;
        return;
      }

      if (button && label === "ocultar lista" && !button.disabled) {
        button.click();
      }

      timer = window.setTimeout(ensureCollapsed, 100);
    };

    // A rota já está ativa; aguardamos apenas o NeutralDashboardClient montar.
    timer = window.setTimeout(ensureCollapsed, 0);

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
