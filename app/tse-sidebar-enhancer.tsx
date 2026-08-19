"use client";

import { useEffect } from "react";

export default function TseSidebarEnhancer() {
  useEffect(() => {
    const ensureTseSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return;

      // Se o botão já existe, não duplica
      if (nav.querySelector(".tse-info-sidebar-btn")) return;

      const broadcastBtn = nav.querySelector(".whaticket-broadcast-sidebar-btn");
      const exportHistoryBtn = nav.querySelector(".vf-export-history-nav-item, [data-vf-export-history-nav]");
      const adminBtn = nav.querySelector(".administration-nav-item");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tse-info-sidebar-btn";
      btn.title = "Informações TSE";
      btn.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.color = "#38bdf8";
      icon.textContent = "🏛️";

      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = "Informações TSE";

      const badge = document.createElement("em");
      badge.style.background = "rgba(56, 189, 248, 0.2)";
      badge.style.color = "#38bdf8";
      badge.style.border = "1px solid rgba(56, 189, 248, 0.4)";
      badge.textContent = "TSE";

      btn.append(icon, name, badge);

      btn.addEventListener("click", () => {
        // Fecha o menu mobile se estiver aberto
        const appShell = document.querySelector(".app-shell");
        if (appShell) appShell.classList.remove("collapsed");
        window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));

        // Abre a gaveta oficial do TSE
        window.dispatchEvent(
          new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
            detail: { district: "Todos os Bairros (Geral - Arapongas)", initialTab: "electoral" },
          }),
        );
      });

      // Inserção ordenada: logo abaixo de "Disparo em Massa" ou antes de "Histórico de exportações"
      if (broadcastBtn && broadcastBtn.nextSibling) {
        nav.insertBefore(btn, broadcastBtn.nextSibling);
      } else if (exportHistoryBtn) {
        nav.insertBefore(btn, exportHistoryBtn);
      } else if (adminBtn) {
        nav.insertBefore(btn, adminBtn);
      } else {
        nav.appendChild(btn);
      }
    };

    ensureTseSidebarItem();
    const observer = new MutationObserver(ensureTseSidebarItem);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
