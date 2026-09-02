"use client";

import { useEffect } from "react";

const STORAGE_KEY = "voto-forte:meta:temporaryAccessToken";
const TOKEN_INPUT_SELECTOR = 'input[placeholder="Cole o token novo somente para esta sessão"]';

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function MetaWhatsappTokenPersistence() {
  useEffect(() => {
    const readToken = () => {
      try {
        return localStorage.getItem(STORAGE_KEY)?.trim() || "";
      } catch {
        return "";
      }
    };

    const saveToken = (value: string) => {
      try {
        const token = value.trim();
        if (token) localStorage.setItem(STORAGE_KEY, token);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {}
    };

    const hydrate = () => {
      const token = readToken();
      if (!token) return;
      const input = document.querySelector<HTMLInputElement>(TOKEN_INPUT_SELECTOR);
      if (input && input.value !== token) setReactInputValue(input, token);
    };

    const hydrateForTwoSeconds = () => {
      hydrate();
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        hydrate();
        if (Date.now() - startedAt >= 2000) window.clearInterval(timer);
      }, 150);
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches(TOKEN_INPUT_SELECTOR)) return;
      saveToken(target.value);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button) return;
      const text = button.textContent || "";
      if (text.includes("Meta API") || text.includes("Disparo em Massa")) {
        window.setTimeout(hydrateForTwoSeconds, 50);
      }
    };

    const onOpenDrawer = () => window.setTimeout(hydrateForTwoSeconds, 50);

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("voto-forte:open-whaticket-drawer", onOpenDrawer);

    window.setTimeout(hydrate, 250);

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("voto-forte:open-whaticket-drawer", onOpenDrawer);
    };
  }, []);

  return null;
}
