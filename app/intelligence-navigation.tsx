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

const TEAM_ROUTE = "/inteligencia-equipe";
const SYSTEM_ROUTE = "/inteligencia-sistema";
const TEAM_ROLES = new Set(["master", "gestor", "lider"]);
const SLOT_SELECTOR = '[data-vf-intelligence-section="main"]';

function isPathWithin(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
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
    isPathWithin(pathname, TEAM_ROUTE) ||
    isPathWithin(pathname, SYSTEM_ROUTE);

  const [role, setRole] = useState("");
  const [accessRole, setAccessRole] = useState("");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<NavigationMode | null>(null);

  const canOpenTeam = TEAM_ROLES.has(role) || accessRole === "adm";
  const canOpenSystem = role === "master" && accessRole !== "gestor";

  useEffect(() => {
    if (suppressNavigation) {
      setRole("");
      setAccessRole("");
      return;
    }

    let active = true;

    void apiFetch("/api/session")
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active || !response.ok) return;
        const user = data.user as CurrentUser | undefined;
        setRole(String(user?.role ?? ""));
        setAccessRole(String(user?.accessRole ?? ""));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [suppressNavigation]);

  useEffect(() => {
    if (suppressNavigation || (!canOpenTeam && !canOpenSystem)) {
      setTarget(null);
      setMode(null);
      return;
    }

    if (canOpenTeam) router.prefetch(TEAM_ROUTE);
    if (canOpenSystem) router.prefetch(SYSTEM_ROUTE);

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
  }, [canOpenSystem, canOpenTeam, router, suppressNavigation]);

  if (
    suppressNavigation ||
    !target ||
    !mode ||
    (!canOpenTeam && !canOpenSystem)
  )
    return null;

  if (mode === "optimized") {
    return createPortal(
      <>
        {canOpenTeam ? (
          <a href={TEAM_ROUTE}>
            <span className="optimized-action-icon" aria-hidden="true">◈</span>
            <span>
              <b>Inteligência da Equipe</b>
              <small>Gestão, sinais e oportunidades</small>
            </span>
          </a>
        ) : null}
        {canOpenSystem ? (
          <a href={SYSTEM_ROUTE}>
            <span className="optimized-action-icon" aria-hidden="true">✦</span>
            <span>
              <b>VOTO FORTE Neural</b>
              <small>Saúde, riscos e otimizações</small>
            </span>
          </a>
        ) : null}
      </>,
      target,
    );
  }

  return createPortal(
    <div role="group" aria-label="Inteligência">
      <div className="menu-label vf-intelligence-nav-label">INTELIGÊNCIA</div>
      {canOpenTeam ? (
        <button
          type="button"
          onClick={() => router.push(TEAM_ROUTE)}
          title="Inteligência da Equipe"
          aria-label="Abrir Inteligência da Equipe"
        >
          <span className="nav-icon" aria-hidden="true">◈</span>
          <span className="nav-name">Inteligência da Equipe</span>
          <em>GESTÃO</em>
        </button>
      ) : null}
      {canOpenSystem ? (
        <button
          type="button"
          onClick={() => router.push(SYSTEM_ROUTE)}
          title="VOTO FORTE Neural"
          aria-label="Abrir VOTO FORTE Neural"
        >
          <span className="nav-icon" aria-hidden="true">✦</span>
          <span className="nav-name">VOTO FORTE Neural</span>
          <em>MASTER</em>
        </button>
      ) : null}
    </div>,
    target,
  );
}
