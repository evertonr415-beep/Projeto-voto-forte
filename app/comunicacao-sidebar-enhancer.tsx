"use client";

import { useEffect } from "react";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function normalizedLower(element: Element | null) {
  return normalizedText(element).toLocaleLowerCase("pt-BR");
}

function findNavigationButton(nav: HTMLElement, label: string) {
  const expected = label.toLocaleLowerCase("pt-BR");
  return Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => normalizedLower(button.querySelector(".nav-name")) === expected,
  );
}

function currentViewTitle(shell: HTMLElement) {
  return normalizedLower(shell.querySelector(".topbar .page-id h1"));
}

function findNativeAgendaKpi(shell: HTMLElement) {
  const candidates = Array.from(
    shell.querySelectorAll<HTMLButtonElement>(".workspace button.kpi.kpi-link"),
  ).filter((button) => {
    const label = normalizedLower(button.querySelector("b"));
    const hint = normalizedLower(button.querySelector("small"));
    return (
      label === "reuniões agendadas" &&
      hint.includes("abrir agenda inteligente")
    );
  });

  // Nunca escolhe por aproximação: se o KPI oficial não for único, não clica.
  return candidates.length === 1 ? candidates[0] : null;
}

export default function ComunicacaoSidebarEnhancer() {
  useEffect(() => {
    let agendaNavigationObserver: MutationObserver | null = null;
    let agendaNavigationTimeout = 0;
    let agendaTriggerClicked = false;

    const stopAgendaNavigation = () => {
      agendaNavigationObserver?.disconnect();
      agendaNavigationObserver = null;
      if (agendaNavigationTimeout) {
        window.clearTimeout(agendaNavigationTimeout);
        agendaNavigationTimeout = 0;
      }
      agendaTriggerClicked = false;
    };

    const openAgendaInsideDashboard = (nav: HTMLElement) => {
      stopAgendaNavigation();

      const shell = document.querySelector<HTMLElement>(".app-shell");
      if (!shell) return;

      const sync = () => {
        const title = currentViewTitle(shell);

        if (title === "agenda inteligente" || shell.querySelector(".ae-root")) {
          stopAgendaNavigation();
          return true;
        }

        if (title !== "visão geral" || agendaTriggerClicked) return false;

        const agendaKpi = findNativeAgendaKpi(shell);
        if (!agendaKpi) return false;

        agendaTriggerClicked = true;
        agendaKpi.click();
        return false;
      };

      const overviewButton = findNavigationButton(nav, "Visão Geral");
      if (overviewButton && !overviewButton.classList.contains("active")) {
        overviewButton.click();
      }

      sync();

      agendaNavigationObserver = new MutationObserver(sync);
      agendaNavigationObserver.observe(shell, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class"],
      });

      agendaNavigationTimeout = window.setTimeout(stopAgendaNavigation, 4000);
    };

    const ensureComunicacaoSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return;

      if (
        nav.querySelector(".vf-comunicacao-sidebar-btn") ||
        Array.from(nav.querySelectorAll(".nav-name, button")).some((el) =>
          el.textContent?.includes("Agenda Inteligente"),
        )
      )
        return;

      const tseBtn = nav.querySelector(".tse-info-sidebar-btn");
      const broadcastBtn = nav.querySelector(".whaticket-broadcast-sidebar-btn");
      const exportHistoryBtn = nav.querySelector(
        ".vf-export-history-nav-item, [data-vf-export-history-nav]",
      );
      const adminBtn = nav.querySelector(".administration-nav-item");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vf-comunicacao-sidebar-btn";
      btn.title = "Agenda Inteligente";
      btn.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.color = "#d3b16e";
      icon.textContent = "📅";

      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = "Agenda Inteligente";

      btn.append(icon, name);

      btn.addEventListener("click", () => {
        const appShell = document.querySelector<HTMLElement>(".app-shell");
        if (!appShell) return;

        appShell.classList.remove("collapsed");
        window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));
        openAgendaInsideDashboard(nav);
      });

      if (tseBtn && tseBtn.nextSibling) {
        nav.insertBefore(btn, tseBtn.nextSibling);
      } else if (broadcastBtn && broadcastBtn.nextSibling) {
        nav.insertBefore(btn, broadcastBtn.nextSibling);
      } else if (exportHistoryBtn) {
        nav.insertBefore(btn, exportHistoryBtn);
      } else if (adminBtn) {
        nav.insertBefore(btn, adminBtn);
      } else {
        nav.appendChild(btn);
      }
    };

    ensureComunicacaoSidebarItem();
    const observer = new MutationObserver(ensureComunicacaoSidebarItem);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      stopAgendaNavigation();
    };
  }, []);

  return null;
}
