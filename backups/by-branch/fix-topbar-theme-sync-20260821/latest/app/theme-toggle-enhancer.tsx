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

    const install = () => {
      if (stopped) return;
      const topActions = document.querySelector<HTMLElement>(".top-actions");
      if (!topActions || topActions.querySelector("[data-vf-theme-toggle]")) return;

      const municipalitySelect = Array.from(topActions.querySelectorAll("select")).find((select) =>
        Array.from(select.options).some((option) => /arapongas|munic/i.test(option.textContent || "")),
      );

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.vfThemeToggle = "true";
      button.className = "vf-theme-toggle";

      const sync = () => {
        const theme = (document.documentElement.dataset.vfTheme as Theme) || "dark";
        button.textContent = theme === "dark" ? "☀️" : "🌙";
        button.title = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
        button.setAttribute("aria-label", button.title);
      };

      button.addEventListener("click", () => {
        const current = (document.documentElement.dataset.vfTheme as Theme) || "dark";
        const next: Theme = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
        sync();
      });

      sync();
      if (municipalitySelect) municipalitySelect.insertAdjacentElement("afterend", button);
      else topActions.prepend(button);
    };

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      stopped = true;
      observer.disconnect();
      document.querySelectorAll("[data-vf-theme-toggle]").forEach((el) => el.remove());
    };
  }, []);

  return null;
}
