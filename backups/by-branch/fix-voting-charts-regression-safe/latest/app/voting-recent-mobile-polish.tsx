"use client";

import { useEffect } from "react";

const INITIAL_VISIBLE = 4;

export default function VotingRecentMobilePolish() {
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    let expanded = false;
    let disposed = false;
    let scheduled = false;

    const sync = () => {
      scheduled = false;
      if (disposed) return;

      document.querySelectorAll<HTMLElement>(".voting-recent-feed").forEach((section) => {
        const feed = section.querySelector<HTMLElement>(".voting-feed-mobile");
        if (!feed) return;

        const existingToggle = section.querySelector<HTMLButtonElement>(".vf-recent-toggle");

        if (!media.matches) {
          section.classList.remove("vf-recent-mobile-polished", "vf-recent-expanded");
          feed.querySelectorAll<HTMLElement>(".voting-feed-mobile-card").forEach((card) => {
            if (card.hidden) card.hidden = false;
            delete card.dataset.vfRecentExtra;
          });
          existingToggle?.remove();
          return;
        }

        if (!section.classList.contains("vf-recent-mobile-polished")) {
          section.classList.add("vf-recent-mobile-polished");
        }
        section.classList.toggle("vf-recent-expanded", expanded);

        const cards = Array.from(feed.querySelectorAll<HTMLElement>(".voting-feed-mobile-card"));
        cards.forEach((card, index) => {
          const isExtra = index >= INITIAL_VISIBLE;
          const nextExtra = isExtra ? "true" : "false";
          if (card.dataset.vfRecentExtra !== nextExtra) {
            card.dataset.vfRecentExtra = nextExtra;
          }
          const shouldHide = isExtra && !expanded;
          if (card.hidden !== shouldHide) card.hidden = shouldHide;
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

          const label = document.createElement("span");
          label.className = "vf-recent-toggle-label";
          const icon = document.createElement("span");
          icon.className = "vf-recent-toggle-icon";
          toggle.append(label, icon);

          toggle.addEventListener("click", () => {
            expanded = !expanded;
            scheduleSync();
          });
          feed.insertAdjacentElement("afterend", toggle);
        }

        const hiddenCount = Math.max(0, cards.length - INITIAL_VISIBLE);
        const nextExpanded = expanded ? "true" : "false";
        if (toggle.getAttribute("aria-expanded") !== nextExpanded) {
          toggle.setAttribute("aria-expanded", nextExpanded);
        }

        const label = toggle.querySelector<HTMLElement>(".vf-recent-toggle-label");
        const icon = toggle.querySelector<HTMLElement>(".vf-recent-toggle-icon");
        const nextLabel = expanded
          ? "Mostrar menos"
          : `Ver mais ${hiddenCount} participaç${hiddenCount === 1 ? "ão" : "ões"}`;
        const nextIcon = expanded ? "⌃" : "⌄";

        if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
        if (icon && icon.textContent !== nextIcon) icon.textContent = nextIcon;
      });
    };

    function scheduleSync() {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    }

    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    media.addEventListener("change", scheduleSync);

    return () => {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", scheduleSync);
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
