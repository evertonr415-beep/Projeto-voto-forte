import type { ReactNode } from "react";

export default function EnqueteArapongasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        /* Pós-voto: mantém o mesmo azul do banner até a confirmação. */
        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > header {
          background: #0e1d30 !important;
          box-shadow: none !important;
          border-bottom: 0 !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section {
          background: #0e1d30 !important;
          border-top: 0 !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section > div > div:first-child {
          width: 64px !important;
          height: 64px !important;
          margin-bottom: 12px !important;
          font-size: 34px !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section h1 {
          font-size: 24px !important;
          margin-bottom: 8px !important;
        }

        div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section p {
          font-size: 13px !important;
          line-height: 1.5 !important;
          color: #d7e0ea !important;
        }

        @media (max-width: 560px) {
          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section {
            padding-top: 22px !important;
            padding-bottom: 50px !important;
          }

          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section > div > div:first-child {
            width: 58px !important;
            height: 58px !important;
            font-size: 31px !important;
          }

          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section h1 {
            font-size: 22px !important;
          }

          div:has(> header > img[alt="Enquete Voto Forte Paraná"]) > section p {
            font-size: 12.5px !important;
          }
        }
      `}</style>
      {children}
    </>
  );
}
