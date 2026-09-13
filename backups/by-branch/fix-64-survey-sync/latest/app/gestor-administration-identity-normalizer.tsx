"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "./supabase-client";

export default function GestorAdministrationIdentityNormalizer() {
  const isGestorRef = useRef<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loading = false;

    const normalize = () => {
      if (cancelled || isGestorRef.current !== true) return;
      const panel = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      if (!panel) return;

      if (panel.dataset.vfGestorUnifiedView !== "true") {
        panel.dataset.vfGestorUnifiedView = "true";
      }

      const hierarchyText = panel.querySelector<HTMLElement>(":scope > header p");
      const hierarchyLabel = "Gestor → Master → Liderança → Liderado → Eleitor.";
      if (hierarchyText && hierarchyText.textContent !== hierarchyLabel) {
        hierarchyText.textContent = hierarchyLabel;
      }

      const help = panel.querySelector<HTMLElement>(".vf-hierarchy-help");
      const helpLabel = "Hierarquia protegida: cada usuário visualiza somente o escopo permitido pelo seu nível.";
      if (help && help.textContent?.replace(/\s+/g, " ").trim() !== helpLabel) {
        help.textContent = helpLabel;
      }

      panel.querySelectorAll<HTMLElement>(".vf-hierarchy-summary article").forEach((card) => {
        const label = card.querySelector("small")?.textContent?.trim().toUpperCase();
        if (label === "ADM" && card.style.display !== "none") {
          card.style.display = "none";
        }
      });

      panel.querySelectorAll<HTMLElement>(".vf-masked-admins").forEach((node) => {
        if (node.style.display !== "none") node.style.display = "none";
      });
    };

    const resolveRole = async () => {
      if (cancelled || loading || isGestorRef.current !== null) return;
      if (!document.querySelector(".vf-hierarchy-panel")) return;

      loading = true;
      try {
        const response = await apiFetch("/api/administration/activity?limit=30", {
          cache: "no-store",
        });
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
    const timer = window.setInterval(sync, 1000);
    document.addEventListener("click", sync, true);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("click", sync, true);
    };
  }, []);

  return null;
}
