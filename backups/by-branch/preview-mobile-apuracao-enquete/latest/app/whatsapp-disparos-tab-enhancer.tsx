"use client";

import { useEffect } from "react";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isWhatsappDisparosTab(button: HTMLButtonElement) {
  const label = normalizeText(button.textContent || "");
  if (!label.includes("Disparos") || label.includes("Abrir")) return false;

  const parent = button.parentElement;
  if (!parent) return false;

  const siblingLabels = Array.from(parent.children)
    .filter((element): element is HTMLButtonElement => element instanceof HTMLButtonElement)
    .map((element) => normalizeText(element.textContent || ""));

  return (
    siblingLabels.some((text) => text.includes("Chat")) &&
    siblingLabels.some((text) => text.includes("Monitor")) &&
    siblingLabels.some((text) => text.includes("Disparos"))
  );
}

export default function WhatsappDisparosTabEnhancer() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      if (!isWhatsappDisparosTab(button)) return;

      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"));
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
