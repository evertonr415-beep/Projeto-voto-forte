"use client";

import { useEffect } from "react";

const STORAGE_KEY = "voto-forte-theme";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.vfTheme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggleEnhancer() {
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) || "dark";
    applyTheme(saved);

    let stopped = false;
    let frameId = 0;
    let button: HTMLButtonElement | null = null;

    const syncButton = () => {
      if (!button) return;
      const theme = (document.documentElement.dataset.vfTheme as Theme) || "dark";
      button.textContent = theme === "dark" ? "☀️" : "🌙";
      button.title = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
      button.setAttribute("aria-label", button.title);
    };

    const ensureButton = () => {
      if (button?.isConnected) return button;

      const existing = document.querySelector<HTMLButtonElement>("[data-vf-theme-toggle]");
      if (existing) {
        button = existing;
        syncButton();
        return button;
      }

      button = document.createElement("button");
      button.type = "button";
      button.dataset.vfThemeToggle = "true";
      button.className = "vf-theme-toggle";
      button.addEventListener("click", () => {
        const current = (document.documentElement.dataset.vfTheme as Theme) || "dark";
        const next: Theme = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
        syncButton();
      });
      syncButton();
      return button;
    };

    const install = () => {
      frameId = 0;
      if (stopped) return;

      const themeButton = ensureButton();
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const topActions = topbar?.querySelector<HTMLElement>(".top-actions");
      const isMobile = window.matchMedia("(max-width: 760px)").matches;

      if (topbar && topActions) {
        themeButton.classList.remove("vf-theme-toggle-floating");

        if (isMobile) {
          const compactScope = topbar.querySelector<HTMLElement>(".page-id > .vf-header-scope");
          if (compactScope?.parentElement) {
            if (compactScope.nextElementSibling !== themeButton) {
              compactScope.insertAdjacentElement("afterend", themeButton);
            }
            return;
          }
        }

        const municipalitySelect = Array.from(topActions.querySelectorAll("select")).find((select) =>
          Array.from(select.options).some((option) => /arapongas|munic/i.test(option.textContent || "")),
        );

        if (municipalitySelect) {
          if (municipalitySelect.nextElementSibling !== themeButton) {
            municipalitySelect.insertAdjacentElement("afterend", themeButton);
          }
        } else if (topActions.firstElementChild !== themeButton) {
          topActions.prepend(themeButton);
        }
        return;
      }

      // Telas independentes (Painel de contatos, Agenda, Inteligência,
      // Importações, Exportações etc.) nem sempre possuem .topbar. Nelas,
      // mantém o mesmo alternador em posição fixa e acessível.
      if (themeButton.parentElement !== document.body) {
        document.body.appendChild(themeButton);
      }
      themeButton.classList.add("vf-theme-toggle-floating");
    };

    const scheduleInstall = () => {
      if (stopped || frameId) return;
      frameId = window.requestAnimationFrame(install);
    };

    install();
    const observer = new MutationObserver(scheduleInstall);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scheduleInstall);

    return () => {
      stopped = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleInstall);
      button?.remove();
    };
  }, []);

  return null;
}
