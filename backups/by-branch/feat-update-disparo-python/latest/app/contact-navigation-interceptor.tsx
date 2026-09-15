"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CONTACTS_ROUTE = "/contatos";
const QUICK_ACTION_ROUTES = new Set([
  "/importar-contatos",
  "/pendencias-localizacao",
  "/sistema-completo",
]);
const PREFETCH_DELAY_MS = 1500;

export default function ContactNavigationInterceptor() {
  const router = useRouter();

  useEffect(() => {
    let requestedControlObserver: MutationObserver | null = null;
    let requestedControlFrame = 0;

    const params = new URLSearchParams(window.location.search);
    const requestedMenu = params.get("menu") === "open";
    const requestedProfile = params.get("profile") === "open";
    const requestedView = params.get("view") || "";

    const clearRequestedControl = () => {
      if (!requestedMenu && !requestedProfile && !requestedView) return;
      params.delete("menu");
      params.delete("profile");
      params.delete("view");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    };

    const openRequestedControl = () => {
      if (!requestedMenu && !requestedProfile && !requestedView) return false;
      const shell = document.querySelector<HTMLElement>(".app-shell");
      if (!shell) return false;

      if (requestedView) {
        const viewButton = Array.from(
          shell.querySelectorAll<HTMLButtonElement>(".sidebar nav button"),
        ).find(
          (button) =>
            button.querySelector(".nav-name")?.textContent?.trim() === requestedView,
        );
        if (!viewButton) return false;
        viewButton.click();
      } else if (requestedMenu) {
        const menuButton = shell.querySelector<HTMLButtonElement>(".mobile-menu");
        if (!menuButton) return false;
        menuButton.click();
      } else if (requestedProfile) {
        const profileButton = shell.querySelector<HTMLButtonElement>(".profile");
        if (!profileButton) return false;
        profileButton.click();
      }

      clearRequestedControl();
      return true;
    };

    if (
      !openRequestedControl() &&
      (requestedMenu || requestedProfile || requestedView)
    ) {
      requestedControlObserver = new MutationObserver(() => {
        if (!openRequestedControl()) return;
        requestedControlObserver?.disconnect();
        requestedControlObserver = null;
      });
      requestedControlObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
      requestedControlFrame = window.requestAnimationFrame(openRequestedControl);
    }

    const prefetchTimer = window.setTimeout(() => {
      if (
        document.querySelector(".auth-page") ||
        document.documentElement.getAttribute("data-vf-performance") === "light"
      )
        return;

      router.prefetch(CONTACTS_ROUTE);
      for (const route of QUICK_ACTION_ROUTES) router.prefetch(route);
    }, PREFETCH_DELAY_MS);

    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      const quickActionRoute = link?.getAttribute("href") || "";

      // /contatos deixa de ser uma aplicação paralela. Links diretos entram
      // no dashboard oficial e selecionam a aba Contatos.
      if (
        link &&
        quickActionRoute === CONTACTS_ROUTE &&
        (!link.target || link.target === "_self")
      ) {
        event.preventDefault();
        event.stopPropagation();
        router.push("/sistema-completo?view=Contatos");
        return;
      }

      const interceptQuickAction =
        Boolean(link) &&
        QUICK_ACTION_ROUTES.has(quickActionRoute) &&
        (!link?.target || link.target === "_self");

      if (interceptQuickAction) {
        event.preventDefault();
        event.stopPropagation();
        router.push(quickActionRoute);
      }

      // Importante: não interceptar botões Contatos/Eleitores. O DashboardClient
      // já faz essa navegação localmente e preserva o shell/menu oficial.
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      window.clearTimeout(prefetchTimer);
      if (requestedControlFrame) window.cancelAnimationFrame(requestedControlFrame);
      requestedControlObserver?.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, [router]);

  return null;
}
