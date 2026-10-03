"use client";

import { useEffect } from "react";

const NEW_EVENT_SELECTOR =
  '.vf-agenda-official-shell .ae-toolbar > button.ae-btn-primary[title="Cadastrar novo compromisso na agenda (N)"]';
const MODAL_SELECTOR = ".vf-agenda-official-shell .ae-modal";

function alignDesktopModal(modal: HTMLElement) {
  if (!window.matchMedia("(min-width: 1024px)").matches) return;

  const root = modal.closest<HTMLElement>(".ae-root");
  if (!root) return;

  const rootRect = root.getBoundingClientRect();
  const topGutter = 82;
  const bottomGutter = 18;
  const availableHeight = Math.max(420, window.innerHeight - topGutter - bottomGutter);

  // Mantem o formulario dentro da area util do desktop, abaixo do cabecalho.
  modal.style.setProperty("position", "absolute", "important");
  modal.style.setProperty("inset", "auto", "important");
  modal.style.setProperty("top", `${topGutter - rootRect.top}px`, "important");
  modal.style.setProperty("left", "0", "important");
  modal.style.setProperty("right", "0", "important");
  modal.style.setProperty("width", "100%", "important");
  modal.style.setProperty("height", `${availableHeight}px`, "important");
  modal.style.setProperty("min-height", "0", "important");
  modal.style.setProperty("margin", "0", "important");
  modal.style.setProperty("padding", "14px 24px", "important");
  modal.style.setProperty("display", "flex", "important");
  modal.style.setProperty("align-items", "center", "important");
  modal.style.setProperty("justify-content", "center", "important");
  modal.style.setProperty("overflow", "hidden", "important");
  modal.style.setProperty("z-index", "2147483000", "important");

  const card = modal.querySelector<HTMLElement>(".ae-modal-card");
  if (card) {
    card.style.setProperty("width", "min(640px, calc(100% - 24px))", "important");
    card.style.setProperty("max-height", `${Math.max(380, availableHeight - 28)}px`, "important");
    card.style.setProperty("margin", "auto", "important");
    card.style.setProperty("overflow", "hidden", "important");
  }
}

export default function AgendaDesktopNewEventFallback() {
  useEffect(() => {
    const syncOpenModal = () => {
      const modal = document.querySelector<HTMLElement>(MODAL_SELECTOR);
      if (modal) alignDesktopModal(modal);
    };

    const handleNewEventClick = (event: MouseEvent) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest<HTMLButtonElement>(NEW_EVENT_SELECTOR);
      if (!button) return;

      window.requestAnimationFrame(() => {
        const modal = document.querySelector<HTMLElement>(MODAL_SELECTOR);
        if (modal) {
          alignDesktopModal(modal);
          return;
        }

        // Reutiliza o atalho nativo da Agenda para preservar a logica oficial.
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "n",
            code: "KeyN",
            bubbles: true,
            cancelable: true,
          }),
        );

        window.requestAnimationFrame(syncOpenModal);
      });
    };

    const observer = new MutationObserver(() => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      window.requestAnimationFrame(syncOpenModal);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleNewEventClick, true);
    window.addEventListener("resize", syncOpenModal);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleNewEventClick, true);
      window.removeEventListener("resize", syncOpenModal);
    };
  }, []);

  return null;
}
