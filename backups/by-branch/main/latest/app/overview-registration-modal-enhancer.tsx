"use client";

import { useEffect } from "react";

export default function OverviewRegistrationModalEnhancer() {
  useEffect(() => {
    let initialized = new WeakSet<HTMLElement>();

    const syncOverviewShortcut = () => {
      document.querySelectorAll<HTMLButtonElement>("button.kpi").forEach((button) => {
        const label = button.querySelector("b")?.textContent?.trim();
        if (label !== "Lideranças ativas") return;
        const helper = button.querySelector<HTMLElement>("small");
        if (helper && helper.textContent?.trim() !== "Cadastrar usuário") {
          helper.textContent = "Cadastrar usuário";
        }
      });
    };

    const sync = () => {
      syncOverviewShortcut();

      document.querySelectorAll<HTMLElement>(".app-shell .modal").forEach((modal) => {
        const form = modal.querySelector<HTMLFormElement>(".modal-form");
        if (!form) return;

        const profileSelect = Array.from(form.querySelectorAll<HTMLSelectElement>("select")).find(
          (select) =>
            Array.from(select.options).some((option) => option.textContent?.trim() === "Liderança") &&
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

          // O atalho da Visão Geral passa a ser um cadastro genérico para a pessoa.
          // Eleitor é o perfil inicial, mas o usuário pode trocar para Liderança.
          if (profileSelect.value !== "Eleitor") {
            profileSelect.value = "Eleitor";
            profileSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (profileSelect.disabled) {
          profileSelect.disabled = false;
          profileSelect.removeAttribute("disabled");
        }

        const leaderLabel = Array.from(form.querySelectorAll<HTMLLabelElement>("label")).find((label) =>
          label.textContent?.trim().startsWith("Liderança responsável"),
        );

        const syncLeaderField = () => {
          if (!leaderLabel) return;
          const isVoter = profileSelect.value === "Eleitor";
          leaderLabel.style.display = isVoter ? "" : "none";
          if (isVoter) {
            const input = leaderLabel.querySelector<HTMLInputElement>("input");
            if (leaderLabel.firstChild?.nodeType === Node.TEXT_NODE) {
              leaderLabel.firstChild.textContent = "Liderança vinculada (opcional)";
            }
            if (input) input.placeholder = "Nome da liderança, se houver";
          }
        };

        if (!profileSelect.dataset.vfLeaderFieldBound) {
          profileSelect.dataset.vfLeaderFieldBound = "true";
          profileSelect.addEventListener("change", syncLeaderField);
        }
        syncLeaderField();

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
      attributeFilter: ["disabled", "value"],
    });

    return () => {
      observer.disconnect();
      initialized = new WeakSet<HTMLElement>();
    };
  }, []);

  return null;
}
