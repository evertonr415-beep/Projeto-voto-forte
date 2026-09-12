"use client";

import { useEffect } from "react";

const MODE_CLASS = "vf-individual-message-mode";
const BUTTON_CLASS = "vf-individual-whatsapp-sidebar-btn";

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getSidebarNav() {
  return document.querySelector<HTMLElement>(".sidebar nav");
}

function findWhatsappSidebarButton(nav: HTMLElement) {
  return Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    if (button.classList.contains(BUTTON_CLASS)) return false;
    const label = normalizeText(button.textContent || "");
    return label === "WhatsApp" || label.endsWith(" WhatsApp");
  });
}

function findWhatsappMonitorButton() {
  const workspace = document.querySelector<HTMLElement>(".workspace");
  if (!workspace) return null;

  return Array.from(workspace.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const label = normalizeText(button.textContent || "");
    if (!label.includes("Monitor")) return false;

    const parent = button.parentElement;
    if (!parent) return false;
    const labels = Array.from(parent.querySelectorAll<HTMLButtonElement>(":scope > button")).map((item) =>
      normalizeText(item.textContent || ""),
    );

    return labels.some((text) => text.includes("Chat")) && labels.some((text) => text.includes("Disparos"));
  }) || null;
}

function activateIndividualMessaging() {
  const nav = getSidebarNav();
  const existingMonitorButton = findWhatsappMonitorButton();

  const finish = () => {
    const monitorButton = findWhatsappMonitorButton();
    if (monitorButton) monitorButton.click();
    document.body.classList.add(MODE_CLASS);
    window.dispatchEvent(new CustomEvent("voto-forte:close-mobile-sidebar"));
  };

  if (existingMonitorButton) {
    finish();
    return;
  }

  const whatsappButton = nav ? findWhatsappSidebarButton(nav) : null;
  whatsappButton?.click();

  let attempts = 0;
  const waitForWhatsapp = () => {
    attempts += 1;
    if (findWhatsappMonitorButton()) {
      finish();
      return;
    }
    if (attempts < 24) window.setTimeout(waitForWhatsapp, 35);
  };
  window.setTimeout(waitForWhatsapp, 35);
}

function clearIndividualMessaging() {
  document.body.classList.remove(MODE_CLASS);
}

export default function IndividualWhatsappMenuEnhancer() {
  useEffect(() => {
    let frame = 0;

    const ensureButton = () => {
      const nav = getSidebarNav();
      if (!nav) return;

      const whatsappButton = findWhatsappSidebarButton(nav);
      if (!whatsappButton) return;

      let button = nav.querySelector<HTMLButtonElement>(`.${BUTTON_CLASS}`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = BUTTON_CLASS;
        button.title = "Envio Individual";
        button.setAttribute("aria-label", "Envio Individual");

        const icon = document.createElement("span");
        icon.className = "nav-icon";
        icon.textContent = "✉️";

        const label = document.createElement("span");
        label.className = "nav-name";
        label.textContent = "Envio Individual";

        const badge = document.createElement("em");
        badge.textContent = "1 A 1";

        button.append(icon, label, badge);
        button.addEventListener("click", activateIndividualMessaging);
      }

      const nextNode = whatsappButton.nextSibling;
      if (nextNode !== button) nav.insertBefore(button, nextNode);
    };

    const scheduleEnsure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        ensureButton();
      });
    };

    const handleNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".sidebar nav button");
      if (!button || button.classList.contains(BUTTON_CLASS)) return;
      clearIndividualMessaging();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearIndividualMessaging();
    };

    ensureButton();
    const observer = new MutationObserver(scheduleEnsure);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleNavigation, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", handleNavigation, true);
      document.removeEventListener("keydown", handleEscape);
      document.querySelector(`.${BUTTON_CLASS}`)?.remove();
      clearIndividualMessaging();
    };
  }, []);

  return (
    <style>{`
      /* O Monitor fica exclusivamente operacional: remove o atalho duplicado da Central. */
      body:has(.wt-live-feed-list) .wa-layout > div:first-child {
        display: none !important;
      }

      /* A mensagem manual não aparece mais misturada ao Monitor. */
      body:not(.${MODE_CLASS}) .wa-layout > .composer,
      body:not(.${MODE_CLASS}) .wa-layout > .drafts {
        display: none !important;
      }

      .sidebar nav button.${BUTTON_CLASS} {
        border-left: 3px solid transparent !important;
        background: rgba(56, 189, 248, 0.055);
        color: #b7c9ce;
        min-height: 46px;
        border-radius: 7px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        gap: 13px;
        cursor: pointer;
        width: 100%;
        font-size: 12px;
        font-weight: 650;
        text-align: left;
        transition: all .2s ease;
        margin: 2px 0;
      }

      .sidebar nav button.${BUTTON_CLASS}:hover,
      body.${MODE_CLASS} .sidebar nav button.${BUTTON_CLASS} {
        background: rgba(56, 189, 248, 0.14) !important;
        color: #fff !important;
        border-left-color: #38bdf8 !important;
      }

      .sidebar nav button.${BUTTON_CLASS} .nav-icon {
        width: 22px;
        text-align: center;
        font-size: 16px;
      }

      .sidebar nav button.${BUTTON_CLASS} em {
        margin-left: auto;
        font-style: normal;
        font-size: 7px;
        letter-spacing: .6px;
        background: rgba(56, 189, 248, .15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, .3);
        padding: 4px 6px;
        border-radius: 10px;
        font-weight: 800;
      }

      /* Envio Individual reaproveita o compositor e os rascunhos originais. */
      body.${MODE_CLASS} .workspace > .page-head,
      body.${MODE_CLASS} .workspace > .page-head + div {
        display: none !important;
      }

      body.${MODE_CLASS} .wa-layout {
        display: grid !important;
        grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr) !important;
        gap: 16px !important;
        align-items: start !important;
        width: 100% !important;
        max-width: 100% !important;
        overflow: visible !important;
      }

      body.${MODE_CLASS} .wa-layout::before {
        content: "✉️  Envio Individual\\AEnvie uma mensagem manual por vez e mantenha seus rascunhos organizados.";
        white-space: pre-line;
        grid-column: 1 / -1;
        display: block;
        padding: 18px 20px;
        border-radius: 14px;
        border: 1px solid rgba(56, 189, 248, .28);
        background: linear-gradient(135deg, rgba(12, 38, 68, .96), rgba(14, 31, 57, .96));
        color: #f8fafc;
        font-size: 19px;
        line-height: 1.5;
        font-weight: 800;
        box-shadow: 0 14px 34px rgba(0,0,0,.18);
      }

      body.${MODE_CLASS} .wa-layout > *:not(.composer):not(.drafts) {
        display: none !important;
      }

      body.${MODE_CLASS} .wa-layout > .composer,
      body.${MODE_CLASS} .wa-layout > .drafts {
        display: block !important;
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        grid-column: auto !important;
        margin: 0 !important;
      }

      body.${MODE_CLASS} .wa-layout > .composer {
        grid-column: 1 !important;
      }

      body.${MODE_CLASS} .wa-layout > .drafts {
        grid-column: 2 !important;
      }

      body.${MODE_CLASS} .composer textarea,
      body.${MODE_CLASS} .composer input {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      @media (max-width: 900px) {
        body.${MODE_CLASS} .workspace {
          padding-bottom: 0 !important;
        }

        body.${MODE_CLASS} .wa-layout {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 12px !important;
          margin: 0 !important;
        }

        body.${MODE_CLASS} .wa-layout::before {
          grid-column: 1 !important;
          margin: 0 0 2px !important;
          padding: 14px 15px !important;
          border-radius: 12px !important;
          font-size: 16px !important;
          line-height: 1.45 !important;
        }

        body.${MODE_CLASS} .wa-layout > .composer,
        body.${MODE_CLASS} .wa-layout > .drafts {
          grid-column: 1 !important;
          border-radius: 12px !important;
        }

        body.${MODE_CLASS} .composer {
          padding: 14px !important;
        }

        body.${MODE_CLASS} .drafts {
          padding: 14px !important;
        }

        .sidebar nav button.${BUTTON_CLASS} {
          min-height: 44px;
        }
      }
    `}</style>
  );
}
