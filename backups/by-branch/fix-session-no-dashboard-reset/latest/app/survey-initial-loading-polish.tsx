"use client";

import { useEffect } from "react";

const INITIAL_CLASS = "vf-survey-initial-loading";
const REFRESH_CLASS = "vf-survey-silent-refresh";

function ensureInitialLoader(body: HTMLElement) {
  let loader = body.querySelector<HTMLElement>(":scope > .vf-survey-initial-loader");
  if (loader) return loader;

  loader = document.createElement("div");
  loader.className = "vf-survey-initial-loader";
  loader.innerHTML = `
    <div class="vf-survey-loader-spinner" aria-hidden="true"></div>
    <strong>Atualizando apuração…</strong>
    <span>Sincronizando respostas, bairros e rankings em tempo real</span>
    <small>Os indicadores aparecerão assim que a atualização terminar.</small>
  `;
  body.prepend(loader);
  return loader;
}

function ensureRefreshChip(body: HTMLElement) {
  let chip = body.querySelector<HTMLElement>(":scope > .vf-survey-refresh-chip");
  if (chip) return chip;

  chip = document.createElement("div");
  chip.className = "vf-survey-refresh-chip";
  chip.innerHTML = `<span class="vf-survey-refresh-dot" aria-hidden="true"></span> Atualizando dados em tempo real…`;
  body.prepend(chip);
  return chip;
}

export default function SurveyInitialLoadingPolish() {
  useEffect(() => {
    let frame = 0;
    let fallbackTimer = 0;

    const reveal = (body: HTMLElement) => {
      body.dataset.vfSurveyLoadPhase = "ready";
      body.classList.remove(INITIAL_CLASS);
      body.querySelector(":scope > .vf-survey-initial-loader")?.remove();
    };

    const sync = () => {
      const drawer = document.querySelector<HTMLElement>(".survey-drawer");
      if (!drawer) return;

      const body = drawer.querySelector<HTMLElement>(".survey-body");
      if (!body) return;

      const refreshButton = drawer.querySelector<HTMLButtonElement>(".survey-action.secondary");
      const buttonText = refreshButton?.textContent || "";
      const isLoading = Boolean(refreshButton?.disabled && /Atualizando/i.test(buttonText));
      let phase = body.dataset.vfSurveyLoadPhase;

      if (!phase) {
        phase = "waiting";
        body.dataset.vfSurveyLoadPhase = phase;
        body.classList.add(INITIAL_CLASS);
        ensureInitialLoader(body);

        window.clearTimeout(fallbackTimer);
        fallbackTimer = window.setTimeout(() => {
          const currentDrawer = document.querySelector<HTMLElement>(".survey-drawer");
          const currentBody = currentDrawer?.querySelector<HTMLElement>(".survey-body");
          if (currentBody?.dataset.vfSurveyLoadPhase === "waiting") {
            reveal(currentBody);
          }
        }, 8000);
      }

      if (phase === "waiting" && isLoading) {
        body.dataset.vfSurveyLoadPhase = "loading";
        phase = "loading";
      }

      if (phase === "loading" && !isLoading) {
        window.clearTimeout(fallbackTimer);
        reveal(body);
        return;
      }

      if (phase === "ready") {
        if (isLoading) {
          body.classList.add(REFRESH_CLASS);
          ensureRefreshChip(body);
        } else {
          body.classList.remove(REFRESH_CLASS);
          body.querySelector(":scope > .vf-survey-refresh-chip")?.remove();
        }
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled", "class"],
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <style jsx global>{`
      .survey-body.${INITIAL_CLASS} > :not(.vf-survey-initial-loader) {
        display: none !important;
      }

      .survey-body .vf-survey-initial-loader {
        min-height: 380px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 34px 22px;
        border: 1px solid rgba(56, 189, 248, 0.24);
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(19, 34, 56, 0.98), rgba(10, 24, 41, 0.98));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025), 0 18px 44px rgba(1, 8, 18, 0.16);
        text-align: center;
      }

      .vf-survey-loader-spinner {
        width: 46px;
        height: 46px;
        margin-bottom: 8px;
        border-radius: 999px;
        border: 5px solid rgba(56, 189, 248, 0.18);
        border-top-color: #38bdf8;
        border-right-color: #2ddc86;
        animation: vf-survey-spin 0.9s linear infinite;
      }

      .vf-survey-initial-loader strong {
        color: #f4f8fc;
        font-size: 21px;
        line-height: 1.2;
        font-weight: 850;
        letter-spacing: -0.02em;
      }

      .vf-survey-initial-loader span {
        max-width: 470px;
        color: #b8c7d9;
        font-size: 14px;
        line-height: 1.45;
        font-weight: 650;
      }

      .vf-survey-initial-loader small {
        max-width: 440px;
        color: #71849c;
        font-size: 12px;
        line-height: 1.4;
      }

      .vf-survey-refresh-chip {
        display: none;
      }

      .survey-body.${REFRESH_CLASS} > .vf-survey-refresh-chip {
        position: sticky;
        top: 0;
        z-index: 7;
        width: fit-content;
        max-width: calc(100% - 8px);
        margin: 0 auto 10px;
        padding: 7px 11px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 999px;
        background: rgba(9, 27, 46, 0.94);
        color: #bfe9fb;
        box-shadow: 0 8px 24px rgba(1, 8, 18, 0.18);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-size: 11px;
        line-height: 1;
        font-weight: 750;
      }

      .vf-survey-refresh-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 8px;
        border-radius: 999px;
        background: #38bdf8;
        box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.12);
        animation: vf-survey-pulse 1.2s ease-in-out infinite;
      }

      @keyframes vf-survey-spin {
        to { transform: rotate(360deg); }
      }

      @keyframes vf-survey-pulse {
        0%, 100% { opacity: 0.55; transform: scale(0.9); }
        50% { opacity: 1; transform: scale(1); }
      }

      @media (max-width: 760px) {
        .survey-body.${INITIAL_CLASS} {
          padding: 16px 12px 24px !important;
        }

        .survey-body .vf-survey-initial-loader {
          min-height: min(58vh, 470px);
          padding: 28px 18px;
          border-radius: 18px;
        }

        .vf-survey-initial-loader strong {
          font-size: 19px;
        }

        .vf-survey-initial-loader span {
          max-width: 320px;
          font-size: 13px;
        }

        .vf-survey-initial-loader small {
          max-width: 300px;
          font-size: 11px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .vf-survey-loader-spinner,
        .vf-survey-refresh-dot {
          animation: none !important;
        }
      }
    `}</style>
  );
}
