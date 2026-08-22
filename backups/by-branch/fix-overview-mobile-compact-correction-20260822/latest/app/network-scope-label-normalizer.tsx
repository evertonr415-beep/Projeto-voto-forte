"use client";

import { useEffect } from "react";

const NETWORK_LABEL = "Todos da rede";
const LEGACY_LABELS = new Set([
  "todos os usuários",
  "todos os usuarios",
  "toda a rede",
  "todos da rede",
]);

function isLegacyNetworkLabel(value: string | null | undefined) {
  return LEGACY_LABELS.has(String(value || "").trim().toLocaleLowerCase("pt-BR"));
}

function normalizeNetworkScopeLabels() {
  document
    .querySelectorAll<HTMLOptionElement>('select option[value="all"]')
    .forEach((option) => {
      if (isLegacyNetworkLabel(option.textContent) && option.text !== NETWORK_LABEL) {
        option.text = NETWORK_LABEL;
      }
    });

  document
    .querySelectorAll<HTMLElement>(
      ".scope-picker span, .scope-picker b, .vf-header-scope span, .optimized-scope-control span, .optimized-scope-control b, .optimized-scope-badge span, .optimized-scope-badge b, .optimized-section-heading h2",
    )
    .forEach((node) => {
      if (isLegacyNetworkLabel(node.textContent) && node.textContent !== NETWORK_LABEL) {
        node.textContent = NETWORK_LABEL;
      }
    });

  document
    .querySelectorAll<HTMLElement>("[title], [aria-label]")
    .forEach((node) => {
      const title = node.getAttribute("title");
      if (isLegacyNetworkLabel(title)) node.setAttribute("title", NETWORK_LABEL);
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
