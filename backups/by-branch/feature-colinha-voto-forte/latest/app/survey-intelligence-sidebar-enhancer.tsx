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
      button.title = "Apuração e Enquete Digital";
      button.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = "nav-icon";
      icon.style.cssText = "color:#C9A84C;display:inline-flex;align-items:center;";
      icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`;

      const label = document.createElement("span");
      label.className = "nav-name";
      label.textContent = "Enquete Digital";

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
