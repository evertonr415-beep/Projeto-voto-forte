"use client";

import { useEffect } from "react";

export default function SurveyIntelligenceSidebarEnhancer() {
  useEffect(() => {
    let frame = 0;
    const ensureSidebarItem = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav || nav.querySelector(".vf-survey-intelligence-sidebar-btn")) return;

      const broadcastBtn = nav.querySelector(".whaticket-broadcast-sidebar-btn");
      const comunicacaoBtn = nav.querySelector(".vf-comunicacao-sidebar-btn");
      const anchor = comunicacaoBtn?.nextSibling || broadcastBtn?.nextSibling || nav.querySelector(".administration-nav-item") || null;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "vf-survey-intelligence-sidebar-btn";
      button.title = "Sondagem & Apuração WhatsApp";
      button.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.color = "#38bdf8";
      icon.textContent = "📊";

      const label = document.createElement("span");
      label.className = "nav-name";
      label.textContent = "Sondagem & Votos";

      button.append(icon, label);
      button.addEventListener("click", () => {
        const appShell = document.querySelector(".app-shell");
        if (appShell) appShell.classList.remove("collapsed");
        window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));
        window.dispatchEvent(new CustomEvent("voto-forte:open-survey-intelligence"));
      });

      if (anchor) nav.insertBefore(button, anchor);
      else nav.appendChild(button);
    };

    ensureSidebarItem();
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        ensureSidebarItem();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
