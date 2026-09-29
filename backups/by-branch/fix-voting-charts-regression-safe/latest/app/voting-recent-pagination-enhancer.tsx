"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type SurveyFeedItem = {
  phone: string;
  contactName: string;
  district: string;
  city: string;
  messageText: string;
  stateCandidate: string;
  federalCandidate: string;
  sentiment: "declarado" | "indeciso" | "apoio" | "critica" | "neutro";
  timestamp: string;
};

const PAGE_SIZE = 10;

function pageWindow(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export default function VotingRecentPaginationEnhancer() {
  const [section, setSection] = useState<HTMLElement | null>(null);
  const [district, setDistrict] = useState("all");
  const [responses, setResponses] = useState<SurveyFeedItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(14642);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let disposed = false;

    const discover = () => {
      if (disposed) return;
      const nextSection = document.querySelector<HTMLElement>(".voting-recent-feed");
      setSection((current) => (current === nextSection ? current : nextSection));

      const selector = document.querySelector<HTMLSelectElement>(
        ".voting-charts-container .district-selector-wrap select",
      );
      const nextDistrict = selector?.value || "all";
      setDistrict((current) => (current === nextDistrict ? current : nextDistrict));
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (!target.matches(".voting-charts-container .district-selector-wrap select")) return;
      setDistrict(target.value || "all");
      setPage(1);
    };

    discover();
    const observer = new MutationObserver(discover);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", onChange);

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!section) return;
    section.classList.add("vf-recent-pagination-ready");
    return () => section.classList.remove("vf-recent-pagination-ready");
  }, [section]);

  const loadResponses = useCallback(async () => {
    if (!section) return;
    setLoading(true);
    try {
      const response = await apiFetch(
        `/api/whatsapp/survey?district=${encodeURIComponent(district)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (response.ok && data?.success) {
        setResponses(Array.isArray(data.responses) ? data.responses : []);
        if (data.totalResponses) {
          setTotalCount(Number(data.totalResponses));
        }
      }
    } catch {
      // Mantém a última lista válida em caso de falha temporária.
    } finally {
      setLoading(false);
    }
  }, [district, section]);

  useEffect(() => {
    if (!section) return;
    void loadResponses();
    const interval = window.setInterval(() => void loadResponses(), 15000);
    return () => window.clearInterval(interval);
  }, [loadResponses, section]);

  useEffect(() => {
    setPage(1);
  }, [district]);

  const totalPages = Math.max(1, Math.ceil(responses.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const visibleResponses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return responses.slice(start, start + PAGE_SIZE);
  }, [page, responses]);

  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);
  const header = section?.querySelector<HTMLElement>(".voting-chart-header") || null;

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setPage(safePage);
    window.requestAnimationFrame(() => {
      section?.querySelector<HTMLElement>(".voting-chart-header")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <>
      <style>{`
        .voting-recent-feed.vf-recent-pagination-ready > .voting-feed-desktop,
        .voting-recent-feed.vf-recent-pagination-ready > .voting-feed-mobile {
          display: none !important;
        }
        .voting-recent-feed.vf-recent-pagination-ready > .voting-chart-header > .voting-total-badge:not(.vf-pagination-total-badge) {
          display: none !important;
        }
        .vf-voting-paginated-content {
          min-width: 0;
        }
        .vf-voting-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          flex-wrap: wrap;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }
        .vf-voting-pagination button {
          min-width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 9px;
          color: #cbd5e1;
          background: rgba(30, 41, 59, 0.62);
          font: inherit;
          font-size: 0.78rem;
          font-weight: 760;
          cursor: pointer;
          transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease;
        }
        .vf-voting-pagination button:hover:not(:disabled) {
          color: #fff;
          border-color: rgba(56, 189, 248, 0.42);
          background: rgba(14, 116, 144, 0.24);
          transform: translateY(-1px);
        }
        .vf-voting-pagination button.is-active {
          color: #fff;
          border-color: rgba(56, 189, 248, 0.55);
          background: linear-gradient(135deg, #0786c9, #2767df);
          box-shadow: 0 4px 13px rgba(2, 132, 199, 0.2);
        }
        .vf-voting-pagination button:disabled {
          opacity: .35;
          cursor: not-allowed;
        }
        .vf-voting-pagination-gap {
          color: #64748b;
          font-size: .8rem;
          padding: 0 1px;
        }
        .vf-voting-pagination-info {
          margin-left: 5px;
          color: #8190a5;
          font-size: .7rem;
          font-weight: 650;
          white-space: nowrap;
        }
        .vf-pagination-total-badge {
          color: #b7c5d8 !important;
        }
        @media (max-width: 760px) {
          .vf-voting-paginated-content .voting-feed-mobile {
            display: flex !important;
            flex-direction: column;
            gap: 6px;
          }
          .vf-voting-paginated-content .voting-feed-desktop {
            display: none !important;
          }
          .vf-voting-pagination {
            gap: 5px;
            margin-top: 10px;
            padding-top: 10px;
          }
          .vf-voting-pagination button {
            min-width: 32px;
            height: 32px;
            padding: 0 8px;
            border-radius: 8px;
            font-size: .7rem;
          }
          .vf-voting-pagination-info {
            width: 100%;
            margin: 2px 0 0;
            text-align: center;
            white-space: normal;
          }
        }
        @media (min-width: 761px) {
          .vf-voting-paginated-content .voting-feed-desktop {
            display: block !important;
          }
          .vf-voting-paginated-content .voting-feed-mobile {
            display: none !important;
          }
        }
      `}</style>

      {header &&
        createPortal(
          <span className="voting-total-badge vf-pagination-total-badge">
            {totalCount.toLocaleString("pt-BR")} participações
          </span>,
          header,
        )}

      {section &&
        createPortal(
          <div className="vf-voting-paginated-content">
            <div className="voting-feed-desktop">
              <table className="voting-feed-table">
                <thead>
                  <tr>
                    <th>Nome / Telefone</th>
                    <th>Bairro</th>
                    <th>Dep. Estadual</th>
                    <th>Dep. Federal</th>
                    <th>Sentimento</th>
                    <th>Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResponses.map((response, index) => (
                    <tr key={`${response.phone}-${response.timestamp}-${index}`}>
                      <td>
                        <strong>{response.contactName || "Eleitor"}</strong>
                        <div className="voting-phone">{response.phone}</div>
                      </td>
                      <td>{response.district || "Arapongas"}</td>
                      <td>
                        <span className="voting-state-choice">{response.stateCandidate || "Não declarado"}</span>
                      </td>
                      <td>
                        <span className="voting-federal-choice">{response.federalCandidate || "Não declarado"}</span>
                      </td>
                      <td>
                        <span className={`sentiment-badge sentiment-${response.sentiment}`}>{response.sentiment}</span>
                      </td>
                      <td className="voting-date-cell">{formatDate(response.timestamp)}</td>
                    </tr>
                  ))}
                  {!loading && responses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="voting-empty-table">
                        Nenhuma resposta registrada ainda no filtro selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="voting-feed-mobile">
              {visibleResponses.map((response, index) => (
                <article className="voting-feed-mobile-card" key={`mobile-${response.phone}-${response.timestamp}-${index}`}>
                  <div className="voting-feed-mobile-head">
                    <div>
                      <strong>{response.contactName || "Eleitor"}</strong>
                      <span>{response.district || "Arapongas"}</span>
                    </div>
                    <span className={`sentiment-badge sentiment-${response.sentiment}`}>{response.sentiment}</span>
                  </div>
                  <div className="voting-feed-mobile-votes">
                    <span><small>Estadual</small>{response.stateCandidate || "Não declarado"}</span>
                    <span><small>Federal</small>{response.federalCandidate || "Não declarado"}</span>
                  </div>
                  <div className="voting-feed-mobile-foot">
                    <span>{response.phone}</span>
                    <span>{formatDate(response.timestamp)}</span>
                  </div>
                </article>
              ))}
              {!loading && responses.length === 0 && (
                <div className="voting-empty-mobile">Nenhuma resposta registrada ainda no filtro selecionado.</div>
              )}
            </div>

            {responses.length > PAGE_SIZE && (
              <nav className="vf-voting-pagination" aria-label="Paginação das participações">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Página anterior"
                  title="Página anterior"
                >
                  ‹
                </button>

                {pages.map((pageNumber, index) => {
                  const previous = pages[index - 1];
                  return (
                    <span key={pageNumber} style={{ display: "contents" }}>
                      {previous && pageNumber - previous > 1 && <span className="vf-voting-pagination-gap">…</span>}
                      <button
                        type="button"
                        className={pageNumber === page ? "is-active" : ""}
                        onClick={() => goToPage(pageNumber)}
                        aria-current={pageNumber === page ? "page" : undefined}
                        aria-label={`Ir para a página ${pageNumber}`}
                      >
                        {pageNumber}
                      </button>
                    </span>
                  );
                })}

                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Próxima página"
                  title="Próxima página"
                >
                  ›
                </button>

                <span className="vf-voting-pagination-info">
                  Página {page} de {totalPages} · 10 votos por página
                </span>
              </nav>
            )}
          </div>,
          section,
        )}
    </>
  );
}
