"use client";

import { useEffect } from "react";

const AGENDA_KPI_ARIA_LABEL = "Reuniões agendadas: Abrir agenda inteligente";

function openAgendaInsideDashboard() {
  window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));
  window.dispatchEvent(new CustomEvent("voto-forte:navigate-overview"));

  let attempts = 0;
  const clickAgendaKpi = () => {
    const agendaKpi = document.querySelector<HTMLButtonElement>(
      `button[aria-label="${AGENDA_KPI_ARIA_LABEL}"]`,
    );

    if (agendaKpi) {
      agendaKpi.click();
      return;
    }

    attempts += 1;
    if (attempts < 30) {
      window.setTimeout(clickAgendaKpi, 80);
    }
  };

  window.setTimeout(clickAgendaKpi, 0);
}

export default function ComunicacaoSidebarEnhancer() {
  useEffect(() => {
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

      btn.addEventListener("click", openAgendaInsideDashboard);

      // Mantém a posição já usada no menu atual.
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

    return () => observer.disconnect();
  }, []);

  return null;
}
