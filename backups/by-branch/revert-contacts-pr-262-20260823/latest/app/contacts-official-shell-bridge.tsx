"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NeutralDashboardClient from "./neutral-dashboard-client";
import ContactDistrictRanking from "./contact-district-ranking";
import ContactWhatsappQuickQueue from "./contact-whatsapp-quick-queue";
import MobileContactListEntryCollapse from "./contatos/mobile-contact-list-entry-collapse";
import MobileContactRowAccordion from "./contatos/mobile-contact-row-accordion";
import { apiFetch } from "./supabase-client";
import "./contatos/coverage-clarity.css";
import "./contatos/contact-quality-label.css";
import "./contatos/whatsapp-quick-queue.css";
import "./contatos/contacts-ux.css";
import "./contatos/hide-meetings-kpi.css";
import "./contatos/contacts-full-theme.css";
import "./contatos/contacts-mobile-polish.css";
import "./contatos/mobile-contact-row-accordion.css";
import "./contacts-official-shell-bridge.css";
import "./contacts-stability.css";

type SessionAccount = {
  email: string;
  name: string;
  role: string;
};

const ENTERING_CLASS = "vf-contacts-entering";
const ACTIVE_CLASS = "vf-contacts-active";
const OPTIMIZED_ACTIVE_CLASS = "vf-contacts-optimized-active";

function setReactSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function getNavigationButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  return element?.closest<HTMLButtonElement>(".sidebar nav button") ?? null;
}

function isContactsNavigationTarget(target: EventTarget | null) {
  const button = getNavigationButton(target);
  return button?.querySelector(".nav-name")?.textContent?.trim() === "Contatos";
}

function setEnteringState(entering: boolean) {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  const workspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
  shell?.classList.toggle(ENTERING_CLASS, entering);
  workspace?.classList.toggle(ENTERING_CLASS, entering);
}

function setImmediateContactsVisualState(active: boolean) {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  const workspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
  shell?.classList.toggle(ACTIVE_CLASS, active);
  workspace?.classList.toggle(OPTIMIZED_ACTIVE_CLASS, active);
}

export default function ContactsOfficialShellBridge() {
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const initialFiltersSeeded = useRef(false);
  const accountRequest = useRef<Promise<SessionAccount | null> | null>(null);

  const ensureAccount = () => {
    if (account) return Promise.resolve(account);
    if (accountRequest.current) return accountRequest.current;

    accountRequest.current = apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.user) return null;
        return {
          email: String(data.user.email || ""),
          name: String(data.user.name || data.user.email || "Voto Forte"),
          role: String(data.user.role || "user"),
        } satisfies SessionAccount;
      })
      .catch(() => null);

    return accountRequest.current;
  };

  useEffect(() => {
    let cancelled = false;

    void ensureAccount().then((nextAccount) => {
      if (!cancelled && nextAccount) setAccount((current) => current ?? nextAccount);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      const shell = document.querySelector<HTMLElement>(".app-shell");
      const nextWorkspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
      const title = shell?.querySelector<HTMLElement>(".topbar h1")?.textContent?.trim();
      const nextActive = Boolean(nextWorkspace && title === "Contatos");

      setWorkspace((current) => (current === nextWorkspace ? current : nextWorkspace));
      setActive((current) => (current === nextActive ? current : nextActive));
      shell?.classList.toggle(ACTIVE_CLASS, nextActive);
      nextWorkspace?.classList.toggle(OPTIMIZED_ACTIVE_CLASS, nextActive);

      if (!nextActive) initialFiltersSeeded.current = false;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      document.querySelector<HTMLElement>(".app-shell")?.classList.remove(ACTIVE_CLASS);
      document
        .querySelector<HTMLElement>(".workspace")
        ?.classList.remove(OPTIMIZED_ACTIVE_CLASS);
    };
  }, []);

  useEffect(() => {
    const prepareNavigation = (event: Event) => {
      const button = getNavigationButton(event.target);
      if (!button) return;

      if (isContactsNavigationTarget(event.target)) {
        setEnteringState(true);
        setImmediateContactsVisualState(true);
        setActive(true);
        void ensureAccount().then((nextAccount) => {
          if (nextAccount) setAccount((current) => current ?? nextAccount);
        });
        return;
      }

      setActive(false);
      setImmediateContactsVisualState(false);
      setEnteringState(false);
    };

    document.addEventListener("pointerdown", prepareNavigation, true);
    document.addEventListener("click", prepareNavigation, true);
    return () => {
      document.removeEventListener("pointerdown", prepareNavigation, true);
      document.removeEventListener("click", prepareNavigation, true);
      setEnteringState(false);
      setImmediateContactsVisualState(false);
    };
  }, [account]);

  useEffect(() => {
    if (!active || account) return;
    let cancelled = false;

    void ensureAccount().then((nextAccount) => {
      if (!cancelled && nextAccount) setAccount(nextAccount);
    });

    return () => {
      cancelled = true;
    };
  }, [account, active]);

  useEffect(() => {
    if (!workspace) return;
    workspace.classList.toggle(OPTIMIZED_ACTIVE_CLASS, active);
    return () => workspace.classList.remove(OPTIMIZED_ACTIVE_CLASS);
  }, [active, workspace]);

  useEffect(() => {
    if (!active || !account) return;

    const frame = window.requestAnimationFrame(() => setEnteringState(false));
    return () => window.cancelAnimationFrame(frame);
  }, [account, active]);

  useEffect(() => {
    if (!active || !workspace || !account) return;

    let frame = 0;
    const syncScopeAndInitialFilters = () => {
      const portal = workspace.querySelector<HTMLElement>(
        ".vf-contacts-optimized-portal",
      );
      if (!portal) return;

      const sourceSelect = document.querySelector<HTMLSelectElement>(
        ".app-shell .topbar .scope-picker select",
      );
      const visibleSelect = document.querySelector<HTMLSelectElement>(
        ".app-shell .topbar .vf-header-scope-select",
      );
      const desiredScope = sourceSelect?.value || visibleSelect?.value || "";
      const embeddedScope = portal.querySelector<HTMLSelectElement>(
        ".optimized-scope-control select",
      );

      if (
        desiredScope &&
        embeddedScope &&
        embeddedScope.value !== desiredScope &&
        Array.from(embeddedScope.options).some(
          (option) => option.value === desiredScope,
        )
      ) {
        setReactSelectValue(embeddedScope, desiredScope);
      }

      if (initialFiltersSeeded.current) return;

      const legacyActiveFilter = Array.from(
        workspace.querySelectorAll<HTMLButtonElement>(
          ".management-filter button.active",
        ),
      ).find((button) => !button.closest(".vf-contacts-optimized-portal"));
      const profileSelect = portal.querySelector<HTMLSelectElement>(
        ".optimized-filters select",
      );
      const filterLabel = legacyActiveFilter?.textContent?.trim() || "";
      const profile = filterLabel.includes("Eleitor")
        ? "Eleitor"
        : filterLabel.includes("Lideran")
          ? "Liderança"
          : "";

      if (
        profileSelect &&
        profileSelect.value !== profile &&
        Array.from(profileSelect.options).some((option) => option.value === profile)
      ) {
        setReactSelectValue(profileSelect, profile);
      }

      const legacyDistrict = Array.from(
        workspace.querySelectorAll<HTMLElement>(".district-contact-filter b"),
      ).find((element) => !element.closest(".vf-contacts-optimized-portal"))
        ?.textContent?.trim();

      if (legacyDistrict) {
        window.dispatchEvent(
          new CustomEvent("voto-forte:filter-district-contacts", {
            detail: { district: legacyDistrict },
          }),
        );
      }

      if (profileSelect || legacyDistrict || legacyActiveFilter) {
        initialFiltersSeeded.current = true;
      }
    };

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncScopeAndInitialFilters);
    };

    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    const shell = document.querySelector<HTMLElement>(".app-shell");
    observer.observe(shell || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "class"],
    });
    document.addEventListener("change", scheduleSync, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("change", scheduleSync, true);
    };
  }, [account, active, workspace]);

  const neutralAccount = useMemo(() => {
    if (!account) return null;
    return {
      ...account,
      role: account.role === "admin" ? "master" : account.role,
    };
  }, [account]);

  if (!workspace) return null;

  return createPortal(
    <div
      className="vf-contacts-optimized-portal contacts-route-scope"
      style={{ display: active ? undefined : "none" }}
      aria-hidden={!active}
    >
      {neutralAccount ? (
        <>
          <NeutralDashboardClient currentUser={neutralAccount} />
          <MobileContactListEntryCollapse />
          <MobileContactRowAccordion />
          <ContactDistrictRanking />
          <ContactWhatsappQuickQueue />
        </>
      ) : (
        <div className="vf-contacts-stable-loading" role="status" aria-live="polite">
          <span className="vf-contacts-stable-spinner" aria-hidden="true" />
          <b>Carregando contatos…</b>
        </div>
      )}
    </div>,
    workspace,
  );
}
