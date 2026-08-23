"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CONTACTS_ROUTE = "/contatos";
const QUICK_ACTION_ROUTES = new Set([
  CONTACTS_ROUTE,
  "/importar-contatos",
  "/pendencias-localizacao",
  "/sistema-completo",
]);
const PREFETCH_DELAY_MS = 1500;

export default function ContactNavigationInterceptor() {
  const router = useRouter();

  useEffect(() => {
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
      const interceptQuickAction =
        Boolean(link) &&
        QUICK_ACTION_ROUTES.has(quickActionRoute) &&
        (!link?.target || link.target === "_self");

      if (interceptQuickAction) {
        event.preventDefault();
        event.stopPropagation();
        router.push(quickActionRoute);
        return;
      }

      const button = target?.closest("button");
      if (!button) return;

      const navLabel = button.querySelector(".nav-name")?.textContent?.trim();
      const kpiLabel = button.querySelector(".kpi b")?.textContent?.trim();
      const buttonText = button.textContent?.trim() || "";

      const opensContacts = navLabel === "Contatos" || navLabel === "Gestão";
      const opensVoters =
        kpiLabel === "Eleitores cadastrados" ||
        buttonText.includes("Ver relatório de eleitores");

      if (!opensContacts && !opensVoters) return;

      event.preventDefault();
      event.stopPropagation();
      router.push(CONTACTS_ROUTE);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      window.clearTimeout(prefetchTimer);
      document.removeEventListener("click", handleClick, true);
    };
  }, [router]);

  return null;
}
