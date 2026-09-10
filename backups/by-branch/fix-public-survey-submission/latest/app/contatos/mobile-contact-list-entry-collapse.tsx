"use client";

import { useLayoutEffect } from "react";

/**
 * Executa somente na rota /contatos. No mobile, garante que a primeira
 * apresentação do painel venha recolhida antes do primeiro paint. Como este
 * componente monta junto com o painel, funciona também na navegação SPA.
 */
export default function MobileContactListEntryCollapse() {
  useLayoutEffect(() => {
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
        return;
      }

      timer = window.setTimeout(ensureCollapsed, 100);
    };

    // O DOM já foi commitado; recolhe imediatamente durante o layout effect,
    // antes de o navegador exibir um frame com a lista aberta.
    ensureCollapsed();

    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
