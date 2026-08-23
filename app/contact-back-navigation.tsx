"use client";

import { useEffect } from "react";
import sharedStyles from "./shared-back-navigation.module.css";
import contactStyles from "./contact-back-navigation.module.css";
import { supabase } from "./supabase-client";

const MOBILE_QUERY = "(max-width: 760px)";
const NETWORK_LABEL = "Todos da rede";

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
    let menuLink: HTMLAnchorElement | null = null;
    let profileButton: HTMLButtonElement | null = null;
    let hiddenSystemLink: HTMLElement | null = null;
    let hiddenRefreshButton: HTMLElement | null = null;
    let actions: HTMLElement | null = null;
    let scopeObserver: MutationObserver | null = null;
    let mobileScope: HTMLDivElement | null = null;
    let mobileSelect: HTMLSelectElement | null = null;

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
        menuLink = document.createElement("a");
        menuLink.href = "/sistema-completo?menu=open";
        menuLink.className = `${sharedStyles.backLink} ${contactStyles.backLink}`;
        menuLink.setAttribute("aria-label", "Abrir menu de navegação");
        menuLink.setAttribute("title", "Abrir menu");

        const arrow = document.createElement("span");
        arrow.className = `${sharedStyles.arrow} ${contactStyles.arrow}`;
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "←";

        const label = document.createElement("span");
        label.textContent = "Voltar";

        menuLink.append(arrow, label);
        shell.prepend(menuLink);
        installMobileProfile();
      }
      return true;
    };

    const restore = () => {
      menuLink?.remove();
      profileButton?.remove();
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
