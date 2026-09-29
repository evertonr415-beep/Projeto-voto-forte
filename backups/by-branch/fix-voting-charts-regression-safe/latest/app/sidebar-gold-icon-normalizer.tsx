"use client";

import { useEffect } from "react";

const GOLD = "#d7ae60";

const ICONS: Record<string, string> = {
  "Envio Individual": `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  `,
  "Disparo em Massa": `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13.5 2.5 5 13h6.2l-.7 8.5L19 11h-6.2l.7-8.5Z" />
    </svg>
  `,
  "Agenda Inteligente": `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <text x="12" y="18.1" text-anchor="middle" fill="currentColor" stroke="none" font-size="7.8" font-weight="750" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">17</text>
    </svg>
  `,
  "Enquete Digital": `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="14" width="3.5" height="6" rx=".8" />
      <rect x="10.25" y="9" width="3.5" height="11" rx=".8" />
      <rect x="16.5" y="4" width="3.5" height="16" rx=".8" />
    </svg>
  `,
  "Histórico de exportações": `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 15.5v3A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  `,
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSidebarIcons() {
  const nav = document.querySelector<HTMLElement>(".sidebar nav");
  if (!nav) return;

  nav.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const labelNode = button.querySelector<HTMLElement>(".nav-name");
    const label = normalizeText(labelNode?.textContent || button.textContent || "");
    const iconNode = button.querySelector<HTMLElement>(".nav-icon");
    if (!iconNode) return;

    iconNode.style.setProperty("color", GOLD, "important");

    const iconMarkup = ICONS[label];
    if (!iconMarkup || iconNode.dataset.vfGoldIcon === label) return;

    iconNode.innerHTML = iconMarkup;
    iconNode.dataset.vfGoldIcon = label;
  });
}

export default function SidebarGoldIconNormalizer() {
  useEffect(() => {
    let frame = 0;

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        normalizeSidebarIcons();
      });
    };

    normalizeSidebarIcons();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <style>{`
      .app-shell .sidebar nav .nav-icon {
        width: 22px !important;
        height: 22px !important;
        min-width: 22px !important;
        flex: 0 0 22px !important;
        display: inline-grid !important;
        place-items: center !important;
        color: ${GOLD} !important;
        line-height: 1 !important;
      }

      .app-shell .sidebar nav .nav-icon svg {
        width: 21px !important;
        height: 21px !important;
        display: block !important;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
        overflow: visible;
      }

      .app-shell .sidebar nav button:hover .nav-icon,
      .app-shell .sidebar nav button.active .nav-icon,
      body.vf-individual-message-mode .app-shell .sidebar nav button.vf-individual-whatsapp-sidebar-btn .nav-icon {
        color: #e9c46d !important;
      }
    `}</style>
  );
}
