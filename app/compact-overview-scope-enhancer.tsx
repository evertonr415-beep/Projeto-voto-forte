"use client";

import { useEffect } from "react";

const COMPACT_CLASS = "vf-header-scope";
const SOURCE_HIDDEN_ATTR = "data-vf-scope-source-hidden";
const CONTEXT_HIDDEN_ATTR = "data-vf-original-context-hidden";
const MOBILE_TAB_HEADER_ATTR = "data-vf-mobile-compact-tab-header";
const NETWORK_LABEL = "Todos da rede";
const MOBILE_QUERY = "(max-width: 760px)";
const MOBILE_COMPACT_TABS = new Set(["contatos", "administração", "administracao", "whatsapp"]);

function optionSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}\u0000${option.text}`)
    .join("\u0001");
}

function displayOptionText(option: HTMLOptionElement) {
  if (option.value === "all") return NETWORK_LABEL;
  return option.text;
}

function normalizeTitle(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export default function CompactOverviewScopeEnhancer() {
  useEffect(() => {
    let disposed = false;
    let scheduled = false;
    let hiddenSource: HTMLLabelElement | null = null;
    let markedTopbar: HTMLElement | null = null;

    const restoreSource = () => {
      if (!hiddenSource) return;
      hiddenSource.style.removeProperty("display");
      hiddenSource.removeAttribute(SOURCE_HIDDEN_ATTR);
      hiddenSource = null;
    };

    const restoreContext = () => {
      document
        .querySelectorAll<HTMLElement>(`[${CONTEXT_HIDDEN_ATTR}="true"]`)
        .forEach((element) => {
          element.style.removeProperty("display");
          element.removeAttribute(CONTEXT_HIDDEN_ATTR);
        });
    };

    const clearMobileTabHeader = () => {
      if (!markedTopbar) return;
      markedTopbar.removeAttribute(MOBILE_TAB_HEADER_ATTR);
      markedTopbar = null;
    };

    const removeCompactControls = () => {
      document
        .querySelectorAll<HTMLElement>(`.${COMPACT_CLASS}`)
        .forEach((element) => element.remove());
    };

    const scheduleSync = () => {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    const sync = () => {
      scheduled = false;
      if (disposed) return;

      const welcome = document.querySelector<HTMLElement>(".welcome-pro .welcome-copy");
      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      const mapVisible =
        isMobile && Boolean(document.querySelector(".workspace .full-map"));
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const pageId = topbar?.querySelector<HTMLElement>(".page-id");
      const pageTitle = pageId?.querySelector<HTMLElement>("h1");
      const mobileTargetTab =
        isMobile && MOBILE_COMPACT_TABS.has(normalizeTitle(pageTitle?.textContent));

      if (markedTopbar && markedTopbar !== topbar) clearMobileTabHeader();
      if (topbar && mobileTargetTab) {
        topbar.setAttribute(MOBILE_TAB_HEADER_ATTR, "true");
        markedTopbar = topbar;
      } else {
        clearMobileTabHeader();
      }

      const compactContextVisible = Boolean(welcome || mapVisible || mobileTargetTab);
      const sourceLabel = topbar?.querySelector<HTMLLabelElement>(".scope-picker");
      const sourceSelect = sourceLabel?.querySelector<HTMLSelectElement>("select");

      if (
        !compactContextVisible ||
        !pageId ||
        !pageTitle ||
        !sourceLabel ||
        !sourceSelect
      ) {
        restoreSource();
        restoreContext();
        removeCompactControls();
        return;
      }

      const allOption = Array.from(sourceSelect.options).find(
        (option) => option.value === "all",
      );
      if (allOption && allOption.text !== NETWORK_LABEL) {
        allOption.text = NETWORK_LABEL;
      }

      if (hiddenSource && hiddenSource !== sourceLabel) restoreSource();
      hiddenSource = sourceLabel;
      sourceLabel.style.setProperty("display", "none", "important");
      sourceLabel.setAttribute(SOURCE_HIDDEN_ATTR, "true");

      restoreContext();
      const originalContext = welcome
        ? (Array.from(welcome.children).find(
            (child) =>
              child instanceof HTMLElement &&
              child.tagName === "SPAN" &&
              !child.classList.contains(COMPACT_CLASS),
          ) as HTMLElement | undefined)
        : undefined;

      if (originalContext) {
        originalContext.style.setProperty("display", "none", "important");
        originalContext.setAttribute(CONTEXT_HIDDEN_ATTR, "true");
      }

      let compact = pageId.querySelector<HTMLElement>(`:scope > .${COMPACT_CLASS}`);
      let compactSelect = compact?.querySelector<HTMLSelectElement>("select");

      if (!compact || !compactSelect) {
        compact?.remove();
        compact = document.createElement("div");
        compact.className = COMPACT_CLASS;
        compact.setAttribute("role", "group");
        compact.setAttribute("aria-label", "Selecionar ambiente da rede");

        const selectWrap = document.createElement("span");
        selectWrap.className = "vf-header-scope-select-wrap";

        compactSelect = document.createElement("select");
        compactSelect.className = "vf-header-scope-select";
        compactSelect.setAttribute(
          "aria-label",
          "Selecionar usuário ou todos da rede para visualizar os indicadores",
        );

        compactSelect.addEventListener("change", () => {
          const liveSource = document.querySelector<HTMLSelectElement>(
            ".topbar .scope-picker select",
          );
          if (!liveSource || !compactSelect) return;

          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) nativeSetter.call(liveSource, compactSelect.value);
          else liveSource.value = compactSelect.value;

          liveSource.dispatchEvent(new Event("change", { bubbles: true }));
          scheduleSync();
        });

        selectWrap.appendChild(compactSelect);
        compact.appendChild(selectWrap);
        pageId.appendChild(compact);
      }

      const sourceSignature = optionSignature(sourceSelect);
      if (compactSelect.dataset.optionsSignature !== sourceSignature) {
        compactSelect.replaceChildren(
          ...Array.from(sourceSelect.options).map((option) => {
            const clone = document.createElement("option");
            clone.value = option.value;
            clone.text = displayOptionText(option);
            clone.disabled = option.disabled;
            return clone;
          }),
        );
        compactSelect.dataset.optionsSignature = sourceSignature;
      }

      if (compactSelect.value !== sourceSelect.value) {
        compactSelect.value = sourceSelect.value;
      }
      compactSelect.title =
        sourceSelect.value === "all"
          ? NETWORK_LABEL
          : sourceSelect.selectedOptions[0]?.text || "Selecionar ambiente";
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    const handleChange = (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLSelectElement &&
        target.matches(".topbar .scope-picker select")
      ) {
        scheduleSync();
      }
    };

    document.addEventListener("change", handleChange, true);
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("change", handleChange, true);
      window.removeEventListener("resize", scheduleSync);
      restoreSource();
      restoreContext();
      clearMobileTabHeader();
      removeCompactControls();
    };
  }, []);

  return null;
}
