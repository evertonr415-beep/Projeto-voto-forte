"use client";

import { useEffect } from "react";

const NETWORK_LABEL = "Todos da rede";
const LEGACY_LABELS = new Set([
  "todos os usuários",
  "todos os usuarios",
  "toda a rede",
  "todos da rede",
]);
const LEGACY_NETWORK_TEXT_PATTERN = /todos os usu(?:á|a)rios|toda a rede/giu;
const NETWORK_SCOPE_OPTION_SELECTOR = [
  '.scope-picker select option[value="all"]',
  '.vf-header-scope select option[value="all"]',
  '.optimized-scope-control select option[value="all"]',
].join(", ");
const NETWORK_SCOPE_TEXT_SELECTOR = [
  ".scope-picker span",
  ".scope-picker b",
  ".vf-header-scope span",
  ".optimized-scope-control span",
  ".optimized-scope-control b",
  ".optimized-scope-badge span",
  ".optimized-scope-badge b",
  ".optimized-section-heading h2",
  ".welcome-pro .welcome-copy span",
].join(", ");

function isLegacyNetworkLabel(value: string | null | undefined) {
  return LEGACY_LABELS.has(
    String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR"),
  );
}

function normalizeNetworkText(value: string | null | undefined) {
  const text = String(value || "");
  if (!text) return text;
  if (isLegacyNetworkLabel(text)) return NETWORK_LABEL;
  return text.replace(LEGACY_NETWORK_TEXT_PATTERN, NETWORK_LABEL);
}

function normalizeNetworkScopeLabels() {
  document
    .querySelectorAll<HTMLOptionElement>(NETWORK_SCOPE_OPTION_SELECTOR)
    .forEach((option) => {
      const normalized = normalizeNetworkText(option.text);
      if (normalized !== option.text) option.text = normalized;
    });

  document
    .querySelectorAll<HTMLElement>(NETWORK_SCOPE_TEXT_SELECTOR)
    .forEach((node) => {
      const current = node.textContent || "";
      const normalized = normalizeNetworkText(current);
      if (normalized !== current) node.textContent = normalized;
    });

  document
    .querySelectorAll<HTMLElement>(
      ".scope-picker [title], .scope-picker [aria-label], .vf-header-scope [title], .vf-header-scope [aria-label], .optimized-scope-control [title], .optimized-scope-control [aria-label]",
    )
    .forEach((node) => {
      (["title", "aria-label"] as const).forEach((attribute) => {
        const current = node.getAttribute(attribute);
        if (!current) return;
        const normalized = normalizeNetworkText(current);
        if (normalized !== current) node.setAttribute(attribute, normalized);
      });
    });
}

export default function NetworkScopeLabelNormalizer() {
  useEffect(() => {
    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        normalizeNetworkScopeLabels();
      });
    };

    normalizeNetworkScopeLabels();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
