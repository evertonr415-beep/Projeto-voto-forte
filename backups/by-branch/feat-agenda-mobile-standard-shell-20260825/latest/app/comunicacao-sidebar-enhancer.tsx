"use client";

import { useEffect } from "react";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function findNavigationButton(nav: HTMLElement, label: string) {
  return Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) =>
      normalizedText(button.querySelector(".nav-name")).toLocaleLowerCase("pt-BR") ===
      label.toLocaleLowerCase("pt-BR"),
  );
}

function findAgendaTrigger(shell: HTMLElement) {
  return Array.from(
    shell.querySelectorAll<HTMLElement>("button, [role='button']"),
  ).find((element) => {
    const text = normalizedText(element).toLocaleLowerCase("pt-BR");
    return (
      text.includes("abrir agenda inteligente") ||
      text.includes("ver agenda completa")
    );
  });
}

export default function ComunicacaoSidebarEnhancer() {
  useEffect(() => {
    let agendaNavigationObserver: MutationObserver | null = null;
    let agendaNavigationTimeout = 0;

    const stopAgendaNavigation = () => {
      agendaNavigationObserver?.disconnect();
      agendaNavigationObserver = null;
      if (agendaNavigationTimeout) {
        window.clearTimeout(agendaNavigationTimeout);
        agendaNavigationTimeout = 0;
      }
    };

    const openAgendaInsideDashboard = (nav: HTMLElement) => {
      stopAgendaNavigation();

      const shell = document.querySelector<HTMLElement>(".app-shell");
      if (!shell) return;

      const openAgenda = () => {
        const trigger = findAgendaTrigger(shell);
        if (!trigger) return false;
        trigger.click();
        stopAgendaNavigation();
        return true;
      };

      const overviewButton = findNavigationButton(nav, "Visão Geral");
      if (overviewButton && !overviewButton.classList.contains("active")) {
        overviewButton.click();
      }

      if (openAgenda()) return;

      const workspace = shell.querySelector<HTMLElement>(".workspace") || shell;
      agendaNavigationObserver = new MutationObserver(() => {
        openAgenda();
      });
      agendaNavigationObserver.observe(workspace, {
        childList: true,
        subtree: true,
      });

      // A Visão Geral sempre oferece um acesso nativo para a Agenda.
      // O prazo apenas evita manter um observer vivo caso a tela seja desmontada.
      agendaNavigationTimeout = window.setTimeout(stopAgendaNavigation, 2500);
    };

    const ensureComunicacaoSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return;

      // Se o botão já existe ou já é um item nativo do menu, não duplica.
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

      // Inserção ordenada: logo abaixo de "Informações TSE" ou "Disparo em Massa".
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
