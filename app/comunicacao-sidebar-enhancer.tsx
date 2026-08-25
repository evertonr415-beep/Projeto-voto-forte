"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PENDING_VIEW_KEY = "vf-pending-dashboard-view";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function findNavigationButton(nav: HTMLElement, label: string) {
  const expected = label.toLocaleLowerCase("pt-BR");
  return Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) =>
      normalizedText(button.querySelector(".nav-name")).toLocaleLowerCase("pt-BR") ===
      expected,
  );
}

export default function ComunicacaoSidebarEnhancer() {
  const router = useRouter();

  useEffect(() => {
    let pendingNavigationTimer = 0;

    const consumePendingDashboardView = (nav: HTMLElement) => {
      let pendingView = "";
      try {
        pendingView = sessionStorage.getItem(PENDING_VIEW_KEY) || "";
      } catch {
        return;
      }
      if (!pendingView) return;

      const target = findNavigationButton(nav, pendingView);
      if (!target) {
        pendingNavigationTimer = window.setTimeout(
          () => consumePendingDashboardView(nav),
          80,
        );
        return;
      }

      try {
        sessionStorage.removeItem(PENDING_VIEW_KEY);
      } catch {}
      target.click();
    };

    const ensureComunicacaoSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return;

      consumePendingDashboardView(nav);

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
        const appShell = document.querySelector(".app-shell");
        if (appShell) appShell.classList.remove("collapsed");
        window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));

        // A agenda oficial e a pagina /comunicacao-institucional.
        // Mantemos essa origem para preservar exatamente o conteudo aprovado.
        router.push("/comunicacao-institucional");
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
      if (pendingNavigationTimer) window.clearTimeout(pendingNavigationTimer);
    };
  }, [router]);

  return null;
}
