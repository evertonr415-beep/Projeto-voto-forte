"use client";

import { useEffect } from "react";

/**
 * No mobile, a lista do Painel de Contatos deve iniciar recolhida toda vez que
 * o usuário entra nessa tela pela navegação SPA. Depois que o usuário tocar em
 * "Ver lista", a lista permanece aberta enquanto ele continuar nessa tela.
 */
export default function MobileContactListDefaultCollapsed() {
  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;

    let disposed = false;
    let panelWasPresent = false;
    let handledCurrentVisit = false;
    let retryTimer: number | undefined;

    const getPanel = () =>
      document.querySelector<HTMLElement>(".contacts-panel");

    const getToggleButton = (panel: HTMLElement) =>
      Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
        const label = button.textContent?.trim().toLowerCase();
        return label === "ocultar lista" || label === "ver lista";
      }) || null;

    const clearRetry = () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };

    const tryCollapseCurrentVisit = () => {
      if (disposed || handledCurrentVisit) return;

      const panel = getPanel();
      if (!panel) return;

      const button = getToggleButton(panel);
      if (!button) {
        clearRetry();
        retryTimer = window.setTimeout(tryCollapseCurrentVisit, 100);
        return;
      }

      const label = button.textContent?.trim().toLowerCase();

      // Se já estiver recolhida, esta visita já está correta.
      if (label === "ver lista") {
        handledCurrentVisit = true;
        clearRetry();
        return;
      }

      // Aguarda o handler React estar disponível; confirma na próxima leitura.
      if (label === "ocultar lista" && !button.disabled) {
        button.click();
        clearRetry();
        retryTimer = window.setTimeout(tryCollapseCurrentVisit, 80);
      }
    };

    const syncRoutePresence = () => {
      if (disposed) return;

      const panelPresent = Boolean(getPanel());

      // Transição real: usuário entrou no Painel de Contatos.
      if (panelPresent && !panelWasPresent) {
        handledCurrentVisit = false;
        clearRetry();
        retryTimer = window.setTimeout(tryCollapseCurrentVisit, 80);
      }

      // Saiu da tela: prepara a próxima entrada para começar recolhida novamente.
      if (!panelPresent && panelWasPresent) {
        handledCurrentVisit = false;
        clearRetry();
      }

      panelWasPresent = panelPresent;
    };

    const observer = new MutationObserver(syncRoutePresence);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Cobre também acesso direto/refresh já dentro da tela de contatos.
    syncRoutePresence();

    return () => {
      disposed = true;
      observer.disconnect();
      clearRetry();
    };
  }, []);

  return null;
}
