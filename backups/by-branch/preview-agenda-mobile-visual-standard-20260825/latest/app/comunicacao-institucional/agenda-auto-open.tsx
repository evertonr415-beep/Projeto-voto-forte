"use client";

import { useEffect } from "react";

const AGENDA_KPI_ARIA_LABEL = "Reuniões agendadas: Abrir agenda inteligente";

export default function AgendaAutoOpen() {
  useEffect(() => {
    let completed = false;
    let timeoutId = 0;

    const tryOpenAgenda = () => {
      if (completed) return true;

      const dashboard = document.querySelector<HTMLElement>(".app-shell");
      if (!dashboard) return false;

      const currentTitle = dashboard.querySelector<HTMLElement>(".topbar .page-id h1");
      if (currentTitle?.textContent?.trim() === "Agenda Inteligente") {
        completed = true;
        return true;
      }

      const agendaKpi = dashboard.querySelector<HTMLButtonElement>(
        `button[aria-label="${AGENDA_KPI_ARIA_LABEL}"]`,
      );
      if (!agendaKpi) return false;

      completed = true;
      agendaKpi.click();
      return true;
    };

    if (tryOpenAgenda()) return;

    const observer = new MutationObserver(() => {
      if (!tryOpenAgenda()) return;
      observer.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    timeoutId = window.setTimeout(() => observer.disconnect(), 15_000);

    return () => {
      completed = true;
      observer.disconnect();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
