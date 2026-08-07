"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type CurrentUser = {
  role?: string;
};

export default function TeamIntelligenceNavigation() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    void apiFetch("/api/session")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active || !response.ok) return;
        const user = data.user as CurrentUser | undefined;
        setAllowed(["master", "gestor", "lider"].includes(String(user?.role ?? "")));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;

    let observer: MutationObserver | null = null;

    const detect = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return false;

      let slot = nav.querySelector<HTMLElement>("[data-vf-team-intelligence-slot]");
      if (!slot) {
        slot = document.createElement("span");
        slot.dataset.vfTeamIntelligenceSlot = "true";
        slot.style.display = "contents";

        const usersButton = Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.querySelector(".nav-name")?.textContent?.trim() === "Usuários",
        );

        if (usersButton) usersButton.after(slot);
        else nav.append(slot);
      }

      setTarget(slot);
      observer?.disconnect();
      return true;
    };

    if (!detect()) {
      observer = new MutationObserver(() => {
        detect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      const slot = document.querySelector<HTMLElement>("[data-vf-team-intelligence-slot]");
      slot?.remove();
      setTarget(null);
    };
  }, [allowed]);

  if (!allowed || !target) return null;

  return createPortal(
    <button
      type="button"
      onClick={() => window.location.assign("/inteligencia-equipe")}
      title="Inteligência da Equipe"
      aria-label="Abrir Inteligência da Equipe"
    >
      <span className="nav-icon" aria-hidden="true">◈</span>
      <span className="nav-name">Inteligência da Equipe</span>
      <em>GESTÃO</em>
    </button>,
    target,
  );
}
