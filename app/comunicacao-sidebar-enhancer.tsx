"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PENDING_VIEW_KEY = "vf-pending-dashboard-view";

function normalizedText(element: Element | null) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function findDashboardShell() {
  return Array.from(document.querySelectorAll<HTMLElement>(".app-shell")).find(
    (shell) => Boolean(shell.querySelector(":scope > main .workspace")),
  );
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
    let pendingTimer = 0;

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
        pendingTimer = window.setTimeout(
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

    const ensureAgendaSidebarItem = () => {
      const shell = findDashboardShell();
      const nav = shell?.querySelector<HTMLElement>(":scope > .sidebar nav");
      if (!shell || !nav) return;

      consumePendingDashboardView(nav);

      const nativeAgenda = findNavigationButton(nav, "Agenda Inteligente");
      if (nativeAgenda) return;

      const existing = nav.querySelector<HTMLButtonElement>(
        ".vf-comunicacao-sidebar-btn",
      );
      if (existing) return;

      const contactsButton = findNavigationButton(nav, "Contatos");
      const mapButton = findNavigationButton(nav, "Mapa Eleitoral");

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
        window.dispatchEvent(
          new CustomEvent("voto-forte:close-mobile-sidebar"),
        );
        router.push("/comunicacao-institucional");
      });

      if (contactsButton?.nextSibling) {
        nav.insertBefore(btn, contactsButton.nextSibling);
      } else if (mapButton) {
        nav.insertBefore(btn, mapButton);
      } else {
        nav.appendChild(btn);
      }
    };

    ensureAgendaSidebarItem();
    const observer = new MutationObserver(ensureAgendaSidebarItem);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (pendingTimer) window.clearTimeout(pendingTimer);
    };
  }, [router]);

  return null;
}
