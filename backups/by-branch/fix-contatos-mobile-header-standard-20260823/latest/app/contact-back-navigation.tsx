"use client";

import { useEffect } from "react";
import styles from "./shared-back-navigation.module.css";
import "./contact-back-navigation.module.css";

const MOBILE_QUERY = "(max-width: 760px)";
const NETWORK_LABEL = "Todos da rede";

function optionSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}\u0000${option.text}`)
    .join("\u0001");
}

export default function ContactBackNavigation() {
  useEffect(() => {
    let cancelled = false;
    let backLink: HTMLAnchorElement | null = null;
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

    const install = () => {
      if (cancelled) return true;

      const shell = document.querySelector<HTMLElement>(".optimized-shell");
      actions = document.querySelector<HTMLElement>(".optimized-quick-actions");
      if (!shell || !actions) return false;

      const systemLink = Array.from(actions.querySelectorAll<HTMLElement>("a")).find(
        (item) => item.textContent?.includes("Sistema completo"),
      );
      const refreshButton = Array.from(actions.querySelectorAll<HTMLElement>("button")).find(
        (item) => item.textContent?.includes("Atualizar painel"),
      );

      if (systemLink) {
        hiddenSystemLink = systemLink;
        systemLink.style.display = "none";
      }

      if (refreshButton) {
        hiddenRefreshButton = refreshButton;
        refreshButton.style.display = "none";
      }

      actions.classList.add("vf-contact-actions");

      backLink = document.createElement("a");
      backLink.href = "/sistema-completo";
      backLink.className = styles.backLink;
      backLink.setAttribute("aria-label", "Voltar ao sistema completo");

      const arrow = document.createElement("span");
      arrow.className = styles.arrow;
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "←";

      const label = document.createElement("span");
      label.textContent = "Voltar";

      backLink.append(arrow, label);
      shell.prepend(backLink);
      return true;
    };

    const restore = () => {
      backLink?.remove();
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
