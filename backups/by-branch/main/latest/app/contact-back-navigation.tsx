"use client";

import { useEffect } from "react";
import contactStyles from "./contact-back-navigation.module.css";
import { apiFetch } from "./supabase-client";

const MOBILE_QUERY = "(max-width: 760px)";
const NETWORK_LABEL = "Todos da rede";
const THEME_STORAGE_KEY = "voto-forte-theme";
const PRIMARY_VIEWS = [
  ["Visão Geral", "⌂"],
  ["Contatos", "👥"],
  ["Mapa Eleitoral", "⌖"],
  ["Painel Eleitoral", "▦"],
  ["WhatsApp", "◉"],
] as const;

function optionSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}\u0000${option.text}`)
    .join("\u0001");
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "VF"
  );
}

type Theme = "dark" | "light";

export default function ContactBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let menuButton: HTMLButtonElement | null = null;
    let themeButton: HTMLButtonElement | null = null;
    let profileButton: HTMLButtonElement | null = null;
    let headerBar: HTMLDivElement | null = null;
    let navShell: HTMLDivElement | null = null;
    let hiddenSystemLink: HTMLElement | null = null;
    let hiddenRefreshButton: HTMLElement | null = null;
    let actions: HTMLElement | null = null;
    let scopeObserver: MutationObserver | null = null;
    let mobileScope: HTMLDivElement | null = null;
    let mobileSelect: HTMLSelectElement | null = null;

    const closeDrawer = () => {
      navShell?.classList.remove("collapsed", "is-open");
      navShell?.querySelector(".sidebar-backdrop")?.classList.remove("is-active");
      menuButton?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("vf-contact-drawer-open");
    };

    const openDrawer = () => {
      navShell?.classList.add("collapsed", "is-open");
      navShell?.querySelector(".sidebar-backdrop")?.classList.add("is-active");
      menuButton?.setAttribute("aria-expanded", "true");
      document.body.classList.add("vf-contact-drawer-open");
    };

    const navigate = (view: string) => {
      if (view === "Contatos") {
        closeDrawer();
        return;
      }
      window.location.assign(`/sistema-completo?view=${encodeURIComponent(view)}`);
    };

    const buildOfficialSidebar = async () => {
      if (!window.matchMedia(MOBILE_QUERY).matches || navShell?.isConnected) return;

      navShell = document.createElement("div");
      navShell.className = "vf-contact-official-nav app-shell";
      navShell.setAttribute("aria-label", "Navegação principal");

      const backdrop = document.createElement("div");
      backdrop.className = "sidebar-backdrop";
      backdrop.addEventListener("click", closeDrawer);

      const sidebar = document.createElement("aside");
      sidebar.className = "sidebar";

      const headerRow = document.createElement("div");
      headerRow.className = "sidebar-header-row";

      const brandButton = document.createElement("button");
      brandButton.type = "button";
      brandButton.className = "brand-button";
      brandButton.setAttribute("aria-label", "Ir para Visão Geral");
      brandButton.addEventListener("click", () => navigate("Visão Geral"));
      brandButton.innerHTML = `
        <div class="brand-lockup">
          <div class="brand-icons">
            <img class="parana-icon" src="/voto-forte-bandeira-icon.jpg" alt="Bandeira do Estado do Paraná - Voto Forte" />
          </div>
          <div><strong>VOTO FORTE</strong><div class="brand-state"><b>PARANÁ</b></div></div>
        </div>`;

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "sidebar-close-mobile-btn";
      closeButton.setAttribute("aria-label", "Fechar menu lateral");
      closeButton.textContent = "✕";
      closeButton.addEventListener("click", closeDrawer);
      headerRow.append(brandButton, closeButton);

      const menuLabel = document.createElement("div");
      menuLabel.className = "menu-label";
      menuLabel.textContent = "NAVEGAÇÃO";

      const nav = document.createElement("nav");
      const appendItem = (view: string, icon: string, active = false) => {
        const item = document.createElement("button");
        item.type = "button";
        if (active) item.className = "active";
        item.title = view;
        item.innerHTML = `<span class="nav-icon">${icon}</span><span class="nav-name">${view}</span>`;
        item.addEventListener("click", () => navigate(view));
        nav.appendChild(item);
      };

      PRIMARY_VIEWS.forEach(([view, icon]) => appendItem(view, icon, view === "Contatos"));

      try {
        const response = await apiFetch("/api/session", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const role = String(data?.user?.role || data?.user?.accessRole || "").toLowerCase();
        if (["master", "admin", "gestor", "adm"].includes(role)) {
          appendItem("Administração", "⚙");
        }
      } catch {
        // Mantém a navegação principal disponível mesmo se a consulta de perfil oscilar.
      }

      const sidebarMessage = document.createElement("div");
      sidebarMessage.className = "sidebar-message";
      sidebarMessage.innerHTML = `<span>🇧🇷</span><div><b>Compromisso com Arapongas</b><small>Estratégia, organização e resultado.</small></div>`;

      sidebar.append(headerRow, menuLabel, nav, sidebarMessage);
      navShell.append(backdrop, sidebar);
      document.body.appendChild(navShell);
    };

    const removeMobileScope = () => {
      mobileScope?.remove();
      mobileScope = null;
      mobileSelect = null;
      document.querySelector<HTMLElement>(".contacts-route-scope")?.classList.remove("vf-contact-mobile-scope-active");
    };

    const syncMobileScope = () => {
      if (cancelled) return;
      const route = document.querySelector<HTMLElement>(".contacts-route-scope");
      const sourceSelect = document.querySelector<HTMLSelectElement>(".contacts-route-scope .optimized-scope-control select");
      if (!route || !sourceSelect || !window.matchMedia(MOBILE_QUERY).matches || !headerBar) {
        removeMobileScope();
        return;
      }

      if (!mobileScope?.isConnected || !mobileSelect?.isConnected) {
        removeMobileScope();
        mobileScope = document.createElement("div");
        mobileScope.className = "vf-contact-mobile-scope";
        mobileScope.setAttribute("role", "group");
        mobileScope.setAttribute("aria-label", "Ambiente de contatos");

        mobileSelect = document.createElement("select");
        mobileSelect.className = "vf-contact-mobile-scope-select";
        mobileSelect.setAttribute("aria-label", "Selecionar usuário ou Todos da rede para visualizar os contatos");
        mobileSelect.addEventListener("change", () => {
          const liveSource = document.querySelector<HTMLSelectElement>(".contacts-route-scope .optimized-scope-control select");
          if (!liveSource || !mobileSelect) return;
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
          if (nativeSetter) nativeSetter.call(liveSource, mobileSelect.value);
          else liveSource.value = mobileSelect.value;
          liveSource.dispatchEvent(new Event("change", { bubbles: true }));
        });
        mobileScope.appendChild(mobileSelect);
        headerBar.insertBefore(mobileScope, themeButton ?? profileButton);
      }

      route.classList.add("vf-contact-mobile-scope-active");
      const signature = optionSignature(sourceSelect);
      if (mobileSelect.dataset.optionsSignature !== signature) {
        mobileSelect.replaceChildren(
          ...Array.from(sourceSelect.options).map((option) => {
            const clone = document.createElement("option");
            clone.value = option.value;
            clone.text = option.value === "all" ? NETWORK_LABEL : option.text;
            clone.disabled = option.disabled;
            return clone;
          }),
        );
        mobileSelect.dataset.optionsSignature = signature;
      }
      if (mobileSelect.value !== sourceSelect.value) mobileSelect.value = sourceSelect.value;
      mobileSelect.title = sourceSelect.value === "all" ? NETWORK_LABEL : sourceSelect.selectedOptions[0]?.text || "Selecionar ambiente";
    };

    const installScopeSync = () => {
      syncMobileScope();
      scopeObserver = new MutationObserver(syncMobileScope);
      scopeObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
      document.addEventListener("change", syncMobileScope, true);
      window.addEventListener("resize", syncMobileScope);
    };

    const syncThemeButton = () => {
      if (!themeButton) return;
      const theme = (document.documentElement.dataset.vfTheme as Theme) || "dark";
      themeButton.textContent = theme === "dark" ? "☀️" : "🌙";
      themeButton.title = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
      themeButton.setAttribute("aria-label", themeButton.title);
    };

    const installMobileTheme = () => {
      if (!headerBar || themeButton?.isConnected) return;
      themeButton = document.createElement("button");
      themeButton.type = "button";
      themeButton.className = "vf-contact-mobile-theme";
      themeButton.addEventListener("click", () => {
        const current = (document.documentElement.dataset.vfTheme as Theme) || "dark";
        const next: Theme = current === "dark" ? "light" : "dark";
        document.documentElement.dataset.vfTheme = next;
        document.documentElement.style.colorScheme = next;
        localStorage.setItem(THEME_STORAGE_KEY, next);
        syncThemeButton();
      });
      syncThemeButton();
      headerBar.appendChild(themeButton);
    };

    const installMobileProfile = () => {
      if (!headerBar || profileButton?.isConnected) return;
      profileButton = document.createElement("button");
      profileButton.type = "button";
      profileButton.className = "vf-contact-mobile-profile";
      profileButton.setAttribute("aria-label", "Abrir perfil");
      profileButton.setAttribute("title", "Abrir perfil");
      profileButton.textContent = "VF";
      profileButton.addEventListener("click", () => window.location.assign("/sistema-completo?profile=open"));
      headerBar.appendChild(profileButton);

      void apiFetch("/api/session", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (!profileButton?.isConnected) return;
          const name = String(data?.user?.name || data?.user?.fullName || data?.user?.email || "VF");
          profileButton.textContent = initials(name);
          const avatarUrl = String(data?.user?.avatarUrl || data?.user?.avatar_url || "");
          if (avatarUrl) {
            profileButton.style.backgroundImage = `url(${avatarUrl})`;
            profileButton.style.backgroundSize = "cover";
            profileButton.style.backgroundPosition = "center";
            profileButton.style.color = "transparent";
          }
        })
        .catch(() => undefined);
    };

    const install = () => {
      if (cancelled) return true;
      const shell = document.querySelector<HTMLElement>(".optimized-shell");
      actions = document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (!shell || !actions) return false;

      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      const systemLink = Array.from(actions.querySelectorAll<HTMLElement>("a")).find((item) => item.textContent?.includes("Sistema completo"));
      const refreshButton = Array.from(actions.querySelectorAll<HTMLElement>("button")).find((item) => item.textContent?.includes("Atualizar painel"));
      if (systemLink && isMobile) {
        hiddenSystemLink = systemLink;
        systemLink.style.display = "none";
      }
      if (refreshButton) {
        hiddenRefreshButton = refreshButton;
        refreshButton.style.display = "none";
      }
      actions.classList.add("vf-contact-actions");

      if (isMobile) {
        headerBar = document.createElement("div");
        headerBar.className = "vf-contact-mobile-header-bar";
        headerBar.setAttribute("role", "toolbar");
        headerBar.setAttribute("aria-label", "Navegação de Contatos");
        document.body.appendChild(headerBar);

        menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = contactStyles.backLink;
        menuButton.setAttribute("aria-label", "Abrir menu de navegação");
        menuButton.setAttribute("title", "Abrir menu");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.addEventListener("click", openDrawer);
        headerBar.appendChild(menuButton);

        installMobileTheme();
        installMobileProfile();
        void buildOfficialSidebar();
      }
      return true;
    };

    const restore = () => {
      closeDrawer();
      menuButton?.remove();
      themeButton?.remove();
      profileButton?.remove();
      headerBar?.remove();
      navShell?.remove();
      hiddenSystemLink?.style.removeProperty("display");
      hiddenRefreshButton?.style.removeProperty("display");
      actions?.classList.remove("vf-contact-actions");
      scopeObserver?.disconnect();
      document.removeEventListener("change", syncMobileScope, true);
      window.removeEventListener("resize", syncMobileScope);
      removeMobileScope();
    };

    if (install()) {
      installScopeSync();
      return () => {
        cancelled = true;
        restore();
      };
    }

    const observer = new MutationObserver(() => {
      if (!install()) return;
      observer.disconnect();
      installScopeSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      restore();
    };
  }, []);

  return null;
}
