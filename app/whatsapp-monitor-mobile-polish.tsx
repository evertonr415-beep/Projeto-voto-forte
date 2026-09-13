"use client";

import { useEffect } from "react";

export default function WhatsappMonitorMobilePolish() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const syncSurveyKpis = async () => {
      try {
        const response = await fetch("/api/whatsapp/survey", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const total = Number(data?.totalResponses ?? data?.kpis?.totalResponses ?? 0);
        if (stopped || !Number.isFinite(total)) return;

        const monitor = document.querySelector("article.panel:has(.wt-kpi-grid-5)");
        if (!monitor) return;

        const replyCard = monitor.querySelector(".wt-kpi-card.is-reply strong");
        if (replyCard) replyCard.textContent = String(total);

        const totalCard = monitor.querySelector(".wt-kpi-card.is-primary strong");
        const totalOutbound = Number((totalCard?.textContent || "").replace(/\D/g, ""));
        const rate = totalOutbound > 0 ? Math.round((total / totalOutbound) * 1000) / 10 : 0;
        const rateCard = monitor.querySelector(".wt-kpi-card.is-rate strong");
        if (rateCard) rateCard.textContent = `${rate}%`;

        const replyPill = monitor.querySelector(".wt-filter-pill.is-reply");
        if (replyPill) {
          const label = (replyPill.textContent || "Respostas").replace(/\(.*?\)/g, "").trim();
          replyPill.textContent = `${label} (${total})`;
        }
      } catch {
        // O monitor continua funcional mesmo se a apuração estiver temporariamente indisponível.
      }
    };

    syncSurveyKpis();
    timer = setInterval(syncSurveyKpis, 5000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncSurveyKpis();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <style>{`
      @media (max-width: 760px) {
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) {
          border: 1px solid rgba(56, 189, 248, 0.28) !important;
          background: radial-gradient(circle at 96% 0%, rgba(14, 165, 233, 0.08), transparent 30%), linear-gradient(145deg, rgba(10, 25, 44, 0.98), rgba(13, 29, 50, 0.96)) !important;
          box-shadow: 0 16px 38px rgba(2, 8, 23, 0.26) !important;
          padding: 14px !important;
          border-radius: 14px !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-secondary-btn {
          border-color: rgba(56, 189, 248, 0.28) !important;
          color: #d9ecfb !important;
          background: rgba(19, 47, 77, 0.72) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-secondary-btn:last-child {
          border-color: rgba(56, 189, 248, 0.42) !important;
          color: #38bdf8 !important;
          background: rgba(14, 116, 144, 0.15) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card {
          min-height: 82px !important;
          border: 1px solid rgba(71, 115, 151, 0.46) !important;
          border-radius: 13px !important;
          background: linear-gradient(145deg, rgba(20, 45, 72, 0.88), rgba(13, 30, 51, 0.94)) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03), 0 7px 18px rgba(2, 8, 23, 0.14) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card strong { color: #38bdf8 !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card span { color: #9fb0c5 !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-primary { border-color: rgba(56, 189, 248, 0.38) !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-success { border-color: rgba(52, 211, 153, 0.31) !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-success strong { color: #34d399 !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-error { border-color: rgba(248, 113, 113, 0.31) !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-error strong { color: #f87171 !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-reply,
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-rate {
          border-color: rgba(56, 189, 248, 0.42) !important;
          background: linear-gradient(145deg, rgba(17, 46, 75, 0.90), rgba(12, 31, 54, 0.96)) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-reply strong,
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-rate strong { color: #38bdf8 !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-active-kpi {
          outline: 2px solid rgba(56, 189, 248, 0.88) !important;
          outline-offset: 2px !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-search-input-wrap {
          border-color: rgba(56, 189, 248, 0.24) !important;
          background: rgba(5, 20, 37, 0.72) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-pill {
          border-color: rgba(100, 116, 139, 0.26) !important;
          color: #a9b7c9 !important;
          background: rgba(30, 41, 59, 0.60) !important;
          box-shadow: none !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-pill:first-child.is-active,
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-pill.is-reply.is-active {
          border-color: rgba(56, 189, 248, 0.65) !important;
          color: #67d4fb !important;
          background: rgba(14, 116, 144, 0.18) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-live-item {
          border-color: rgba(71, 115, 151, 0.34) !important;
          background: rgba(12, 28, 48, 0.80) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-live-item.is-replied {
          border-color: rgba(56, 189, 248, 0.34) !important;
          background: linear-gradient(145deg, rgba(14, 44, 73, 0.78), rgba(10, 27, 47, 0.86)) !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-grid-5 { gap: 8px !important; }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-bar {
          gap: 7px !important;
          scrollbar-width: none !important;
          -webkit-overflow-scrolling: touch !important;
        }
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-bar::-webkit-scrollbar { display: none !important; }
      }
    `}</style>
  );
}
