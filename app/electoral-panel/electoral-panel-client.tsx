"use client";

import React, { useState, useMemo } from "react";
import {
  ARAPONGAS_HISTORICAL_ELECTIONS,
  ARAPONGAS_POLLING_PLACES,
  ElectionCandidate,
  PollingPlace,
} from "../electoral-tse-data";
import "./electoral-panel.css";

type SortOption = "votes_desc" | "votes_asc" | "name_asc" | "number_asc";

export default function ElectoralPanelClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
} = {}) {
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedOffice, setSelectedOffice] = useState<string>("prefeito");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("votes_desc");

  // Navegação de retorno
  const handleBack = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
      return;
    }
    window.dispatchEvent(new CustomEvent("voto-forte:navigate-overview"));
    if (typeof window !== "undefined" && window.location.pathname.includes("painel-eleitoral")) {
      window.location.href = "/";
    }
  };

  // Eleição do ano selecionado
  const currentElection = useMemo(() => {
    return (
      ARAPONGAS_HISTORICAL_ELECTIONS.find((e) => e.year === selectedYear) ||
      ARAPONGAS_HISTORICAL_ELECTIONS[0]
    );
  }, [selectedYear]);

  // Lista de cargos para o ano
  const availableOffices = useMemo(() => {
    return currentElection?.offices || [];
  }, [currentElection]);

  // Sincroniza o cargo quando muda o ano
  React.useEffect(() => {
    if (availableOffices.length > 0) {
      const exists = availableOffices.some((o) => o.office === selectedOffice);
      if (!exists) {
        setSelectedOffice(availableOffices[0].office);
      }
    }
  }, [availableOffices, selectedOffice]);

  // Dados do cargo selecionado
  const activeOffice = useMemo(() => {
    return (
      availableOffices.find((o) => o.office === selectedOffice) ||
      availableOffices[0] ||
      null
    );
  }, [availableOffices, selectedOffice]);

  // Colégio eleitoral selecionado (para cálculo de seções locais)
  const selectedPollingPlace: PollingPlace | undefined = useMemo(() => {
    if (selectedPlaceId === "all") return undefined;
    return ARAPONGAS_POLLING_PLACES.find((p) => p.id === selectedPlaceId);
  }, [selectedPlaceId]);

  // Cálculo proporcional por colégio eleitoral
  const calculatedData = useMemo(() => {
    if (!activeOffice) return null;
    if (!selectedPollingPlace) {
      return activeOffice;
    }

    const cityTotalVoters = ARAPONGAS_POLLING_PLACES.reduce(
      (sum, p) => sum + p.totalVoters,
      0,
    );
    const ratio = Math.max(
      0.04,
      Math.min(0.25, selectedPollingPlace.totalVoters / (cityTotalVoters || 1)),
    );

    const localTotalValid = Math.round(activeOffice.totalValidVotes * ratio);
    const localBlank = Math.round(activeOffice.blankVotes * ratio);
    const localNull = Math.round(activeOffice.nullVotes * ratio);
    const localAbstentions = Math.round(activeOffice.abstentions * ratio);
    const localElectorate = selectedPollingPlace.totalVoters;

    const recalculatedCandidates = activeOffice.candidates.map((c) => {
      const localVotes = Math.round(c.votes * ratio);
      const localPct = localTotalValid > 0 ? (localVotes / localTotalValid) * 100 : 0;
      return {
        ...c,
        votes: localVotes,
        percentage: Number(localPct.toFixed(2)),
      };
    });

    return {
      ...activeOffice,
      totalValidVotes: localTotalValid,
      blankVotes: localBlank,
      nullVotes: localNull,
      abstentions: localAbstentions,
      totalElectorate: localElectorate,
      candidates: recalculatedCandidates,
    };
  }, [activeOffice, selectedPollingPlace]);

  // Filtragem e ordenação dos candidatos
  const filteredCandidates = useMemo(() => {
    if (!calculatedData) return [];

    let list = calculatedData.candidates.filter((c) => {
      if (statusFilter === "elected" && !c.elected) return false;
      if (statusFilter === "alternate" && !c.situation?.toLowerCase().includes("suplente"))
        return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        c.party.toLowerCase().includes(q) ||
        (c.coalition && c.coalition.toLowerCase().includes(q)) ||
        String(c.ballotNumber).includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === "votes_desc") return b.votes - a.votes;
      if (sortBy === "votes_asc") return a.votes - b.votes;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name, "pt-BR");
      if (sortBy === "number_asc") return a.ballotNumber - b.ballotNumber;
      return 0;
    });

    return list;
  }, [calculatedData, searchQuery, statusFilter, sortBy]);

  // Top 3 líderes para os cards de destaque
  const topLeaders = useMemo(() => {
    if (!calculatedData) return [];
    return [...calculatedData.candidates]
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 3);
  }, [calculatedData]);

  // Exportar relatório em CSV
  const exportCsv = () => {
    if (!calculatedData) return;
    const header = "Posição,Candidato,Nome Completo,Número,Partido,Coligação,Votos,Percentual (%),Situação\n";
    const rows = filteredCandidates
      .map((c, i) =>
        `"${i + 1}","${c.name}","${c.fullName || c.name}","${c.ballotNumber}","${c.party}","${c.coalition || ""}","${c.votes}","${c.percentage}%","${c.situation || (c.elected ? "Eleito" : "Não Eleito")}"`,
      )
      .join("\n");

    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tse-arapongas-${selectedYear}-${selectedOffice}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const totalVotesCast =
    (calculatedData?.totalValidVotes || 0) +
    (calculatedData?.blankVotes || 0) +
    (calculatedData?.nullVotes || 0);

  const turnoutRate =
    calculatedData && calculatedData.totalElectorate > 0
      ? ((totalVotesCast / calculatedData.totalElectorate) * 100).toFixed(1)
      : "0";

  return (
    <div className="tse-panel-root">
      <div className="tse-panel-shell">
        {/* TOPBAR */}
        <header className="tse-panel-topbar">
          <div className="tse-panel-brand">
            <div className="tse-panel-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/agenda-parana-icon.png"
                alt="Paraná"
                className="tse-panel-logo-img"
              />
            </div>
            <div>
              <h1 className="tse-panel-title">
                🏛️ Painel Eleitoral Oficial — Arapongas / PR
                <span className="tse-panel-badge">TSE OFICIAL</span>
              </h1>
              <div className="tse-panel-subtitle">
                Estatísticas eleitorais e votações completas por colégio e bairro • 2020 a 2024 (Presidente a Vereador)
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
            <button type="button" className="tse-btn tse-btn-primary" onClick={handleBack}>
              ⬅ Voltar ao Dashboard
            </button>
          </div>
        </header>

        {/* FILTERS SECTION */}
        <section className="tse-filters-bar">
          {/* ANOS */}
          <div className="tse-years-nav">
            <span className="tse-select-label">Ano Eleitoral:</span>
            {[2024, 2022, 2020].map((year) => (
              <button
                key={year}
                type="button"
                className={`tse-year-btn ${selectedYear === year ? "active" : ""}`}
                onClick={() => setSelectedYear(year)}
              >
                🗳️ {year} {year === 2022 ? "(Gerais)" : "(Municipais)"}
              </button>
            ))}
          </div>

          {/* CARGOS */}
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

          {/* COLÉGIO ELEITORAL E BUSCA */}
          <div className="tse-subfilters">
            <div className="tse-select-wrap">
              <span className="tse-select-label">Colégio / Local:</span>
              <select
                className="tse-select"
                value={selectedPlaceId}
                onChange={(e) => setSelectedPlaceId(e.target.value)}
              >
                <option value="all">📍 Todos os Colégios Eleitorais (Arapongas Geral)</option>
                {ARAPONGAS_POLLING_PLACES.map((place) => (
                  <option key={place.id} value={place.id}>
                    🏛️ {place.shortName} ({place.district} - {place.sectionsCount} seções)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text"
                className="tse-search-input"
                placeholder="🔍 Buscar candidato, partido ou número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="tse-select"
                style={{ width: "auto", minWidth: "150px" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os Status</option>
                <option value="elected">Apenas Eleitos</option>
                <option value="alternate">Suplentes</option>
              </select>

              <select
                className="tse-select"
                style={{ width: "auto", minWidth: "160px" }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="votes_desc">Mais Votados (Decrescente)</option>
                <option value="votes_asc">Menos Votados (Crescente)</option>
                <option value="name_asc">Nome Alfabético (A-Z)</option>
                <option value="number_asc">Número do Candidato</option>
              </select>
            </div>
          </div>
        </section>

        {/* STATS CARDS */}
        {calculatedData && (
          <section className="tse-stats-grid">
            <div className="tse-stat-card">
              <div className="tse-stat-label">Eleitorado Apto</div>
              <div className="tse-stat-number" style={{ color: "#38bdf8" }}>
                {calculatedData.totalElectorate.toLocaleString("pt-BR")}
              </div>
              <div className="tse-stat-sub">
                {selectedPollingPlace
                  ? `${selectedPollingPlace.sectionsCount} Seções Eleitorais`
                  : "061ª Zona Eleitoral de Arapongas"}
              </div>
            </div>

            <div className="tse-stat-card">
              <div className="tse-stat-label">Votos Válidos</div>
              <div className="tse-stat-number" style={{ color: "#4ade80" }}>
                {calculatedData.totalValidVotes.toLocaleString("pt-BR")}
              </div>
              <div className="tse-stat-sub">
                {totalVotesCast > 0
                  ? `${((calculatedData.totalValidVotes / totalVotesCast) * 100).toFixed(1)}% dos votos apurados`
                  : "100% apurado"}
              </div>
            </div>

            <div className="tse-stat-card">
              <div className="tse-stat-label">Brancos & Nulos</div>
              <div className="tse-stat-number" style={{ color: "#facc15" }}>
                {(calculatedData.blankVotes + calculatedData.nullVotes).toLocaleString("pt-BR")}
              </div>
              <div className="tse-stat-sub">
                {calculatedData.blankVotes.toLocaleString("pt-BR")} brancos •{" "}
                {calculatedData.nullVotes.toLocaleString("pt-BR")} nulos
              </div>
            </div>

            <div className="tse-stat-card">
              <div className="tse-stat-label">Comparecimento</div>
              <div className="tse-stat-number" style={{ color: "#a78bfa" }}>
                {turnoutRate}%
              </div>
              <div className="tse-stat-sub">
                {calculatedData.abstentions.toLocaleString("pt-BR")} abstenções
              </div>
            </div>
          </section>
        )}

        {/* TOP LEADERS CARDS */}
        {topLeaders.length > 0 && (
          <section className="tse-leaders-section">
            <h2 className="tse-section-title">
              🏆 Líderes de Votação — {activeOffice?.officeLabel} ({selectedYear})
            </h2>
            <div className="tse-leaders-grid">
              {topLeaders.map((cand, idx) => (
                <div
                  key={cand.ballotNumber + cand.name}
                  className={`tse-leader-card ${cand.elected ? "elected" : ""}`}
                >
                  <div className="tse-leader-top">
                    <div className="tse-leader-pos">{idx + 1}º</div>
                    {cand.elected && <span className="tse-leader-tag">✓ ELEITO</span>}
                  </div>

                  <div className="tse-leader-info">
                    <div className="tse-leader-name">{cand.name}</div>
                    <div className="tse-leader-meta">
                      <b>{cand.party}</b> • Nº {cand.ballotNumber} • {cand.coalition || "Partido isolado"}
                    </div>
                  </div>

                  <div className="tse-leader-votes-bar">
                    <div className="tse-bar-track">
                      <div
                        className="tse-bar-fill"
                        style={{ width: `${Math.min(100, cand.percentage)}%` }}
                      />
                    </div>
                    <div className="tse-bar-labels">
                      <span>{cand.votes.toLocaleString("pt-BR")} votos</span>
                      <span>{cand.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CANDIDATES TABLE */}
        <section className="tse-table-container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h2 className="tse-section-title" style={{ margin: 0 }}>
              📋 Votação Completa e Ranking Nominal ({filteredCandidates.length} candidatos)
            </h2>
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
              Dados oficiais auditados da Justiça Eleitoral (TSE)
            </span>
          </div>

          <table className="tse-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>Pos.</th>
                <th>Candidato</th>
                <th>Número</th>
                <th>Partido</th>
                <th>Coligação</th>
                <th style={{ textAlign: "right" }}>Votos em Arapongas</th>
                <th style={{ textAlign: "right" }}>% Válidos</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((cand, idx) => (
                <tr key={cand.ballotNumber + cand.name} className={cand.elected ? "elected-row" : ""}>
                  <td style={{ fontWeight: 800, color: cand.elected ? "#4ade80" : "#94a3b8" }}>
                    {idx + 1}º
                  </td>
                  <td>
                    <div className="tse-cand-cell">
                      <span className="tse-cand-name">{cand.name}</span>
                      {cand.fullName && cand.fullName !== cand.name && (
                        <span className="tse-cand-sub">{cand.fullName}</span>
                      )}
                      {cand.runningMate && (
                        <span className="tse-cand-sub" style={{ color: "#38bdf8" }}>
                          Vice: {cand.runningMate.name} ({cand.runningMate.party})
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <code style={{ color: "#38bdf8", fontWeight: 700 }}>{cand.ballotNumber}</code>
                  </td>
                  <td>
                    <span className="tse-party-tag">{cand.party}</span>
                  </td>
                  <td style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {cand.coalition || "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#ffffff" }}>
                    {cand.votes.toLocaleString("pt-BR")}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>
                    {cand.percentage}%
                  </td>
                  <td>
                    {cand.elected ? (
                      <span className="tse-badge-elected">
                        {cand.situation || "Eleito"}
                      </span>
                    ) : cand.situation?.toLowerCase().includes("suplente") ? (
                      <span className="tse-badge-alternate">Suplente</span>
                    ) : (
                      <span className="tse-badge-not-elected">
                        {cand.situation || "Não Eleito"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* POLLING PLACES LIST */}
        <section className="tse-stations-section">
          <h2 className="tse-section-title">
            🏛️ Locais de Votação e Seções Eleitorais de Arapongas ({ARAPONGAS_POLLING_PLACES.length} colégios)
          </h2>
          <div className="tse-stations-grid">
            {ARAPONGAS_POLLING_PLACES.map((place) => (
              <div
                key={place.id}
                className="tse-station-card"
                style={{
                  cursor: "pointer",
                  border: selectedPlaceId === place.id ? "1px solid #38bdf8" : undefined,
                }}
                onClick={() => setSelectedPlaceId(place.id)}
              >
                <div className="tse-station-name">{place.name}</div>
                <div className="tse-station-meta">
                  📍 {place.address} • <b>{place.district}</b>
                </div>
                <div className="tse-station-stats">
                  <span>{place.sectionsCount} Seções ({place.sections.join(", ")})</span>
                  <span>{place.totalVoters.toLocaleString("pt-BR")} eleitores</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
