"use client";

export default function WhatsappChatMobilePolish() {
  return (
    <style>{`
      @media (max-width: 760px) {
        /* A área Chat passa a parecer uma inbox mobile nativa, sem alterar funções. */
        body:has(.wa-container) .workspace > .page-head + div {
          gap: 5px !important;
          margin-bottom: 7px !important;
          padding-bottom: 2px !important;
        }

        body:has(.wa-container) .workspace > .page-head + div > button {
          min-height: 35px !important;
          padding: 6px 9px !important;
          border-radius: 10px !important;
        }

        body:has(.wa-container) .workspace > .page-head + div > button::after {
          font-size: 10.5px !important;
          letter-spacing: 0 !important;
        }

        body:has(.wa-container) .wa-container {
          height: calc(100dvh - 156px) !important;
          min-height: 520px !important;
          margin: 0 -8px !important;
          border: 1px solid rgba(148, 163, 184, 0.20) !important;
          border-radius: 14px 14px 0 0 !important;
          background: #f4f7f9 !important;
          box-shadow: 0 -2px 18px rgba(2, 8, 23, 0.12) !important;
        }

        body:has(.wa-container) .wa-sidebar {
          background: #f4f7f9 !important;
          border-right: 0 !important;
        }

        /* Cabeçalho oficial compacto. */
        body:has(.wa-container) .wa-sidebar-header {
          height: 46px !important;
          min-height: 46px !important;
          padding: 6px 11px !important;
          border-bottom: 0 !important;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
          box-shadow: inset 0 -1px 0 #e8edf1 !important;
        }

        body:has(.wa-container) .wa-profile-row {
          min-width: 0 !important;
          gap: 8px !important;
        }

        body:has(.wa-container) .wa-profile-avatar {
          width: 32px !important;
          height: 32px !important;
          flex: 0 0 32px !important;
          font-size: 12.5px !important;
          font-weight: 800 !important;
          box-shadow: 0 3px 8px rgba(0, 128, 105, 0.18) !important;
        }

        body:has(.wa-container) .wa-profile-title {
          min-width: 0 !important;
          gap: 5px !important;
          font-size: 13.5px !important;
          font-weight: 750 !important;
          letter-spacing: -0.01em !important;
        }

        body:has(.wa-container) .wa-profile-badge {
          padding: 2px 6px !important;
          border-radius: 999px !important;
          font-size: 7.5px !important;
          line-height: 1.35 !important;
          letter-spacing: 0.04em !important;
          box-shadow: none !important;
        }

        body:has(.wa-container) .wa-header-actions .wa-icon-btn {
          width: 30px !important;
          height: 30px !important;
          font-size: 15px !important;
        }

        /* Busca: lupa desenhada em CSS e campo integrado. */
        body:has(.wa-container) .wa-search-container {
          padding: 8px 10px 6px !important;
          border-bottom: 0 !important;
          background: #f8fafc !important;
        }

        body:has(.wa-container) .wa-search-box {
          min-height: 39px !important;
          gap: 9px !important;
          padding: 0 12px !important;
          border: 1px solid #dfe6eb !important;
          border-radius: 12px !important;
          background: #eef3f6 !important;
          box-shadow: inset 0 1px 1px rgba(15, 23, 42, 0.025) !important;
        }

        body:has(.wa-container) .wa-search-box:focus-within {
          border-color: rgba(0, 128, 105, 0.45) !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(0, 128, 105, 0.07) !important;
        }

        body:has(.wa-container) .wa-search-icon {
          position: relative !important;
          width: 15px !important;
          height: 15px !important;
          flex: 0 0 15px !important;
          display: block !important;
          font-size: 0 !important;
          color: transparent !important;
          border: 2px solid #637681 !important;
          border-radius: 50% !important;
          box-sizing: border-box !important;
          opacity: 0.9 !important;
        }

        body:has(.wa-container) .wa-search-icon::after {
          content: "" !important;
          position: absolute !important;
          width: 7px !important;
          height: 2px !important;
          right: -5px !important;
          bottom: -3px !important;
          border-radius: 2px !important;
          background: #637681 !important;
          transform: rotate(45deg) !important;
          transform-origin: left center !important;
        }

        body:has(.wa-container) .wa-search-input {
          height: 37px !important;
          padding: 0 !important;
          font-size: 12.5px !important;
          line-height: 37px !important;
          color: #1d2a31 !important;
        }

        body:has(.wa-container) .wa-search-input::placeholder {
          color: #788892 !important;
          opacity: 1 !important;
        }

        /* Filtros em chips menores e roláveis. */
        body:has(.wa-container) .wa-filter-chips {
          gap: 7px !important;
          padding: 5px 10px 8px !important;
          border-bottom: 1px solid #e8edf1 !important;
          background: #f8fafc !important;
          scrollbar-width: none !important;
          -webkit-overflow-scrolling: touch !important;
        }

        body:has(.wa-container) .wa-filter-chips::-webkit-scrollbar {
          display: none !important;
        }

        body:has(.wa-container) .wa-filter-chip {
          min-height: 31px !important;
          padding: 5px 11px !important;
          border: 1px solid #e0e6ea !important;
          border-radius: 999px !important;
          background: #ffffff !important;
          color: #5e707a !important;
          font-size: 10.5px !important;
          line-height: 1 !important;
          font-weight: 680 !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.025) !important;
        }

        body:has(.wa-container) .wa-filter-chip.active {
          border-color: rgba(0, 128, 105, 0.22) !important;
          background: #dff8e6 !important;
          color: #006b58 !important;
          font-weight: 800 !important;
          box-shadow: inset 0 0 0 1px rgba(0, 128, 105, 0.04) !important;
        }

        /* Lista com linhas-card compactas e melhor hierarquia. */
        body:has(.wa-container) .wa-conversation-list {
          padding: 5px 7px 18px !important;
          background: #f4f7f9 !important;
          scrollbar-width: none !important;
        }

        body:has(.wa-container) .wa-conversation-list::-webkit-scrollbar {
          display: none !important;
        }

        body:has(.wa-container) .wa-conversation-item {
          min-height: 70px !important;
          margin: 0 0 5px !important;
          padding: 9px 10px !important;
          box-sizing: border-box !important;
          border: 1px solid #e6ecef !important;
          border-radius: 12px !important;
          background: #ffffff !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035) !important;
        }

        body:has(.wa-container) .wa-conversation-item:active,
        body:has(.wa-container) .wa-conversation-item.is-active {
          border-color: rgba(0, 128, 105, 0.20) !important;
          background: #f1fbf7 !important;
        }

        body:has(.wa-container) .wa-conversation-item:has(.wa-conv-badge) {
          border-left: 3px solid #25d366 !important;
          padding-left: 8px !important;
        }

        body:has(.wa-container) .wa-conv-avatar {
          width: 42px !important;
          height: 42px !important;
          flex: 0 0 42px !important;
          margin-right: 10px !important;
          font-size: 15px !important;
          font-weight: 750 !important;
          box-shadow: 0 3px 9px rgba(0, 92, 75, 0.12) !important;
        }

        body:has(.wa-container) .wa-conv-details {
          min-width: 0 !important;
        }

        body:has(.wa-container) .wa-conv-top {
          min-width: 0 !important;
          gap: 8px !important;
          margin-bottom: 4px !important;
          align-items: center !important;
        }

        body:has(.wa-container) .wa-conv-name {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          max-width: none !important;
          font-size: 14px !important;
          line-height: 1.2 !important;
          font-weight: 750 !important;
          letter-spacing: -0.01em !important;
        }

        body:has(.wa-container) .wa-conv-time {
          flex: 0 0 auto !important;
          font-size: 10px !important;
          line-height: 1 !important;
          color: #87969f !important;
        }

        body:has(.wa-container) .wa-conv-bottom {
          min-width: 0 !important;
          gap: 6px !important;
        }

        body:has(.wa-container) .wa-conv-preview {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          gap: 4px !important;
          font-size: 11.5px !important;
          line-height: 1.25 !important;
          color: #687983 !important;
        }

        /* Respostas recebidas ganham um indicador discreto; disparos mantêm os checks. */
        body:has(.wa-container) .wa-conversation-item:not(:has(.wa-check-icon)) .wa-conv-preview::before {
          content: "↩" !important;
          flex: 0 0 auto !important;
          color: #00a884 !important;
          font-size: 11px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
        }

        body:has(.wa-container) .wa-check-icon {
          font-size: 11px !important;
        }

        body:has(.wa-container) .wa-conv-badge {
          min-width: 18px !important;
          height: 18px !important;
          padding: 0 5px !important;
          border-radius: 999px !important;
          font-size: 9px !important;
          line-height: 18px !important;
          box-shadow: 0 2px 5px rgba(37, 211, 102, 0.20) !important;
        }

        body:has(.wa-container) .wa-conv-district {
          margin-left: 5px !important;
          padding: 1px 5px !important;
          border-radius: 999px !important;
          font-size: 8px !important;
        }

        /* A conversa aberta segue a mesma densidade visual. */
        body:has(.wa-container) .wa-chat-header {
          height: 50px !important;
          min-height: 50px !important;
          padding: 6px 9px !important;
        }

        body:has(.wa-container) .wa-back-btn {
          min-width: 30px !important;
          padding: 4px 5px !important;
          font-size: 18px !important;
        }

        body:has(.wa-container) .wa-chat-header-user {
          gap: 7px !important;
        }

        body:has(.wa-container) .wa-chat-header-avatar {
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
          font-size: 13px !important;
        }

        body:has(.wa-container) .wa-chat-header-name {
          font-size: 13px !important;
        }

        body:has(.wa-container) .wa-chat-header-status {
          font-size: 9.5px !important;
        }

        body:has(.wa-container) .wa-messages-body {
          padding: 10px 9px !important;
          gap: 6px !important;
        }

        body:has(.wa-container) .wa-bubble {
          max-width: 88% !important;
          padding: 7px 9px 5px 10px !important;
          border-radius: 9px !important;
        }

        body:has(.wa-container) .wa-bubble-text {
          font-size: 12.5px !important;
          line-height: 1.38 !important;
        }

        body:has(.wa-container) .wa-date-divider {
          max-width: 86% !important;
          padding: 5px 8px !important;
          font-size: 8px !important;
          line-height: 1.35 !important;
          text-align: center !important;
        }

        body:has(.wa-container) .wa-quick-replies-bar {
          padding: 5px 8px !important;
          gap: 5px !important;
          scrollbar-width: none !important;
        }

        body:has(.wa-container) .wa-quick-replies-bar::-webkit-scrollbar {
          display: none !important;
        }

        body:has(.wa-container) .wa-quick-reply-chip {
          padding: 4px 8px !important;
          font-size: 9.5px !important;
        }

        body:has(.wa-container) .wa-chat-input-bar {
          min-height: 54px !important;
          padding: 6px 8px max(6px, env(safe-area-inset-bottom)) !important;
          gap: 7px !important;
        }

        body:has(.wa-container) .wa-input-wrapper {
          padding: 7px 10px !important;
          border-radius: 12px !important;
        }

        body:has(.wa-container) .wa-input-field {
          font-size: 13px !important;
          line-height: 18px !important;
        }

        body:has(.wa-container) .wa-send-btn {
          width: 38px !important;
          height: 38px !important;
          flex: 0 0 38px !important;
          font-size: 15px !important;
        }
      }

      @media (max-width: 390px) {
        body:has(.wa-container) .wa-profile-title {
          font-size: 13px !important;
        }

        body:has(.wa-container) .wa-profile-badge {
          font-size: 7px !important;
        }

        body:has(.wa-container) .wa-filter-chip {
          padding-inline: 10px !important;
          font-size: 10px !important;
        }

        body:has(.wa-container) .wa-conv-name {
          font-size: 13.5px !important;
        }

        body:has(.wa-container) .wa-conv-district {
          display: none !important;
        }
      }
    `}</style>
  );
}
