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
          el.textContent?.includes("Comunicação Institucional"),
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
      btn.title = "Comunicação Institucional & Editorial";
      btn.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.color = "#a78bfa";
      icon.textContent = "📢";

      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = "Comunicação Institucional";

      const badge = document.createElement("em");
      badge.style.background = "rgba(167, 139, 250, 0.2)";
      badge.style.color = "#c4b5fd";
      badge.style.border = "1px solid rgba(167, 139, 250, 0.4)";
      badge.textContent = "EDITORIAL";

      btn.append(icon, name, badge);

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
