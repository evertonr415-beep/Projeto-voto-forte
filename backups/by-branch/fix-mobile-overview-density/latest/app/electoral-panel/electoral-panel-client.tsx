"use client";

import React, { useMemo, useState } from "react";
import {
  VERIFIED_ARAPONGAS_ELECTIONS,
  type VerifiedCandidate,
} from "./verified-electoral-data";
import "./electoral-panel.css";
import "./electoral-panel-mobile-official.css";

type SortOption = "votes_desc" | "votes_asc" | "name_asc" | "number_asc";
type StatusFilter = "all" | "elected";

function ballotNumberValue(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function statusLabel(candidate: VerifiedCandidate) {
  return candidate.situation || (candidate.elected ? "Eleito" : "Não eleito");
}

export default function ElectoralPanelClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
} = {}) {
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedOffice, setSelectedOffice] = useState<string>("prefeito");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("votes_desc");

  const handleBack = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
      return;
    }

    window.dispatchEvent(new CustomEvent("voto-forte:navigate-overview"));
    if (
      typeof window !== "undefined" &&
      window.location.pathname.includes("painel-eleitoral")
    ) {
      window.location.href = "/";
    }
  };

  const currentElection = useMemo(
    () =>
      VERIFIED_ARAPONGAS_ELECTIONS.find((election) => election.year === selectedYear) ||
      VERIFIED_ARAPONGAS_ELECTIONS[0],
    [selectedYear],
  );

  const availableOffices = useMemo(
    () => currentElection?.offices || [],
    [currentElection],
  );

  React.useEffect(() => {
    if (!availableOffices.length) return;
    if (!availableOffices.some((office) => office.office === selectedOffice)) {
      setSelectedOffice(availableOffices[0].office);
    }
  }, [availableOffices, selectedOffice]);

  const activeOffice = useMemo(
    () =>
      availableOffices.find((office) => office.office === selectedOffice) ||
      availableOffices[0] ||
      null,
    [availableOffices, selectedOffice],
  );

  const filteredCandidates = useMemo(() => {
    if (!activeOffice) return [];

    const query = searchQuery.trim().toLocaleLowerCase("pt-BR");
    const list = activeOffice.candidates.filter((candidate) => {
      if (statusFilter === "elected" && !candidate.elected) return false;
      if (!query) return true;

      return (
        candidate.name.toLocaleLowerCase("pt-BR").includes(query) ||
        candidate.party.toLocaleLowerCase("pt-BR").includes(query) ||
        String(candidate.ballotNumber).includes(query) ||
        statusLabel(candidate).toLocaleLowerCase("pt-BR").includes(query)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === "votes_desc") return b.votes - a.votes;
      if (sortBy === "votes_asc") return a.votes - b.votes;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name, "pt-BR");
      if (sortBy === "number_asc") {
        return ballotNumberValue(a.ballotNumber) - ballotNumberValue(b.ballotNumber);
      }
      return 0;
    });
  }, [activeOffice, searchQuery, sortBy, statusFilter]);

  const topLeaders = useMemo(() => {
    if (!activeOffice) return [];
    return [...activeOffice.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3);
  }, [activeOffice]);

  const blankNullVotes = activeOffice
    ? activeOffice.blankNullVotes ??
      (activeOffice.blankVotes || 0) + (activeOffice.nullVotes || 0)
    : 0;

  const totalVotesCast = activeOffice
    ? activeOffice.totalValidVotes + blankNullVotes
    : 0;

  const turnoutRate =
    activeOffice && activeOffice.totalElectorate > 0
      ? ((totalVotesCast / activeOffice.totalElectorate) * 100).toFixed(1)
      : "0";

  const exportCsv = () => {
    if (!activeOffice) return;

    const header =
      "Posição,Candidato,Número,Partido,Votos,Percentual (%),Situação,Fonte\n";
    const rows = filteredCandidates
      .map(
        (candidate, index) =>
          `"${index + 1}","${candidate.name}","${candidate.ballotNumber}","${candidate.party}","${candidate.votes}","${candidate.percentage}%","${statusLabel(candidate)}","${activeOffice.sourceLabel}"`,
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tse-arapongas-${selectedYear}-${selectedOffice}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <div className="tse-panel-root">
      <div className="tse-panel-shell">
        <header className="tse-panel-topbar">
          <div className="tse-panel-brand">
            <div className="tse-panel-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/voto-forte-bandeira-icon.jpg"
                alt="Paraná"
                className="tse-panel-logo-img"
              />
            </div>
            <div className="tse-panel-heading-copy">
              <h1 className="tse-panel-title">
                <span>Painel Eleitoral — Arapongas / PR</span>
                <span className="tse-panel-badge">TSE</span>
              </h1>
              <div className="tse-panel-subtitle">
                Resultados eleitorais conferidos para Arapongas. Sem projeção de votos por
                bairro, colégio ou seção.
              </div>
            </div>
          </div>

          <div className="tse-panel-actions">
            <button type="button" className="tse-btn" onClick={exportCsv}>
              ⬇️ Exportar CSV
            </button>
            <button type="button" className="tse-btn" onClick={() => window.print()}>
              🖨️ Imprimir
            </button>
            <button
              type="button"
              className="vf-back-dashboard-btn"
              onClick={handleBack}
              title="Voltar ao Dashboard Principal"
            >
              <span className="vf-back-arrow" aria-hidden="true">
                ←
              </span>
              <span>Voltar ao Sistema</span>
            </button>
          </div>
        </header>

        <section className="tse-panel-integrity-note" aria-label="Integridade dos dados">
          <strong>Dados sem estimativa.</strong>
          <span>
            O painel exibe somente resultados inseridos na base verificada. Filtros que
            simulavam votação por local foram removidos.
          </span>
        </section>

        <section className="tse-filters-bar">
          <div className="tse-years-nav">
            <span className="tse-select-label">Ano eleitoral:</span>
            {VERIFIED_ARAPONGAS_ELECTIONS.map((election) => (
              <button
                key={election.year}
                type="button"
                className={`tse-year-btn ${selectedYear === election.year ? "active" : ""}`}
                onClick={() => setSelectedYear(election.year)}
              >
                🗳️ {election.year} {election.type === "geral" ? "(Gerais)" : "(Municipais)"}
              </button>
            ))}
          </div>

          <div className="tse-offices-nav">
            <span className="tse-select-label">Cargo:</span>
            {availableOffices.map((office) => (
              <button
                key={office.office}
                type="button"
                className={`tse-office-btn ${selectedOffice === office.office ? "active" : ""}`}
                onClick={() => setSelectedOffice(office.office)}
              >
                {office.officeLabel}
              </button>
            ))}
          </div>

          <div className="tse-subfilters tse-subfilters-verified">
            <input
              type="text"
              className="tse-search-input"
              placeholder="🔍 Buscar candidato, partido ou número..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <select
              className="tse-select tse-compact-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Todos os resultados</option>
              <option value="elected">Apenas eleitos</option>
            </select>

            <select
              className="tse-select tse-compact-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              <option value="votes_desc">Mais votados</option>
              <option value="votes_asc">Menos votados</option>
              <option value="name_asc">Nome A-Z</option>
              <option value="number_asc">Número do candidato</option>
            </select>
          </div>
        </section>

        {activeOffice && (
          <>
            <section className="tse-stats-grid">
              <div className="tse-stat-card">
                <div className="tse-stat-label">Eleitorado apto</div>
                <div className="tse-stat-number" style={{ color: "#38bdf8" }}>
                  {activeOffice.totalElectorate.toLocaleString("pt-BR")}
                </div>
                <div className="tse-stat-sub">Município de Arapongas / PR</div>
              </div>

              <div className="tse-stat-card">
                <div className="tse-stat-label">Votos válidos</div>
                <div className="tse-stat-number" style={{ color: "#4ade80" }}>
                  {activeOffice.totalValidVotes.toLocaleString("pt-BR")}
                </div>
                <div className="tse-stat-sub">{activeOffice.sourceLabel}</div>
              </div>

              <div className="tse-stat-card">
                <div className="tse-stat-label">Brancos & nulos</div>
                <div className="tse-stat-number" style={{ color: "#facc15" }}>
                  {blankNullVotes.toLocaleString("pt-BR")}
                </div>
                <div className="tse-stat-sub">
                  {activeOffice.blankVotes !== undefined && activeOffice.nullVotes !== undefined
                    ? `${activeOffice.blankVotes.toLocaleString("pt-BR")} brancos • ${activeOffice.nullVotes.toLocaleString("pt-BR")} nulos`
                    : "Total combinado disponível na base verificada"}
                </div>
              </div>

              <div className="tse-stat-card">
                <div className="tse-stat-label">Comparecimento</div>
                <div className="tse-stat-number" style={{ color: "#a78bfa" }}>
                  {turnoutRate}%
                </div>
                <div className="tse-stat-sub">
                  {activeOffice.abstentions.toLocaleString("pt-BR")} abstenções
                </div>
              </div>
            </section>

            <section className="tse-leaders-section">
              <h2 className="tse-section-title">
                🏆 Mais votados — {activeOffice.officeLabel} ({selectedYear})
              </h2>
              <div className="tse-leaders-grid">
                {topLeaders.map((candidate, index) => (
                  <div
                    key={`${candidate.ballotNumber}-${candidate.name}`}
                    className={`tse-leader-card ${candidate.elected ? "elected" : ""}`}
                  >
                    <div className="tse-leader-top">
                      <div className="tse-leader-pos">{index + 1}º</div>
                      {candidate.elected && (
                        <span className="tse-leader-tag">✓ ELEITO</span>
                      )}
                    </div>
                    <div className="tse-leader-info">
                      <div className="tse-leader-name">{candidate.name}</div>
                      <div className="tse-leader-meta">
                        <b>{candidate.party}</b> • Nº {candidate.ballotNumber}
                      </div>
                    </div>
                    <div className="tse-leader-votes-bar">
                      <div className="tse-bar-track">
                        <div
                          className="tse-bar-fill"
                          style={{ width: `${Math.min(100, candidate.percentage)}%` }}
                        />
                      </div>
                      <div className="tse-bar-labels">
                        <span>{candidate.votes.toLocaleString("pt-BR")} votos</span>
                        <span>{candidate.percentage}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="tse-table-container">
              <div className="tse-table-heading">
                <h2 className="tse-section-title">
                  📋 {activeOffice.coverage === "complete" ? "Resultado completo" : "Eleitos verificados"}
                  {` (${filteredCandidates.length})`}
                </h2>
                <span className="tse-table-meta">
                  {activeOffice.coverage === "complete"
                    ? "Cobertura completa desta disputa na base verificada"
                    : "A fonte consultada nesta etapa contém somente os eleitos"}
                </span>
              </div>

              <table className="tse-table tse-desktop-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Candidato</th>
                    <th>Número</th>
                    <th>Partido</th>
                    <th style={{ textAlign: "right" }}>Votos em Arapongas</th>
                    <th style={{ textAlign: "right" }}>% válidos</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate, index) => (
                    <tr
                      key={`${candidate.ballotNumber}-${candidate.name}`}
                      className={candidate.elected ? "elected-row" : ""}
                    >
                      <td>{index + 1}º</td>
                      <td>
                        <span className="tse-cand-name">{candidate.name}</span>
                      </td>
                      <td>
                        <code className="tse-ballot-number">{candidate.ballotNumber}</code>
                      </td>
                      <td>
                        <span className="tse-party-tag">{candidate.party}</span>
                      </td>
                      <td className="tse-votes-cell">
                        {candidate.votes.toLocaleString("pt-BR")}
                      </td>
                      <td className="tse-percent-cell">{candidate.percentage}%</td>
                      <td>
                        <span
                          className={
                            candidate.elected
                              ? "tse-badge-elected"
                              : "tse-badge-not-elected"
                          }
                        >
                          {statusLabel(candidate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="tse-candidate-mobile-list">
                {filteredCandidates.map((candidate, index) => (
                  <article
                    key={`mobile-${candidate.ballotNumber}-${candidate.name}`}
                    className={`tse-candidate-mobile-card ${candidate.elected ? "elected" : ""}`}
                  >
                    <div className="tse-candidate-mobile-top">
                      <span className="tse-candidate-mobile-rank">{index + 1}º</span>
                      <span
                        className={
                          candidate.elected
                            ? "tse-badge-elected"
                            : "tse-badge-not-elected"
                        }
                      >
                        {statusLabel(candidate)}
                      </span>
                    </div>
                    <strong>{candidate.name}</strong>
                    <div className="tse-candidate-mobile-meta">
                      <span>Nº {candidate.ballotNumber}</span>
                      <span>{candidate.party}</span>
                    </div>
                    <div className="tse-candidate-mobile-result">
                      <b>{candidate.votes.toLocaleString("pt-BR")} votos</b>
                      <span>{candidate.percentage}% dos válidos</span>
                    </div>
                  </article>
                ))}
              </div>

              <div className="tse-source-footnote">
                <strong>Fonte exibida:</strong> {activeOffice.sourceLabel}.
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
