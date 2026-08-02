"use client";

import { useEffect } from "react";

export default function MobileSidebarAutoClose() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!window.matchMedia("(max-width: 900px)").matches) return;

      const target = event.target as Element | null;
      const menuButton = target?.closest(".sidebar nav button, .brand-button");
      if (!menuButton) return;

      const appShell = document.querySelector(".app-shell");
      if (!appShell || appShell.classList.contains("collapsed")) return;

      const mobileMenuButton = document.querySelector<HTMLButtonElement>(
        ".mobile-menu",
      );
      mobileMenuButton?.click();
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
