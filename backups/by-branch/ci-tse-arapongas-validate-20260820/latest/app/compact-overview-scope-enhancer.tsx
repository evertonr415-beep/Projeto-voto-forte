"use client";

import { useEffect } from "react";

const COMPACT_CLASS = "vf-welcome-scope";
const SOURCE_HIDDEN_ATTR = "data-vf-scope-source-hidden";
const CONTEXT_HIDDEN_ATTR = "data-vf-original-context-hidden";

function findOriginalContext(welcome: HTMLElement) {
  return Array.from(welcome.children).find(
    (child) =>
      child instanceof HTMLElement &&
      child.tagName === "SPAN" &&
      !child.classList.contains(COMPACT_CLASS),
  ) as HTMLElement | undefined;
}

function optionSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}\u0000${option.text}`)
    .join("\u0001");
}

export default function CompactOverviewScopeEnhancer() {
  useEffect(() => {
    let disposed = false;
    let scheduled = false;
    let hiddenSource: HTMLLabelElement | null = null;

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

      const welcome = document.querySelector<HTMLElement>(
        ".welcome-pro .welcome-copy",
      );
      const sourceLabel = document.querySelector<HTMLLabelElement>(
        ".topbar .scope-picker",
      );
      const sourceSelect = sourceLabel?.querySelector<HTMLSelectElement>(
        "select",
      );

      // Fora da Visão Geral (ou para usuário sem seletor administrativo),
      // preserva exatamente o comportamento original do cabeçalho.
      if (!welcome || !sourceLabel || !sourceSelect) {
        restoreSource();
        restoreContext();
        removeCompactControls();
        return;
      }

      if (hiddenSource && hiddenSource !== sourceLabel) restoreSource();
      hiddenSource = sourceLabel;
      if (sourceLabel.style.display !== "none") {
        sourceLabel.style.setProperty("display", "none", "important");
      }
      sourceLabel.setAttribute(SOURCE_HIDDEN_ATTR, "true");

      const originalContext = findOriginalContext(welcome);
      if (originalContext) {
        if (originalContext.style.display !== "none") {
          originalContext.style.setProperty("display", "none", "important");
        }
        originalContext.setAttribute(CONTEXT_HIDDEN_ATTR, "true");
      }

      let compact = welcome.querySelector<HTMLElement>(
        `:scope > .${COMPACT_CLASS}`,
      );
      let compactSelect = compact?.querySelector<HTMLSelectElement>("select");

      if (!compact || !compactSelect) {
        compact?.remove();

        compact = document.createElement("div");
        compact.className = COMPACT_CLASS;
        compact.setAttribute("role", "group");
        compact.setAttribute("aria-label", "Ambiente selecionado");

        const label = document.createElement("span");
        label.className = "vf-welcome-scope-label";
        label.textContent = "AMBIENTE SELECIONADO";

        const selectWrap = document.createElement("span");
        selectWrap.className = "vf-welcome-scope-select-wrap";

        compactSelect = document.createElement("select");
        compactSelect.className = "vf-welcome-scope-select";
        compactSelect.setAttribute(
          "aria-label",
          "Selecionar usuário para visualizar os indicadores",
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
        compact.append(label, selectWrap);
        welcome.insertBefore(compact, welcome.firstChild);
      }

      const sourceSignature = optionSignature(sourceSelect);
      if (compactSelect.dataset.optionsSignature !== sourceSignature) {
        compactSelect.replaceChildren(
          ...Array.from(sourceSelect.options).map((option) => {
            const clone = document.createElement("option");
            clone.value = option.value;
            clone.text = option.text;
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
        sourceSelect.selectedOptions[0]?.text || "Selecionar ambiente";
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

    scheduleSync();

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("change", handleChange, true);
      restoreSource();
      restoreContext();
      removeCompactControls();
    };
  }, []);

  return null;
}
