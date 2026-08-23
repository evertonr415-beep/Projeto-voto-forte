"use client";

import { useEffect } from "react";
import contactStyles from "./contact-back-navigation.module.css";
import { supabase } from "./supabase-client";

const MOBILE_QUERY = "(max-width: 760px)";
const NETWORK_LABEL = "Todos da rede";
const PRIMARY_VIEWS = [
  "Visão Geral",
  "Contatos",
  "Mapa Eleitoral",
  "Painel Eleitoral",
  "WhatsApp",
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

export default function ContactBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let menuButton: HTMLButtonElement | null = null;
    let profileButton: HTMLButtonElement | null = null;
    let headerBar: HTMLDivElement | null = null;
    let drawer: HTMLElement | null = null;
    let drawerBackdrop: HTMLButtonElement | null = null;
    let hiddenSystemLink: HTMLElement | null = null;
    let hiddenRefreshButton: HTMLElement | null = null;
    let actions: HTMLElement | null = null;
    let scopeObserver: MutationObserver | null = null;
    let mobileScope: HTMLDivElement | null = null;
    let mobileSelect: HTMLSelectElement | null = null;

    const closeDrawer = () => {
      drawer?.classList.remove("is-open");
      drawerBackdrop?.classList.remove("is-open");
      drawer?.setAttribute("aria-hidden", "true");
      menuButton?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("vf-contact-drawer-open");
    };

    const openDrawer = () => {
      drawer?.classList.add("is-open");
      drawerBackdrop?.classList.add("is-open");
      drawer?.setAttribute("aria-hidden", "false");
      menuButton?.setAttribute("aria-expanded", "true");
      document.body.classList.add("vf-contact-drawer-open");
    };

    const removeMobileScope = () => {
      mobileScope?.remove();
      mobileScope = null;
      mobileSelect = null;
      document
        .querySelector<HTMLElement>(".contacts-route-scope")
        ?.classList.remove("vf-contact-mobile-scope-active");
    };

    const syncMobileScope = () => {
      if (cancelled) return;

      const route = document.querySelector<HTMLElement>(".contacts-route-scope");
      const sourceSelect = document.querySelector<HTMLSelectElement>(
        ".contacts-route-scope .optimized-scope-control select",
      );
      const isMobile = window.matchMedia(MOBILE_QUERY).matches;

      if (!route || !sourceSelect || !isMobile) {
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
        mobileSelect.setAttribute(
          "aria-label",
          "Selecionar usuário ou Todos da rede para visualizar os contatos",
        );
        mobileSelect.addEventListener("change", () => {
          const liveSource = document.querySelector<HTMLSelectElement>(
            ".contacts-route-scope .optimized-scope-control select",
          );
          if (!liveSource || !mobileSelect) return;

          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) nativeSetter.call(liveSource, mobileSelect.value);
          else liveSource.value = mobileSelect.value;

          liveSource.dispatchEvent(new Event("change", { bubbles: true }));
        });

        mobileScope.appendChild(mobileSelect);
        document.body.appendChild(mobileScope);
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

      if (mobileSelect.value !== sourceSelect.value) {
        mobileSelect.value = sourceSelect.value;
      }
      mobileSelect.title =
        sourceSelect.value === "all"
          ? NETWORK_LABEL
          : sourceSelect.selectedOptions[0]?.text || "Selecionar ambiente";
    };

    const installScopeSync = () => {
      syncMobileScope();
      scopeObserver = new MutationObserver(syncMobileScope);
      scopeObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      document.addEventListener("change", syncMobileScope, true);
      window.addEventListener("resize", syncMobileScope);
    };

    const installMobileProfile = () => {
      if (!window.matchMedia(MOBILE_QUERY).matches || profileButton?.isConnected) return;
      profileButton = document.createElement("button");
      profileButton.type = "button";
      profileButton.className = "vf-contact-mobile-profile";
      profileButton.setAttribute("aria-label", "Abrir perfil");
      profileButton.setAttribute("title", "Abrir perfil");
      profileButton.textContent = "VF";
      profileButton.addEventListener("click", () => {
        window.location.assign("/sistema-completo?profile=open");
      });
      document.body.appendChild(profileButton);

      void supabase.auth.getUser().then(({ data }) => {
        if (!profileButton?.isConnected || !data.user) return;
        const name = String(
          data.user.user_metadata?.name ||
            data.user.user_metadata?.full_name ||
            data.user.email ||
            "VF",
        );
        const avatarUrl = String(data.user.user_metadata?.avatar_url || "");
        profileButton.textContent = initials(name);
        if (avatarUrl) {
          profileButton.style.backgroundImage = `url(${avatarUrl})`;
          profileButton.style.backgroundSize = "cover";
          profileButton.style.backgroundPosition = "center";
          profileButton.style.color = "transparent";
        }
      });
    };

    const installMobileDrawer = () => {
      if (!window.matchMedia(MOBILE_QUERY).matches || drawer?.isConnected) return;

      drawerBackdrop = document.createElement("button");
      drawerBackdrop.type = "button";
      drawerBackdrop.className = "vf-contact-nav-backdrop";
      drawerBackdrop.setAttribute("aria-label", "Fechar menu");
      drawerBackdrop.addEventListener("click", closeDrawer);

      drawer = document.createElement("aside");
      drawer.className = "vf-contact-nav-drawer";
      drawer.setAttribute("aria-label", "Navegação principal");
      drawer.setAttribute("aria-hidden", "true");

      const drawerHeader = document.createElement("div");
      drawerHeader.className = "vf-contact-nav-header";

      const brand = document.createElement("div");
      brand.className = "vf-contact-nav-brand";
      const brandImage = document.createElement("img");
      brandImage.src = "/voto-forte-bandeira-icon.jpg";
      brandImage.alt = "";
      const brandText = document.createElement("div");
      const brandStrong = document.createElement("strong");
      brandStrong.textContent = "VOTO FORTE";
      const brandSmall = document.createElement("small");
      brandSmall.textContent = "PARANÁ";
      brandText.append(brandStrong, brandSmall);
      brand.append(brandImage, brandText);

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "vf-contact-nav-close";
      closeButton.setAttribute("aria-label", "Fechar menu");
      closeButton.textContent = "×";
      closeButton.addEventListener("click", closeDrawer);

      drawerHeader.append(brand, closeButton);

      const label = document.createElement("div");
      label.className = "vf-contact-nav-label";
      label.textContent = "NAVEGAÇÃO";

      const nav = document.createElement("nav");
      PRIMARY_VIEWS.forEach((view) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = view === "Contatos" ? "is-active" : "";
        item.textContent = view;
        item.addEventListener("click", () => {
          if (view === "Contatos") {
            closeDrawer();
            return;
          }
          window.location.assign(
            `/sistema-completo?view=${encodeURIComponent(view)}`,
          );
        });
        nav.appendChild(item);
      });

      drawer.append(drawerHeader, label, nav);
      document.body.append(drawerBackdrop, drawer);
    };

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".optimized-shell");
      actions = document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (!shell || !actions) return false;

      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      const systemLink = Array.from(actions.querySelectorAll<HTMLElement>("a")).find(
        (item) => item.textContent?.includes("Sistema completo"),
      );
      const refreshButton = Array.from(actions.querySelectorAll<HTMLElement>("button")).find(
        (item) => item.textContent?.includes("Atualizar painel"),
      );

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
        headerBar.setAttribute("aria-hidden", "true");
        document.body.appendChild(headerBar);

        menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = contactStyles.backLink;
        menuButton.setAttribute("aria-label", "Abrir menu de navegação");
        menuButton.setAttribute("title", "Abrir menu");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.textContent = "☰";
        menuButton.addEventListener("click", openDrawer);
        document.body.appendChild(menuButton);

        installMobileDrawer();
        installMobileProfile();
      }
      return true;
    };

    const restore = () => {
      closeDrawer();
      menuButton?.remove();
      profileButton?.remove();
      headerBar?.remove();
      drawer?.remove();
      drawerBackdrop?.remove();
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
