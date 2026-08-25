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

    const syncAgendaActiveState = (nav: HTMLElement) => {
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const button = nav.querySelector<HTMLButtonElement>(".vf-comunicacao-sidebar-btn");
      if (!shell || !button) return;

      const isAgenda =
        currentViewTitle(shell) === "agenda inteligente" ||
        Boolean(shell.querySelector(".workspace .ae-root"));

      button.classList.toggle("active", isAgenda);
    };

    const openAgendaInsideDashboard = (nav: HTMLElement) => {
      stopAgendaNavigation();

      const shell = document.querySelector<HTMLElement>(".app-shell");
      if (!shell) return;

      const sync = () => {
        const title = currentViewTitle(shell);

        if (title === "agenda inteligente" || shell.querySelector(".workspace .ae-root")) {
          syncAgendaActiveState(nav);
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

      const existing = nav.querySelector<HTMLButtonElement>(".vf-comunicacao-sidebar-btn");
      if (existing) {
        syncAgendaActiveState(nav);
        return;
      }

      const nativeAgenda = Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => normalizedLower(button.querySelector(".nav-name")) === "agenda inteligente",
      );
      if (nativeAgenda) return;

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

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = "Agenda Inteligente";

      btn.append(icon, name);

      btn.addEventListener("click", () => {
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

      syncAgendaActiveState(nav);
    };

    ensureComunicacaoSidebarItem();
    const observer = new MutationObserver(ensureComunicacaoSidebarItem);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      stopAgendaNavigation();
    };
  }, []);

  return null;
}
