export default function InstitutionalMobilePolish() {
  return (
    <style>{`
      @media (max-width: 768px) {
        .ae-root {
          height: auto !important;
          min-height: 100dvh !important;
          overflow: visible !important;
        }

        .ae-shell {
          height: auto !important;
          overflow: visible !important;
          gap: 12px !important;
          padding: 8px 8px calc(96px + env(safe-area-inset-bottom)) !important;
        }

        .ae-topbar {
          position: relative !important;
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 10px !important;
          padding: 12px !important;
          border-radius: 14px !important;
        }

        .ae-brand {
          width: 100% !important;
          min-width: 0 !important;
          flex: 0 0 auto !important;
          gap: 10px !important;
          align-items: center !important;
        }

        .ae-logo {
          width: 42px !important;
          height: 42px !important;
          border-radius: 11px !important;
        }

        .ae-title {
          font-size: 1.02rem !important;
          line-height: 1.2 !important;
          letter-spacing: -0.015em !important;
        }

        .ae-subtitle {
          margin-top: 3px !important;
          font-size: 0.74rem !important;
          line-height: 1.35 !important;
          display: -webkit-box !important;
          -webkit-line-clamp: 2 !important;
          -webkit-box-orient: vertical !important;
          overflow: hidden !important;
        }

        .ae-toolbar {
          width: 100% !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          gap: 8px !important;
          align-items: stretch !important;
        }

        .ae-view-switcher {
          grid-column: 1 / -1 !important;
          width: 100% !important;
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          padding: 3px !important;
          gap: 3px !important;
        }

        .ae-view-btn {
          min-width: 0 !important;
          min-height: 42px !important;
          justify-content: center !important;
          padding: 8px 5px !important;
          font-size: 0.74rem !important;
          line-height: 1.15 !important;
          text-align: center !important;
          white-space: normal !important;
        }

        .ae-view-btn span {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .ae-toolbar > .ae-btn-primary {
          display: none !important;
        }

        .ae-dropdown-wrap {
          width: 100% !important;
          min-width: 0 !important;
        }

        .ae-dropdown-wrap > .ae-btn,
        .ae-toolbar > .ae-btn-ghost {
          width: 100% !important;
          min-height: 42px !important;
          justify-content: center !important;
          padding: 9px 10px !important;
        }

        .ae-dropdown-menu {
          left: 0 !important;
          right: auto !important;
          width: min(260px, calc(100vw - 32px)) !important;
          max-height: min(440px, 70dvh) !important;
          overflow-y: auto !important;
        }

        .ae-hero-banner {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          padding: 12px !important;
          border-radius: 14px !important;
        }

        .ae-hero-countdown {
          gap: 5px !important;
          padding: 0 0 10px !important;
          border-right: none !important;
          border-bottom: 1px solid var(--ae-line) !important;
        }

        .ae-hero-badge {
          font-size: 0.66rem !important;
          padding: 3px 8px !important;
        }

        .ae-hero-target {
          font-size: 0.78rem !important;
        }

        .ae-countdown-boxes {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 6px !important;
          width: 100% !important;
        }

        .ae-cbox-sep {
          display: none !important;
        }

        .ae-cbox {
          min-width: 0 !important;
          padding: 6px 4px !important;
        }

        .ae-cbox strong {
          font-size: 1rem !important;
        }

        .ae-cbox small {
          font-size: 0.56rem !important;
        }

        .ae-hero-metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 6px !important;
        }

        .ae-hstat {
          min-width: 0 !important;
          padding: 8px 9px !important;
          border-radius: 10px !important;
        }

        .ae-hstat-label {
          font-size: 0.62rem !important;
        }

        .ae-hstat-val {
          font-size: 1.08rem !important;
        }

        .ae-hstat-sub {
          display: none !important;
        }

        .ae-mobile-tabs {
          margin: 0 !important;
          padding: 2px !important;
          gap: 2px !important;
          border-radius: 10px !important;
        }

        .ae-mobile-tab {
          min-height: 38px !important;
          padding: 7px 4px !important;
          font-size: 0.72rem !important;
          gap: 4px !important;
        }

        .ae-layout,
        .ae-grid,
        .ae-sidebar-panel {
          gap: 12px !important;
        }

        .ae-card {
          border-radius: 14px !important;
        }

        .ae-card-head {
          padding: 13px 14px !important;
          gap: 8px !important;
        }

        .ae-card-head h2,
        .ae-card-head h3 {
          font-size: 1rem !important;
        }

        .ae-card-body {
          padding: 12px !important;
        }

        .ae-controls {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
          margin-bottom: 10px !important;
        }

        .ae-searchwrap {
          grid-column: 1 / -1 !important;
          min-width: 0 !important;
          min-height: 44px !important;
          flex: none !important;
        }

        .ae-search,
        .ae-controls .ae-select {
          min-width: 0 !important;
          min-height: 44px !important;
          height: 44px !important;
          flex: none !important;
          font-size: 0.82rem !important;
        }

        .ae-controls .ae-select {
          width: 100% !important;
          padding: 0 10px !important;
        }

        .ae-search {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }

        .ae-pills-bar {
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          overscroll-behavior-inline: contain !important;
          -webkit-overflow-scrolling: touch !important;
          gap: 7px !important;
          margin: 0 -2px 12px !important;
          padding: 0 2px 4px !important;
          scrollbar-width: none !important;
        }

        .ae-pills-bar::-webkit-scrollbar {
          display: none !important;
        }

        .ae-pill {
          flex: 0 0 auto !important;
          min-height: 38px !important;
          padding: 7px 11px !important;
          font-size: 0.76rem !important;
        }

        .ae-timeline-list {
          gap: 8px !important;
        }

        .ae-timeline-item {
          display: grid !important;
          grid-template-columns: 50px minmax(0, 1fr) !important;
          align-items: start !important;
          gap: 10px !important;
          padding: 11px !important;
          border-radius: 12px !important;
        }

        .ae-date-block {
          width: 50px !important;
          height: 52px !important;
        }

        .ae-event-content {
          min-width: 0 !important;
          width: 100% !important;
        }

        .ae-event-top {
          gap: 5px !important;
        }

        .ae-cat-badge {
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 0.66rem !important;
        }

        .ae-event-title {
          font-size: 0.96rem !important;
          line-height: 1.25 !important;
        }

        .ae-event-desc {
          font-size: 0.78rem !important;
          -webkit-line-clamp: 2 !important;
        }

        .ae-event-meta {
          gap: 7px !important;
          margin-top: 5px !important;
        }

        .ae-meta-item {
          font-size: 0.7rem !important;
        }

        .ae-event-actions {
          grid-column: 2 !important;
          width: 100% !important;
          justify-content: flex-start !important;
        }

        .ae-event-actions .ae-mini-btn {
          min-height: 36px !important;
          padding: 7px 10px !important;
        }

        .ae-inspector-grid,
        .ae-inspector-actions,
        .ae-form-grid {
          grid-template-columns: 1fr !important;
        }

        .ae-form-grid .full,
        .ae-inspector-actions .ae-btn-primary {
          grid-column: auto !important;
        }

        .ae-field,
        .ae-select,
        .ae-search {
          min-height: 44px !important;
        }

        .ae-month-grid {
          gap: 4px !important;
        }

        .ae-dow,
        .ae-day {
          min-width: 0 !important;
          padding: 4px !important;
          border-radius: 7px !important;
        }

        .ae-day {
          min-height: 44px !important;
        }

        .ae-month-grid .ae-day .ae-badge {
          width: 7px !important;
          min-width: 7px !important;
          height: 7px !important;
          min-height: 7px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          font-size: 0 !important;
          overflow: hidden !important;
        }

        .ae-cal-head,
        .ae-cal-head > div:first-child {
          flex-wrap: wrap !important;
          gap: 8px !important;
        }

        .ae-kanban-board,
        .ae-kanban-column {
          min-width: 0 !important;
        }

        .ae-fab-btn {
          width: 54px !important;
          height: 54px !important;
          right: 16px !important;
          bottom: calc(18px + env(safe-area-inset-bottom)) !important;
        }

        .ae-modal-card {
          max-height: calc(88dvh - env(safe-area-inset-bottom)) !important;
        }
      }

      @media (max-width: 420px) {
        .ae-shell {
          padding-left: 6px !important;
          padding-right: 6px !important;
        }

        .ae-title {
          font-size: 0.96rem !important;
        }

        .ae-view-btn {
          font-size: 0.69rem !important;
        }

        .ae-toolbar > .ae-btn-ghost span,
        .ae-dropdown-wrap > .ae-btn span {
          font-size: 0.76rem !important;
        }

        .ae-card-head {
          padding: 12px !important;
        }

        .ae-card-body {
          padding: 10px !important;
        }
      }
    `}</style>
  );
}
