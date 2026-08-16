"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type CurrentUser = {
  role?: string;
};

type NavigationMode = "optimized" | "legacy";

function ensureLegacySlot(nav: HTMLElement) {
  const selector = '[data-vf-intelligence-slot="team"]';
  const existing = nav.querySelector<HTMLElement>(selector);
  if (existing) return existing;

  const slot = document.createElement("span");
  slot.setAttribute("data-vf-intelligence-slot", "team");
  slot.style.display = "contents";

  const systemSlot = nav.querySelector<HTMLElement>(
    '[data-vf-intelligence-slot="system"]',
  );
  const administration = nav.querySelector<HTMLElement>(
    ".administration-nav-item",
  );

  if (systemSlot) nav.insertBefore(slot, systemSlot);
  else if (administration) nav.insertBefore(slot, administration);
  else nav.appendChild(slot);

  return slot;
}

export default function TeamIntelligenceNavigation() {
  const pathname = usePathname();
  const hideFromContacts = pathname.startsWith("/contatos");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<NavigationMode | null>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (hideFromContacts) {
      setAllowed(false);
      return;
    }

    let active = true;

    void apiFetch("/api/session")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active || !response.ok) return;
        const user = data.user as CurrentUser | undefined;
        setAllowed(
          ["master", "gestor", "lider"].includes(String(user?.role ?? "")),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [hideFromContacts]);

  useEffect(() => {
    if (
      hideFromContacts ||
      !allowed ||
      pathname.startsWith("/inteligencia-equipe")
    )
      return;

    let observer: MutationObserver | null = null;

    const detect = () => {
      const optimizedNav =
        document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (optimizedNav) {
        setTarget(optimizedNav);
        setMode("optimized");
        observer?.disconnect();
        return true;
      }

      const legacyNav = document.querySelector<HTMLElement>(".sidebar nav");
      if (legacyNav) {
        setTarget(ensureLegacySlot(legacyNav));
        setMode("legacy");
        observer?.disconnect();
        return true;
      }

      return false;
    };

    if (!detect()) {
      observer = new MutationObserver(() => {
        detect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      setTarget(null);
      setMode(null);
    };
  }, [allowed, hideFromContacts, pathname]);

  if (hideFromContacts || !allowed || !target || !mode) return null;

  if (mode === "optimized") {
    return createPortal(
      <a href="/inteligencia-equipe">
        <span className="optimized-action-icon" aria-hidden="true">
          ◈
        </span>
        <span>
          <b>Inteligência da Equipe</b>
          <small>Atividade, ações e pendências</small>
        </span>
      </a>,
      target,
    );
  }

  return createPortal(
    <button
      type="button"
      onClick={() => window.location.assign("/inteligencia-equipe")}
      title="Inteligência da Equipe"
      aria-label="Abrir Inteligência da Equipe"
    >
      <span className="nav-icon" aria-hidden="true">
        ◈
      </span>
      <span className="nav-name">Inteligência da Equipe</span>
      <em>GESTÃO</em>
    </button>,
    target,
  );
}
