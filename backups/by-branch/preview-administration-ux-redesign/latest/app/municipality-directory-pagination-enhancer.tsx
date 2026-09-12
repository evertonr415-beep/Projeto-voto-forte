"use client";

import { useEffect } from "react";

const INITIAL_LIMIT = 5;
const STEP = 5;

export default function MunicipalityDirectoryPaginationEnhancer() {
  useEffect(() => {
    let cancelled = false;
    let visibleLimit = INITIAL_LIMIT;
    let boundInput: HTMLInputElement | null = null;
    let controls: HTMLDivElement | null = null;

    const update = () => {
      if (cancelled) return;

      const directory = document.querySelector<HTMLElement>(".vf-municipality-directory");
      const input = document.querySelector<HTMLInputElement>(".vf-municipality-toolbar input");
      if (!directory || !input) return;

      if (boundInput !== input) {
        boundInput?.removeEventListener("input", handleSearch);
        boundInput = input;
        boundInput.addEventListener("input", handleSearch);
      }

      const cards = Array.from(directory.querySelectorAll<HTMLElement>(":scope > article"));
      const searching = input.value.trim().length > 0;

      cards.forEach((card, index) => {
        card.hidden = !searching && index >= visibleLimit;
      });

      if (!controls || !controls.isConnected) {
        controls = document.createElement("div");
        controls.className = "vf-municipality-pagination";
        directory.insertAdjacentElement("afterend", controls);
      }

      if (searching || cards.length <= INITIAL_LIMIT) {
        controls.replaceChildren();
        controls.hidden = true;
        return;
      }

      controls.hidden = false;
      controls.replaceChildren();

      const shown = Math.min(visibleLimit, cards.length);
      const remaining = Math.max(cards.length - shown, 0);

      const status = document.createElement("span");
      status.textContent = `Exibindo ${shown} de ${cards.length} municípios`;
      controls.append(status);

      const actions = document.createElement("div");

      if (remaining > 0) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "vf-municipality-more";
        more.textContent = `Ver mais ${Math.min(STEP, remaining)}`;
        more.onclick = () => {
          visibleLimit = Math.min(visibleLimit + STEP, cards.length);
          update();
        };
        actions.append(more);
      }

      if (visibleLimit > INITIAL_LIMIT) {
        const less = document.createElement("button");
        less.type = "button";
        less.className = "vf-municipality-less";
        less.textContent = "Mostrar menos";
        less.onclick = () => {
          visibleLimit = INITIAL_LIMIT;
          update();
          directory.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        actions.append(less);
      }

      controls.append(actions);
    };

    function handleSearch() {
      visibleLimit = INITIAL_LIMIT;
      window.requestAnimationFrame(update);
    }

    update();
    const observer = new MutationObserver(() => window.requestAnimationFrame(update));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      boundInput?.removeEventListener("input", handleSearch);
      controls?.remove();
      document.querySelectorAll<HTMLElement>(".vf-municipality-directory > article").forEach((card) => {
        card.hidden = false;
      });
    };
  }, []);

  return null;
}
