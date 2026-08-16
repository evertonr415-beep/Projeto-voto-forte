"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type NavigationMode = "optimized" | "legacy";

function ensureLegacySlot(nav: HTMLElement) {
  const selector = '[data-vf-intelligence-slot="system"]';
  const existing = nav.querySelector<HTMLElement>(selector);
  if (existing) return existing;

  const slot = document.createElement("span");
  slot.setAttribute("data-vf-intelligence-slot", "system");
  slot.style.display = "contents";

  const administration = nav.querySelector<HTMLElement>(
    ".administration-nav-item",
  );

  if (administration) nav.insertBefore(slot, administration);
  else nav.appendChild(slot);

  return slot;
}

export default function SystemIntelligenceNavigation() {
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
        setAllowed(String(data.user?.role ?? "") === "master");
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
      pathname.startsWith("/inteligencia-sistema")
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
      observer = new MutationObserver(detect);
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
      <a href="/inteligencia-sistema">
        <span className="optimized-action-icon" aria-hidden="true">
          ✦
        </span>
        <span>
          <b>VOTO FORTE Neural</b>
          <small>Saúde, riscos e otimizações</small>
        </span>
      </a>,
      target,
    );
  }

  return createPortal(
    <button
      type="button"
      onClick={() => window.location.assign("/inteligencia-sistema")}
      title="VOTO FORTE Neural"
      aria-label="Abrir Inteligência do Sistema"
    >
      <span className="nav-icon" aria-hidden="true">
        ✦
      </span>
      <span className="nav-name">Inteligência do Sistema</span>
      <em>MASTER</em>
    </button>,
    target,
  );
}
