"use client";

import { useEffect } from "react";

export default function ContactNavigationInterceptor() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;

      const navLabel = button.querySelector(".nav-name")?.textContent?.trim();
      const kpiLabel = button.querySelector(".kpi b")?.textContent?.trim();
      const buttonText = button.textContent?.trim() || "";

      const opensContacts = navLabel === "Contatos" || navLabel === "Gestão";
      const opensVoters =
        kpiLabel === "Eleitores cadastrados" ||
        buttonText.includes("Ver relatório de eleitores");

      if (!opensContacts && !opensVoters) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/contatos");
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
