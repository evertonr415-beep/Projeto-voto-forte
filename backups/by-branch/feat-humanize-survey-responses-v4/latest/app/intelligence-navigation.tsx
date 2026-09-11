"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type CurrentUser = {
  role?: string;
  accessRole?: string;
};

type NavigationMode = "optimized" | "legacy";

const LEGACY_TEAM_ROUTE = "/inteligencia-equipe";
const SYSTEM_ROUTE = "/inteligencia-sistema";
const SLOT_SELECTOR = '[data-vf-intelligence-section="main"]';

function isPathWithin(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function hasNavigationHost(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

function ensureIntelligenceSlot(nav: HTMLElement) {
  const existing = nav.querySelector<HTMLElement>(SLOT_SELECTOR);
  if (existing) return existing;

  const slot = document.createElement("div");
  slot.setAttribute("data-vf-intelligence-section", "main");
  slot.className = "vf-intelligence-nav-section";

  const administration = nav.querySelector<HTMLElement>(
    ".administration-nav-item",
  );

  if (administration) nav.insertBefore(slot, administration);
  else nav.appendChild(slot);

  return slot;
}

export default function IntelligenceNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const suppressNavigation =
    !hasNavigationHost(pathname) ||
    isPathWithin(pathname, LEGACY_TEAM_ROUTE) ||
    isPathWithin(pathname, SYSTEM_ROUTE);

  const [role, setRole] = useState("");
  const [accessRole, setAccessRole] = useState("");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<NavigationMode | null>(null);

  const canOpenSystem = role === "master" && accessRole !== "gestor";

  useEffect(() => {
    if (suppressNavigation) {
      setRole("");
      setAccessRole("");
      return;
    }

    let active = true;
    let requested = false;
    let authObserver: MutationObserver | null = null;

    const loadSession = () => {
      if (!active || requested) return;
      requested = true;
      authObserver?.disconnect();
      authObserver = null;

      void apiFetch("/api/session")
        .then(async (response) => ({ response, data: await response.json() }))
        .then(({ response, data }) => {
          if (!active || !response.ok) return;
          const user = data.user as CurrentUser | undefined;
          setRole(String(user?.role ?? ""));
          setAccessRole(String(user?.accessRole ?? ""));
        })
        .catch(() => undefined);
    };

    if (!document.querySelector(".auth-page")) {
      loadSession();
    } else {
      authObserver = new MutationObserver(() => {
        if (!document.querySelector(".auth-page")) {
          authObserver?.disconnect();
          authObserver = null;
          loadSession();
        }
      });
      authObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      active = false;
      authObserver?.disconnect();
    };
  }, [suppressNavigation]);

  useEffect(() => {
    if (suppressNavigation || !canOpenSystem) {
      setTarget(null);
      setMode(null);
      return;
    }

    let observer: MutationObserver | null = null;
    let ownedSlot: HTMLElement | null = null;

    const detect = () => {
      const optimizedNav =
        document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (optimizedNav) {
        setTarget(optimizedNav);
        setMode("optimized");
        observer?.disconnect();
        return true;
      }

      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return false;

      ownedSlot = ensureIntelligenceSlot(nav);
      setTarget(ownedSlot);
      setMode("legacy");
      observer?.disconnect();
      return true;
    };

    if (!detect()) {
      observer = new MutationObserver(detect);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      setTarget(null);
      setMode(null);
      if (ownedSlot?.isConnected) ownedSlot.remove();
    };
  }, [canOpenSystem, suppressNavigation]);

  if (suppressNavigation || !target || !mode || !canOpenSystem) return null;

  if (mode === "optimized") {
    return createPortal(
      <a href={SYSTEM_ROUTE}>
        <span className="optimized-action-icon" aria-hidden="true">✦</span>
        <span>
          <b>VOTO FORTE Neural</b>
          <small>Saúde, riscos e otimizações</small>
        </span>
      </a>,
      target,
    );
  }

  return createPortal(
    <div role="group" aria-label="Inteligência">
      <div className="menu-label vf-intelligence-nav-label">INTELIGÊNCIA</div>
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));
          router.push(SYSTEM_ROUTE);
        }}
        title="VOTO FORTE Neural"
        aria-label="Abrir VOTO FORTE Neural"
      >
        <span className="nav-icon" aria-hidden="true">✦</span>
        <span className="nav-name">VOTO FORTE Neural</span>
        <em>MASTER</em>
      </button>
    </div>,
    target,
  );
}
