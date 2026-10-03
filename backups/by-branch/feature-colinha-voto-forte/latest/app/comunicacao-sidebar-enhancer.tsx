"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ComunicacaoSidebarEnhancer() {
  const router = useRouter();

  useEffect(() => {
    const ensureComunicacaoSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return;

      // Se o botão já existe ou já é um item nativo do menu, não duplica
      if (
        nav.querySelector(".vf-comunicacao-sidebar-btn") ||
        Array.from(nav.querySelectorAll(".nav-name, button")).some((el) =>
          el.textContent?.includes("Agenda Inteligente"),
        )
      )
        return;

      const tseBtn = nav.querySelector(".tse-info-sidebar-btn");
      const broadcastBtn = nav.querySelector(".whaticket-broadcast-sidebar-btn");
      const exportHistoryBtn = nav.querySelector(".vf-export-history-nav-item, [data-vf-export-history-nav]");
      const adminBtn = nav.querySelector(".administration-nav-item");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vf-comunicacao-sidebar-btn";
      btn.title = "Agenda Inteligente";
      btn.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.cssText = "color:#C9A84C;display:inline-flex;align-items:center;";
      icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = "Agenda Inteligente";

      btn.append(icon, name);

      btn.addEventListener("click", () => {
        // Fecha o menu mobile se estiver aberto
        const appShell = document.querySelector(".app-shell");
        if (appShell) appShell.classList.remove("collapsed");
        window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));

        // Navega para a rota de comunicação institucional
        router.push("/comunicacao-institucional");
      });

      // Inserção ordenada: logo abaixo de "Informações TSE" ou "Disparo em Massa"
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
  }, [router]);

  return null;
}
