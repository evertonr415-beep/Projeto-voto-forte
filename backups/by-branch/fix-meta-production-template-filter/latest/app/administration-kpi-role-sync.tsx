"use client";

import { useEffect } from "react";

const labels: Record<string, { title: string; singular: string; plural: string }> = {
  ADM: { title: "ADMS CADASTRADOS", singular: "Usuário", plural: "Usuários" },
  GESTOR: { title: "GESTORES CADASTRADOS", singular: "Usuário", plural: "Usuários" },
  MASTER: { title: "MASTERS CADASTRADOS", singular: "Usuário", plural: "Usuários" },
  "LIDERANÇA": { title: "LIDERANÇAS CADASTRADAS", singular: "Cadastro", plural: "Cadastros" },
  LIDERADO: { title: "LIDERADOS CADASTRADOS", singular: "Usuário", plural: "Usuários" },
};

export default function AdministrationKpiRoleSync() {
  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;

      const panel = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      const activeTab = panel?.querySelector<HTMLElement>(".vf-hierarchy-role-tab.active");
      const kpiCards = document.querySelectorAll<HTMLElement>(".admin-kpis article");
      const userKpi = kpiCards.item(1);

      if (!activeTab || !userKpi) return;

      const role = activeTab.querySelector("small")?.textContent?.trim().toUpperCase() || "";
      const total = activeTab.querySelector("b")?.textContent?.trim() || "0";
      const config = labels[role];
      if (!config) return;

      const title = userKpi.querySelector<HTMLElement>("small");
      const value = userKpi.querySelector<HTMLElement>("b");
      const caption = userKpi.querySelector<HTMLElement>("span");
      const numericTotal = Number(total.replace(/\D/g, "")) || 0;

      if (title && title.textContent !== config.title) title.textContent = config.title;
      if (value && value.textContent !== total) value.textContent = total;
      if (caption) {
        const nextCaption = numericTotal === 1 ? config.singular : config.plural;
        if (caption.textContent !== nextCaption) caption.textContent = nextCaption;
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-selected"],
      characterData: true,
    });
    document.addEventListener("click", sync, true);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("click", sync, true);
    };
  }, []);

  return null;
}
