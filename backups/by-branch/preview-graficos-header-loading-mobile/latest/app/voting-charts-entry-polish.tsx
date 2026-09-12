"use client";

export default function VotingChartsEntryPolish() {
  return (
    <style>{`
      @media (max-width: 760px) {
        body:has(.voting-charts-container) .app-shell .main > .topbar .scope-picker,
        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-header-scope {
          display: none !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar[data-vf-mobile-compact-tab-header="true"] {
          min-height: 58px !important;
          height: auto !important;
          padding-bottom: 7px !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar[data-vf-mobile-compact-tab-header="true"] .page-id {
          min-width: 0 !important;
          grid-template-columns: 36px minmax(0, 1fr) !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-mobile-header-brand {
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: visible !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-mobile-header-title {
          display: block !important;
          min-width: 0 !important;
          max-width: none !important;
          white-space: nowrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
          -webkit-line-clamp: unset !important;
          font-size: clamp(11.5px, 3.05vw, 13.5px) !important;
          line-height: 1.1 !important;
          letter-spacing: -0.02em !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-mobile-header-logo {
          width: 25px !important;
          height: 25px !important;
          flex: 0 0 25px !important;
        }
      }

      .voting-charts-container:not(:has(.voting-last-update)) {
        position: relative !important;
        min-height: min(640px, calc(100dvh - 96px)) !important;
        overflow: hidden !important;
      }

      .voting-charts-container:not(:has(.voting-last-update)) > * {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .voting-charts-container:not(:has(.voting-last-update))::before {
        content: "Carregando apuração…\\AAtualizando votos e percentuais em tempo real";
        white-space: pre-line;
        position: absolute;
        z-index: 5;
        top: 20px;
        left: 20px;
        right: 20px;
        min-height: 148px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 58px 24px 24px;
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 18px;
        color: #e7f4ff;
        background:
          radial-gradient(circle at 50% 18%, rgba(56, 189, 248, 0.13), transparent 34%),
          linear-gradient(145deg, rgba(15, 30, 50, 0.98), rgba(10, 21, 37, 0.98));
        box-shadow: 0 14px 38px rgba(2, 8, 23, 0.28);
        font-size: 0.88rem;
        line-height: 1.55;
        font-weight: 700;
        text-align: center;
        visibility: visible !important;
      }

      .voting-charts-container:not(:has(.voting-last-update))::after {
        content: "";
        position: absolute;
        z-index: 6;
        top: 47px;
        left: 50%;
        width: 24px;
        height: 24px;
        margin-left: -12px;
        border: 3px solid rgba(56, 189, 248, 0.22);
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: vf-voting-entry-spin 0.8s linear infinite;
        visibility: visible !important;
      }

      @keyframes vf-voting-entry-spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 760px) {
        .voting-charts-container:not(:has(.voting-last-update)) {
          min-height: calc(100dvh - 76px) !important;
        }

        .voting-charts-container:not(:has(.voting-last-update))::before {
          top: 12px;
          left: 10px;
          right: 10px;
          min-height: 136px;
          padding: 54px 18px 20px;
          border-radius: 15px;
          font-size: 0.76rem;
          line-height: 1.45;
        }

        .voting-charts-container:not(:has(.voting-last-update))::after {
          top: 37px;
          width: 22px;
          height: 22px;
          margin-left: -11px;
        }
      }
    `}</style>
  );
}
