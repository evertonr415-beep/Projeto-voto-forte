"use client";

export default function WhaticketBroadcastMobilePolish() {
  return (
    <style jsx global>{`
      @media (max-width: 760px) {
        .wt-drawer {
          --wt-mobile-cyan: #38bdf8;
          --wt-mobile-green: #2ddc86;
          --wt-mobile-field: #0d1a2d;
          --wt-mobile-border: rgba(148, 163, 184, 0.22);
          background: #081321 !important;
        }

        .wt-drawer .wt-drawer-header {
          min-height: 82px !important;
          padding: 12px 16px !important;
          background: #17243a !important;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16) !important;
        }

        .wt-drawer .wt-header-logo {
          width: 38px !important;
          height: 38px !important;
          flex: 0 0 38px !important;
          border-radius: 10px !important;
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.2) !important;
        }

        .wt-drawer .wt-drawer-title-group { gap: 11px !important; }

        .wt-drawer .wt-close-btn {
          width: 38px !important;
          height: 38px !important;
          border-radius: 11px !important;
          background: rgba(15, 28, 47, 0.78) !important;
          border-color: rgba(148, 163, 184, 0.22) !important;
        }

        .wt-drawer nav:has(.wt-tab-btn) {
          position: sticky !important;
          top: 0 !important;
          z-index: 8 !important;
          min-height: 54px !important;
          padding: 0 8px !important;
          background: rgba(8, 19, 33, 0.97) !important;
          border-bottom: 1px solid rgba(56, 189, 248, 0.15) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
        }

        .wt-drawer .wt-tab-btn {
          min-height: 52px !important;
          padding: 0 12px !important;
          color: #91a1b8 !important;
          background: transparent !important;
          border-color: transparent !important;
          font-weight: 750 !important;
          box-shadow: none !important;
        }

        .wt-drawer .wt-tab-btn.is-active {
          color: var(--wt-mobile-cyan) !important;
          background: rgba(56, 189, 248, 0.06) !important;
          border-bottom-color: var(--wt-mobile-cyan) !important;
          box-shadow: inset 0 -3px 0 var(--wt-mobile-cyan) !important;
        }

        .wt-drawer .wt-drawer-body {
          padding: 14px 12px 24px !important;
          gap: 12px !important;
          background: #081321 !important;
        }

        .wt-drawer .wt-card {
          margin: 0 0 12px !important;
          padding: 14px !important;
          border-radius: 16px !important;
          background: linear-gradient(180deg, rgba(25, 39, 62, 0.98), rgba(21, 34, 54, 0.98)) !important;
          border: 1px solid var(--wt-mobile-border) !important;
          box-shadow: 0 8px 24px rgba(1, 8, 18, 0.16) !important;
        }

        .wt-drawer .wt-card-title {
          margin-bottom: 13px !important;
          color: var(--wt-mobile-cyan) !important;
          font-size: 16px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          letter-spacing: -0.01em !important;
        }

        .wt-drawer .wt-form-group {
          margin-bottom: 11px !important;
          gap: 6px !important;
        }

        .wt-drawer .wt-form-group label {
          margin-bottom: 0 !important;
          color: #9bacbf !important;
          font-size: 11px !important;
          line-height: 1.15 !important;
          font-weight: 800 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
        }

        .wt-drawer .wt-select,
        .wt-drawer .wt-form-group input:not([type="range"]),
        .wt-drawer .wt-form-group textarea {
          min-height: 44px !important;
          padding: 8px 11px !important;
          border-radius: 11px !important;
          background: var(--wt-mobile-field) !important;
          border: 1px solid rgba(95, 120, 151, 0.38) !important;
          color: #f4f7fb !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.015) !important;
        }

        .wt-drawer .wt-select:focus,
        .wt-drawer .wt-form-group input:not([type="range"]):focus,
        .wt-drawer .wt-form-group textarea:focus {
          border-color: rgba(56, 189, 248, 0.65) !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.09) !important;
          outline: none !important;
        }

        .wt-drawer .wt-preview-box {
          margin-top: 10px !important;
          padding: 14px !important;
          border-radius: 14px !important;
          background: #07151f !important;
          border: 1px solid rgba(56, 189, 248, 0.13) !important;
          box-shadow: none !important;
          line-height: 1.5 !important;
        }

        .wt-drawer .wt-preview-box > div {
          font-size: 13px !important;
          line-height: 1.55 !important;
          color: #edf4fb !important;
        }

        .wt-drawer .wt-preview-box small {
          display: inline-flex !important;
          width: fit-content !important;
          margin-top: 10px !important;
          padding: 4px 8px !important;
          border-radius: 999px !important;
          background: rgba(45, 220, 134, 0.1) !important;
          border: 1px solid rgba(45, 220, 134, 0.22) !important;
          color: var(--wt-mobile-green) !important;
          font-size: 10px !important;
          line-height: 1.2 !important;
          letter-spacing: 0.035em !important;
        }

        .wt-drawer .wt-secondary-btn {
          min-height: 42px !important;
          padding: 9px 12px !important;
          border-radius: 11px !important;
          background: #132138 !important;
          border-color: rgba(56, 189, 248, 0.22) !important;
          color: #cbd8e8 !important;
          box-shadow: none !important;
        }

        .wt-drawer .wt-form-group input[type="range"] {
          margin: 6px 0 2px !important;
          accent-color: var(--wt-mobile-cyan) !important;
        }

        .wt-drawer .wt-primary-btn {
          min-height: 52px !important;
          margin-top: 6px !important;
          border-radius: 14px !important;
          background: linear-gradient(135deg, #2ddc86, #27ce79) !important;
          border: 1px solid rgba(83, 236, 160, 0.56) !important;
          color: #062218 !important;
          font-weight: 850 !important;
          box-shadow: 0 10px 22px rgba(45, 220, 134, 0.14) !important;
        }

        .wt-drawer .wt-primary-btn:disabled {
          opacity: 0.55 !important;
          box-shadow: none !important;
        }

        .wt-drawer .wt-card:first-child small {
          color: var(--wt-mobile-green) !important;
        }
      }
    `}</style>
  );
}
