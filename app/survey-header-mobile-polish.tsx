"use client";

export default function SurveyHeaderMobilePolish() {
  return (
    <style jsx global>{`
      @media (max-width: 760px) {
        .survey-drawer .survey-header {
          min-height: 76px !important;
          padding: 10px 14px !important;
          background: linear-gradient(180deg, #142238 0%, #111d31 100%) !important;
          border-bottom: 1px solid rgba(56, 189, 248, 0.16) !important;
          box-shadow: 0 8px 24px rgba(2, 8, 23, 0.12) !important;
        }

        .survey-drawer .survey-title-group {
          min-width: 0 !important;
          gap: 10px !important;
          align-items: center !important;
        }

        .survey-drawer .survey-logo {
          width: 38px !important;
          height: 38px !important;
          flex: 0 0 38px !important;
          border-radius: 11px !important;
          background: #0b1a2c !important;
          border: 1px solid rgba(56, 189, 248, 0.42) !important;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.07) !important;
          font-size: 21px !important;
        }

        .survey-drawer .survey-heading-copy {
          min-width: 0 !important;
          flex: 1 1 auto !important;
        }

        .survey-drawer .survey-heading-copy h2 {
          margin: 0 !important;
          font-size: 0 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .survey-drawer .survey-heading-copy h2::before {
          content: "Enquete Digital";
          display: inline-block;
          color: #f8fafc;
          font-size: 18px;
          line-height: 1.15;
          font-weight: 820;
          letter-spacing: -0.02em;
        }

        .survey-drawer .survey-heading-copy h2 > span {
          display: none !important;
        }

        .survey-drawer .survey-heading-copy p {
          margin: 4px 0 0 !important;
          min-width: 0 !important;
          font-size: 0 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        .survey-drawer .survey-heading-copy p::before {
          content: "Apuração e inteligência de respostas";
          display: inline-block;
          max-width: 100%;
          color: #91a3ba;
          font-size: 12px;
          line-height: 1.25;
          font-weight: 550;
          letter-spacing: 0.01em;
        }

        .survey-drawer .survey-close {
          width: 38px !important;
          height: 38px !important;
          flex: 0 0 38px !important;
          margin-left: 8px !important;
          border-radius: 11px !important;
          background: rgba(10, 24, 42, 0.78) !important;
          border: 1px solid rgba(148, 163, 184, 0.22) !important;
          color: #9eb0c6 !important;
          box-shadow: none !important;
          font-size: 17px !important;
        }

        .survey-drawer .survey-close:active {
          background: rgba(56, 189, 248, 0.09) !important;
          border-color: rgba(56, 189, 248, 0.35) !important;
          color: #e2f3ff !important;
        }
      }
    `}</style>
  );
}
