"use client";

import { useEffect } from "react";

const NEW_EVENT_SELECTOR =
  '.vf-agenda-official-shell .ae-toolbar > button.ae-btn-primary[title="Cadastrar novo compromisso na agenda (N)"]';

export default function AgendaDesktopNewEventFallback() {
  useEffect(() => {
    const handleNewEventClick = (event: MouseEvent) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest<HTMLButtonElement>(NEW_EVENT_SELECTOR);
      if (!button) return;

      window.requestAnimationFrame(() => {
        // Se o React original abriu o modal, nao faz nada.
        if (document.querySelector(".vf-agenda-official-shell .ae-modal")) return;

        // Fallback seguro: reutiliza o atalho nativo da propria Agenda.
        // O componente oficial escuta a tecla N no document e chama openModal(null).
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "n",
            code: "KeyN",
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    };

    document.addEventListener("click", handleNewEventClick, true);
    return () => document.removeEventListener("click", handleNewEventClick, true);
  }, []);

  return null;
}
