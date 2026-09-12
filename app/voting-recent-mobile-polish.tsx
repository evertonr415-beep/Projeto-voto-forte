"use client";

import { useEffect } from "react";

const INITIAL_VISIBLE = 4;

export default function VotingRecentMobilePolish() {
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    let expanded = false;

    const sync = () => {
      document.querySelectorAll<HTMLElement>(".voting-recent-feed").forEach((section) => {
        const feed = section.querySelector<HTMLElement>(".voting-feed-mobile");
        if (!feed) return;

        const existingToggle = section.querySelector<HTMLButtonElement>(".vf-recent-toggle");

        if (!media.matches) {
          section.classList.remove("vf-recent-mobile-polished", "vf-recent-expanded");
          feed.querySelectorAll<HTMLElement>(".voting-feed-mobile-card").forEach((card) => {
            card.hidden = false;
            delete card.dataset.vfRecentExtra;
          });
          existingToggle?.remove();
          return;
        }

        section.classList.add("vf-recent-mobile-polished");
        section.classList.toggle("vf-recent-expanded", expanded);

        const cards = Array.from(feed.querySelectorAll<HTMLElement>(".voting-feed-mobile-card"));
        cards.forEach((card, index) => {
          const isExtra = index >= INITIAL_VISIBLE;
          card.dataset.vfRecentExtra = isExtra ? "true" : "false";
          card.hidden = isExtra && !expanded;
        });

        if (cards.length <= INITIAL_VISIBLE) {
          existingToggle?.remove();
          return;
        }

        let toggle = existingToggle;
        if (!toggle) {
          toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "vf-recent-toggle";
          toggle.setAttribute("aria-expanded", "false");
          toggle.addEventListener("click", () => {
            expanded = !expanded;
            sync();
          });
          feed.insertAdjacentElement("afterend", toggle);
        }

        const hiddenCount = Math.max(0, cards.length - INITIAL_VISIBLE);
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        toggle.innerHTML = expanded
          ? '<span>Mostrar menos</span><span class="vf-recent-toggle-icon">⌃</span>'
          : `<span>Ver mais ${hiddenCount} participaç${hiddenCount === 1 ? "ão" : "ões"}</span><span class="vf-recent-toggle-icon">⌄</span>`;
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.querySelectorAll<HTMLElement>(".voting-recent-feed").forEach((section) => {
        section.classList.remove("vf-recent-mobile-polished", "vf-recent-expanded");
        section.querySelector(".vf-recent-toggle")?.remove();
        section.querySelectorAll<HTMLElement>(".voting-feed-mobile-card").forEach((card) => {
          card.hidden = false;
          delete card.dataset.vfRecentExtra;
        });
      });
    };
  }, []);

  return (
    <style>{`
      @media (max-width: 760px) {
        .voting-recent-feed.vf-recent-mobile-polished {
          padding: 13px 11px 12px !important;
          border-radius: 14px !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished > .voting-chart-header {
          margin-bottom: 9px !important;
          padding-bottom: 9px !important;
          gap: 8px !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished > .voting-chart-header h2 {
          gap: 6px !important;
          font-size: 0.88rem !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-total-badge {
          padding: 4px 8px !important;
          font-size: 0.61rem !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile {
          gap: 6px !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-card {
          padding: 8px 9px !important;
          border-radius: 10px !important;
          background: rgba(15, 23, 42, 0.38) !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-card[hidden] {
          display: none !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-head {
          align-items: flex-start !important;
          gap: 7px !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-head > div {
          gap: 1px !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-head strong {
          font-size: 0.72rem !important;
          line-height: 1.18 !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-head > div > span {
          font-size: 0.56rem !important;
          line-height: 1.2 !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .sentiment-badge {
          padding: 4px 7px !important;
          border-radius: 7px !important;
          font-size: 0.52rem !important;
          line-height: 1 !important;
          letter-spacing: 0.04em !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-votes {
          margin: 6px 0 5px !important;
          gap: 5px !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-votes > span {
          min-width: 0 !important;
          padding: 5px 6px !important;
          border-radius: 7px !important;
          font-size: 0.61rem !important;
          line-height: 1.18 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-votes small {
          margin-bottom: 2px !important;
          font-size: 0.49rem !important;
          line-height: 1 !important;
          letter-spacing: 0.06em !important;
        }

        /* O identificador técnico (telefone/origem/hash) continua nos dados,
           mas não ocupa espaço na leitura resumida do mobile. */
        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-foot > span:first-child {
          display: none !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-foot {
          min-height: 14px !important;
          justify-content: flex-end !important;
          padding-top: 4px !important;
          border-top: 1px solid rgba(148, 163, 184, 0.08) !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .voting-feed-mobile-foot > span:last-child {
          color: #8291a6 !important;
          font-size: 0.53rem !important;
          line-height: 1.1 !important;
          white-space: nowrap !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .vf-recent-toggle {
          width: 100% !important;
          min-height: 34px !important;
          margin-top: 8px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          padding: 7px 10px !important;
          border: 1px solid rgba(56, 189, 248, 0.18) !important;
          border-radius: 10px !important;
          color: #b9dff3 !important;
          background: rgba(14, 116, 144, 0.08) !important;
          font: inherit !important;
          font-size: 0.64rem !important;
          font-weight: 760 !important;
          cursor: pointer !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .vf-recent-toggle:active {
          background: rgba(14, 116, 144, 0.16) !important;
          transform: translateY(1px) !important;
        }

        .voting-recent-feed.vf-recent-mobile-polished .vf-recent-toggle-icon {
          color: #38bdf8 !important;
          font-size: 0.78rem !important;
          line-height: 1 !important;
        }
      }
    `}</style>
  );
}
