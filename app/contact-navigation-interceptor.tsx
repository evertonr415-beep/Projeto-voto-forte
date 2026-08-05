"use client";

import { useEffect } from "react";

export default function ContactNavigationInterceptor() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;

      const label = button.querySelector(".nav-name")?.textContent?.trim();
      if (label !== "Contatos") return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/contatos");
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
