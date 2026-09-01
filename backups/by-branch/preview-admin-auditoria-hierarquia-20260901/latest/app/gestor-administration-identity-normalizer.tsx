"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "./supabase-client";

export default function GestorAdministrationIdentityNormalizer() {
  const isGestorRef = useRef<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loading = false;

    const normalize = () => {
      if (isGestorRef.current !== true) return;
      const panel = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      if (!panel) return;

      panel.dataset.vfGestorUnifiedView = "true";

      panel.querySelectorAll<HTMLElement>(".vf-masked-admins").forEach((node) => node.remove());

      const hierarchyText = panel.querySelector<HTMLElement>(":scope > header p");
      if (hierarchyText) hierarchyText.textContent = "Gestor → Master → Liderança → Liderado → Eleitor.";

      const help = panel.querySelector<HTMLElement>(".vf-hierarchy-help");
      if (help) {
        help.innerHTML = "<b>Hierarquia protegida:</b> cada usuário visualiza somente o escopo permitido pelo seu nível.";
      }

      panel.querySelectorAll<HTMLElement>(".vf-hierarchy-summary article").forEach((card) => {
        const label = card.querySelector("small")?.textContent?.trim().toUpperCase();
        if (label === "ADM") card.style.display = "none";
      });
    };

    const resolveRole = async () => {
      if (loading || isGestorRef.current !== null) return;
      if (!document.querySelector(".vf-hierarchy-panel")) return;
      loading = true;
      try {
        const response = await apiFetch("/api/administration/activity?limit=30", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) return;
        isGestorRef.current = data.currentUserRole === "gestor";
        normalize();
      } catch {
        // Mantém a Administração original caso não seja possível confirmar o perfil.
      } finally {
        loading = false;
      }
    };

    const sync = () => {
      if (cancelled) return;
      void resolveRole();
      normalize();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", sync, true);

    return () => {
      cancelled = true;
      observer.disconnect();
      document.removeEventListener("click", sync, true);
    };
  }, []);

  return null;
}
