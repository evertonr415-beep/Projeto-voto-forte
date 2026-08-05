"use client";

import { useEffect } from "react";
import AuthClient from "./auth-client";

export default function FullSystemEntry() {
  useEffect(() => {
    function openOptimizedContacts(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("nav button");
      if (!button) return;

      const label = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!label.startsWith("Contatos")) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/contatos");
    }

    document.addEventListener("click", openOptimizedContacts, true);
    return () => document.removeEventListener("click", openOptimizedContacts, true);
  }, []);

  return <AuthClient />;
}
