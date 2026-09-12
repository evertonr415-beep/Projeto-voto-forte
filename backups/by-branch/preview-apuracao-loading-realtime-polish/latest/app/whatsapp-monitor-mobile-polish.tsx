"use client";

export default function WhatsappMonitorMobilePolish() {
  return (
    <style>{`
      @media (max-width: 760px) {
        /*
         * WhatsApp > Monitor
         * Mantém toda a lógica original e harmoniza somente a apresentação mobile
         * com a identidade azul-marinho/ciano do VOTO FORTE.
         */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) {
          border: 1px solid rgba(56, 189, 248, 0.28) !important;
          background:
            radial-gradient(circle at 96% 0%, rgba(14, 165, 233, 0.08), transparent 30%),
            linear-gradient(145deg, rgba(10, 25, 44, 0.98), rgba(13, 29, 50, 0.96)) !important;
          box-shadow: 0 16px 38px rgba(2, 8, 23, 0.26) !important;
        }

        /* Cabeçalho e ações: mesma linguagem dos demais painéis. */
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

        /* KPIs com uma base visual única. A cor passa a ter significado, não decoração. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card {
          min-height: 82px !important;
          border: 1px solid rgba(71, 115, 151, 0.46) !important;
          border-radius: 13px !important;
          background:
            linear-gradient(145deg, rgba(20, 45, 72, 0.88), rgba(13, 30, 51, 0.94)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 7px 18px rgba(2, 8, 23, 0.14) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card strong {
          color: #38bdf8 !important;
          text-shadow: 0 0 18px rgba(56, 189, 248, 0.10) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card span {
          color: #9fb0c5 !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-primary {
          border-color: rgba(56, 189, 248, 0.38) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-success {
          border-color: rgba(52, 211, 153, 0.31) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-success strong {
          color: #34d399 !important;
          text-shadow: 0 0 18px rgba(52, 211, 153, 0.10) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-error {
          border-color: rgba(248, 113, 113, 0.31) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-error strong {
          color: #f87171 !important;
          text-shadow: 0 0 18px rgba(248, 113, 113, 0.10) !important;
        }

        /* Respostas deixa de usar roxo: volta à família azul/ciano do sistema. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-reply {
          border-color: rgba(56, 189, 248, 0.34) !important;
          background:
            linear-gradient(145deg, rgba(17, 46, 75, 0.90), rgba(12, 31, 54, 0.96)) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-reply strong {
          color: #4cc9f5 !important;
        }

        /* Taxa de resposta abandona o amarelo e funciona como KPI consolidado. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-rate {
          border-color: rgba(56, 189, 248, 0.42) !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.09), transparent 56%),
            linear-gradient(145deg, rgba(20, 48, 78, 0.92), rgba(11, 31, 55, 0.96)) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-rate strong {
          color: #38bdf8 !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-rate span {
          color: #8edcff !important;
        }

        /* Estado ativo sem glow exagerado. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-active-kpi {
          outline: 2px solid rgba(56, 189, 248, 0.88) !important;
          outline-offset: 2px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 0 0 4px rgba(56, 189, 248, 0.07) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-success.is-active-kpi {
          outline-color: rgba(52, 211, 153, 0.80) !important;
          box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.06) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-card.is-error.is-active-kpi {
          outline-color: rgba(248, 113, 113, 0.80) !important;
          box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.06) !important;
        }

        /* Busca mais integrada ao painel. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-search-input-wrap {
          border-color: rgba(56, 189, 248, 0.24) !important;
          background: rgba(5, 20, 37, 0.72) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.02) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-search-input-wrap:focus-within {
          border-color: rgba(56, 189, 248, 0.55) !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.07) !important;
        }

        /* Filtros: ciano = geral/resposta, verde = sucesso, vermelho = erro. */
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

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-pill:nth-child(2).is-active {
          border-color: rgba(52, 211, 153, 0.56) !important;
          color: #4adea6 !important;
          background: rgba(16, 185, 129, 0.13) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-pill.is-error {
          color: #d5a1a1 !important;
          background: rgba(127, 29, 29, 0.08) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-pill.is-error.is-active {
          border-color: rgba(248, 113, 113, 0.56) !important;
          color: #fb8d8d !important;
          background: rgba(185, 28, 28, 0.13) !important;
        }

        /* Feed: resposta recebida perde o bloco roxo e adota azul/ciano. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-live-item {
          border-color: rgba(71, 115, 151, 0.34) !important;
          background: rgba(12, 28, 48, 0.80) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-live-item.is-replied {
          border-color: rgba(56, 189, 248, 0.34) !important;
          background:
            linear-gradient(145deg, rgba(14, 44, 73, 0.78), rgba(10, 27, 47, 0.86)) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-status-badge.badge-replied {
          border-color: rgba(56, 189, 248, 0.42) !important;
          color: #77d9fb !important;
          background: rgba(14, 116, 144, 0.16) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-reply-detail {
          border-left: 3px solid #38bdf8 !important;
          background: rgba(14, 116, 144, 0.13) !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-reply-detail strong,
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-reply-detail span {
          color: #9be4ff !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-live-item.is-replied > div:last-child span:last-child {
          color: #5ecdf5 !important;
        }

        /* Densidade mobile um pouco mais calma, sem alterar conteúdo. */
        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) {
          padding: 14px !important;
          border-radius: 14px !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-kpi-grid-5 {
          gap: 8px !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-bar {
          gap: 7px !important;
          scrollbar-width: none !important;
          -webkit-overflow-scrolling: touch !important;
        }

        body:has(.wt-kpi-grid-5) article.panel:has(.wt-kpi-grid-5) .wt-filter-bar::-webkit-scrollbar {
          display: none !important;
        }
      }
    `}</style>
  );
}
