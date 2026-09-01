"use client";

import { useEffect } from "react";

export default function OverviewRegistrationModalEnhancer() {
  useEffect(() => {
    let initialized = new WeakSet<HTMLElement>();

    const sync = () => {
      document.querySelectorAll<HTMLElement>(".app-shell .modal").forEach((modal) => {
        const form = modal.querySelector<HTMLFormElement>(".modal-form");
        if (!form) return;

        const profileSelect = Array.from(form.querySelectorAll<HTMLSelectElement>("select")).find(
          (select) => Array.from(select.options).some((option) => option.textContent?.trim() === "Liderança") &&
            Array.from(select.options).some((option) => option.textContent?.trim() === "Eleitor"),
        );
        if (!profileSelect) return;

        const heading = modal.querySelector<HTMLElement>("header h3");
        if (!heading) return;
        const isOverviewRegistration =
          heading.textContent?.trim() === "Cadastrar liderança" ||
          heading.textContent?.trim() === "Cadastro";
        if (!isOverviewRegistration) return;

        modal.classList.add("vf-overview-registration-modal");
        modal.parentElement?.classList.add("vf-overview-registration-backdrop");

        if (heading.textContent?.trim() !== "Cadastro") heading.textContent = "Cadastro";

        if (!initialized.has(modal)) {
          initialized.add(modal);

          profileSelect.disabled = false;
          profileSelect.removeAttribute("disabled");

          // O atalho antigo ainda nasce internamente como cadastro_lideranca.
          // Mudamos apenas a seleção inicial para Eleitor e disparamos o evento
          // normal do React para que o estado salvo corresponda ao que aparece.
          if (profileSelect.value !== "Eleitor") {
            profileSelect.value = "Eleitor";
            profileSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (profileSelect.disabled) {
          profileSelect.disabled = false;
          profileSelect.removeAttribute("disabled");
        }

        const cancel = Array.from(modal.querySelectorAll<HTMLButtonElement>(":scope > footer button")).find(
          (button) => button.textContent?.trim() === "Cancelar",
        );
        if (cancel) cancel.classList.add("vf-registration-cancel");
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    return () => {
      observer.disconnect();
      initialized = new WeakSet<HTMLElement>();
    };
  }, []);

  return null;
}
