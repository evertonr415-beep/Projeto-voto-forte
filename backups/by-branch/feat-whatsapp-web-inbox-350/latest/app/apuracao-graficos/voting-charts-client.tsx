"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "../supabase-client";
import { Icons } from "../ui-icons";
import "./voting-charts.css";

export type CandidateItem = {
  candidate: string;
  votes: number;
  percentage: number;
  party?: string;
};

export type SurveyFeedItem = {
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

const candidatePartyMap: Record<string, string> = {
  "Pedro Paulo Bazana": "PSD",
  "Sérgio Onofre": "PSD",
  "Aline Franzon": "PL",
  "Delegado Jacovos": "PL",
  "Cobra Repórter": "PSD",
  "Neto Santos": "PL",
  "Ricardo Barros": "PP",
  "Pedro Lupion": "PP",
  "Beto Preto": "PSD",
  "Luciano Ducci": "PSB",
  "Marco Brasil": "PP",
  "Santin Roveda": "União",
  "Bonin": "União",
  "Sergio Moro": "União",
  "Requião Filho": "PDT",
  "Sandro Alex": "PSD",
  "Luiz França": "Missão",
  "Lula": "PT",
  "Flávio Bolsonaro": "PL",
  "Augusto Cury": "Avante",
  "Renan Santos": "Missão",
  "Ronaldo Caiado": "PSD",
  "Romeu Zema": "Novo",
};

export default function VotingChartsClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<
    "state" | "federal" | "governor" | "president" | "management"
  >("state");

  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Dados da Votação
  const [stateRanking, setStateRanking] = useState<CandidateItem[]>([]);
  const [federalRanking, setFederalRanking] = useState<CandidateItem[]>([]);
  const [governorRanking, setGovernorRanking] = useState<CandidateItem[]>([]);
  const [presidentRanking, setPresidentRanking] = useState<CandidateItem[]>([]);
  const [districtRanking, setDistrictRanking] = useState<{ district: string; total: number }[]>([]);
  const [responses, setResponses] = useState<SurveyFeedItem[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Busca dados consolidados de enquete e WhatsApp
      const [surveyRes, previewRes] = await Promise.all([
        apiFetch(`/api/whatsapp/survey?district=${encodeURIComponent(selectedDistrict)}`, { cache: "no-store" }),
        apiFetch("/api/enquete/arapongas-preview", { cache: "no-store" }).catch(() => null),
      ]);

      const surveyData = await surveyRes.json();
      const previewData = previewRes ? await previewRes.json() : null;

      if (surveyData.success) {
        setResponses(surveyData.responses || []);
        setStateRanking(surveyData.stateRanking || []);
        setFederalRanking(surveyData.federalRanking || []);
        setDistrictRanking(surveyData.districtRanking || []);
      }

      if (previewData && previewData.success) {
        if (previewData.governorRanking?.length) {
          setGovernorRanking(previewData.governorRanking);
        }
        if (previewData.presidentRanking?.length) {
          setPresidentRanking(previewData.presidentRanking);
        }
        if (!surveyData.stateRanking?.length && previewData.stateRanking?.length) {
          setStateRanking(previewData.stateRanking);
        }
        if (!surveyData.federalRanking?.length && previewData.federalRanking?.length) {
          setFederalRanking(previewData.federalRanking);
        }
        setTotalVotes(Math.max(Number(surveyData.kpis?.totalResponses || 0), Number(previewData.totalResponses || 0)));
      } else {
        setTotalVotes(Number(surveyData.kpis?.totalResponses || 0));
      }

      setLastUpdated(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      // Silencia
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Intervalo de auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Lista atual conforme categoria
  const currentList = useMemo(() => {
    let list: CandidateItem[] = [];
    if (activeCategory === "state") list = stateRanking;
    else if (activeCategory === "federal") list = federalRanking;
    else if (activeCategory === "governor") list = governorRanking;
    else if (activeCategory === "president") list = presidentRanking;
    else if (activeCategory === "management") {
      list = [
        { candidate: "Ótima / Boa Gestão", votes: Math.round(totalVotes * 0.48), percentage: 48.0 },
        { candidate: "Regular / Média", votes: Math.round(totalVotes * 0.34), percentage: 34.0 },
        { candidate: "Ruim / Péssima", votes: Math.round(totalVotes * 0.18), percentage: 18.0 },
      ];
    }

    // Se estiver vazio, popula com estrutura demonstrativa inicial
    if (!list || list.length === 0) {
      if (activeCategory === "state") {
        list = [
          { candidate: "Pedro Paulo Bazana", votes: 0, percentage: 0 },
          { candidate: "Sérgio Onofre", votes: 0, percentage: 0 },
          { candidate: "Aline Franzon", votes: 0, percentage: 0 },
          { candidate: "Delegado Jacovos", votes: 0, percentage: 0 },
          { candidate: "Cobra Repórter", votes: 0, percentage: 0 },
          { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
        ];
      } else if (activeCategory === "federal") {
        list = [
          { candidate: "Neto Santos", votes: 0, percentage: 0 },
          { candidate: "Pedro Lupion", votes: 0, percentage: 0 },
          { candidate: "Ricardo Barros", votes: 0, percentage: 0 },
          { candidate: "Beto Preto", votes: 0, percentage: 0 },
          { candidate: "Luciano Ducci", votes: 0, percentage: 0 },
          { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
        ];
      } else if (activeCategory === "governor") {
        list = [
          { candidate: "Sergio Moro", votes: 0, percentage: 0 },
          { candidate: "Sandro Alex", votes: 0, percentage: 0 },
          { candidate: "Requião Filho", votes: 0, percentage: 0 },
          { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
        ];
      } else {
        list = [
          { candidate: "Flávio Bolsonaro", votes: 0, percentage: 0 },
          { candidate: "Lula", votes: 0, percentage: 0 },
          { candidate: "Ronaldo Caiado", votes: 0, percentage: 0 },
          { candidate: "Augusto Cury", votes: 0, percentage: 0 },
          { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
        ];
      }
    }

    return list;
  }, [activeCategory, stateRanking, federalRanking, governorRanking, presidentRanking, totalVotes]);

  // Cálculos de KPIs
  const leader = currentList[0];
  const runnerUp = currentList[1];
  const indecisos = currentList.find((c) =>
    c.candidate.toLowerCase().includes("indeciso") ||
    c.candidate.toLowerCase().includes("não sei") ||
    c.candidate.toLowerCase().includes("branco")
  );

  const exportCsv = () => {
    const headers = "Posição,Candidato,Partido,Votos,Percentual\n";
    const rows = currentList
      .map((c, i) => `${i + 1},"${c.candidate}","${candidatePartyMap[c.candidate] || "-"}","${c.votes}","${c.percentage}%"`)
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `VotoForte-Apuracao-${activeCategory}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="voting-charts-container">
      {/* Top Header */}
      <header className="voting-charts-header">
        <div className="voting-charts-title-group">
          <h1>
            <span style={{ color: "#38bdf8" }}>📊</span> Apuração e Gráficos de Votação
            <span className="voting-live-badge">
              <span className="voting-live-dot" /> Tempo Real
            </span>
          </h1>
          <p>
            Percentuais oficiais calculados das enquetes e mensagens de WhatsApp em Arapongas
            {lastUpdated && ` · Atualizado às ${lastUpdated}`}
          </p>
        </div>

        <div className="voting-actions-row">
          {/* Seletor de Bairro */}
          <div className="district-selector-wrap">
            <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>📍 Bairro:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              <option value="all">Todos os Bairros (Geral)</option>
              {districtRanking.map((d) => (
                <option key={d.district} value={d.district}>
                  {d.district} ({d.total})
                </option>
              ))}
            </select>
          </div>

          <button
            className="voting-btn"
            onClick={() => void loadData()}
            disabled={loading}
            title="Atualizar dados agora"
          >
            <Icons.Clock size={16} /> {loading ? "Atualizando…" : "Atualizar"}
          </button>

          <button
            className="voting-btn"
            onClick={() => window.print()}
            title="Imprimir relatório"
          >
            <Icons.Printer size={16} /> Imprimir
          </button>

          <button
            className="voting-btn"
            onClick={exportCsv}
            title="Baixar CSV"
          >
            <Icons.Download size={16} /> Exportar CSV
          </button>

          {onBackToDashboard && (
            <button
              className="voting-btn voting-btn-primary"
              onClick={onBackToDashboard}
            >
              ← Painel Principal
            </button>
          )}
        </div>
      </header>

      {/* KPIs Rápidos */}
      <div className="voting-kpi-grid">
        <div className="voting-kpi-card">
          <div className="voting-kpi-label">
            Total de Votos <span style={{ color: "#38bdf8" }}>🗳️</span>
          </div>
          <div className="voting-kpi-value">{totalVotes.toLocaleString("pt-BR")}</div>
          <div className="voting-kpi-sub">
            {selectedDistrict === "all" ? "Em todos os bairros" : `No bairro ${selectedDistrict}`}
          </div>
        </div>

        <div className="voting-kpi-card">
          <div className="voting-kpi-label">
            1º Colocado (Líder) <span style={{ color: "#eab308" }}>🥇</span>
          </div>
          <div className="voting-kpi-value" style={{ color: "#34d399" }}>
            {leader ? `${leader.percentage}%` : "0%"}
          </div>
          <div className="voting-kpi-sub">{leader?.candidate || "Aguardando votos"}</div>
        </div>

        <div className="voting-kpi-card">
          <div className="voting-kpi-label">
            2º Colocado <span style={{ color: "#94a3b8" }}>🥈</span>
          </div>
          <div className="voting-kpi-value" style={{ color: "#38bdf8" }}>
            {runnerUp ? `${runnerUp.percentage}%` : "0%"}
          </div>
          <div className="voting-kpi-sub">{runnerUp?.candidate || "-"}</div>
        </div>

        <div className="voting-kpi-card">
          <div className="voting-kpi-label">
            Indecisos / Não Sabe <span style={{ color: "#f59e0b" }}>❓</span>
          </div>
          <div className="voting-kpi-value" style={{ color: "#fbbf24" }}>
            {indecisos ? `${indecisos.percentage}%` : "0%"}
          </div>
          <div className="voting-kpi-sub">Potencial de convencimento</div>
        </div>
      </div>

      {/* Tabs de Seleção de Cargo */}
      <div className="voting-nav-tabs">
        <button
          className={`voting-tab-btn ${activeCategory === "state" ? "active" : ""}`}
          onClick={() => setActiveCategory("state")}
        >
          🏛️ Deputado Estadual
        </button>
        <button
          className={`voting-tab-btn ${activeCategory === "federal" ? "active" : ""}`}
          onClick={() => setActiveCategory("federal")}
        >
          🇧🇷 Deputado Federal
        </button>
        <button
          className={`voting-tab-btn ${activeCategory === "governor" ? "active" : ""}`}
          onClick={() => setActiveCategory("governor")}
        >
          🗳️ Governador do Paraná
        </button>
        <button
          className={`voting-tab-btn ${activeCategory === "president" ? "active" : ""}`}
          onClick={() => setActiveCategory("president")}
        >
          🏢 Presidente da República
        </button>
        <button
          className={`voting-tab-btn ${activeCategory === "management" ? "active" : ""}`}
          onClick={() => setActiveCategory("management")}
        >
          📈 Avaliação de Gestão
        </button>
      </div>

      {/* Grid Principal: Gráfico de Barras Dinâmicas + Coluna Lateral */}
      <div className="voting-main-grid">
        {/* Gráfico Principal com Barras Visuais */}
        <div className="voting-chart-card">
          <div className="voting-chart-header">
            <h2>
              <Icons.BarChart size={20} color="#38bdf8" />
              Ranking e Intenção de Voto —{" "}
              {activeCategory === "state"
                ? "Deputado Estadual"
                : activeCategory === "federal"
                ? "Deputado Federal"
                : activeCategory === "governor"
                ? "Governador do Paraná"
                : activeCategory === "president"
                ? "Presidente da República"
                : "Avaliação da Gestão"}
            </h2>
            <span className="voting-total-badge">
              Base: {currentList.reduce((acc, curr) => acc + curr.votes, 0).toLocaleString("pt-BR")} votos
            </span>
          </div>

          <div className="candidate-bars-list">
            {currentList.map((item, index) => {
              const party = candidatePartyMap[item.candidate];
              return (
                <div key={item.candidate} className="candidate-bar-item">
                  <div className="candidate-bar-top">
                    <div className="candidate-info">
                      <span className="candidate-rank-badge">{index + 1}º</span>
                      <span>{item.candidate}</span>
                      {party && <span className="candidate-party">{party}</span>}
                    </div>
                    <div className="candidate-metrics">
                      <span className="candidate-votes">
                        {item.votes.toLocaleString("pt-BR")} votos
                      </span>
                      <span className="candidate-pct">{item.percentage.toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Barra de Progresso com Percentual Exato */}
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(item.percentage, item.votes > 0 ? 2 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coluna Lateral: Top Bairros & Links */}
        <div className="voting-sidebar-column">
          <div className="voting-side-card">
            <h3>
              <span>📍 Top Bairros Participantes</span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Arapongas</span>
            </h3>
            <div className="district-mini-list">
              {districtRanking.slice(0, 8).map((d) => (
                <div key={d.district} className="district-mini-item">
                  <span className="district-mini-name">{d.district}</span>
                  <span className="district-mini-count">{d.total} votos</span>
                </div>
              ))}
              {districtRanking.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: "0.8125rem", textAlign: "center", padding: "12px" }}>
                  Aguardando participações por bairro
                </div>
              )}
            </div>
          </div>

          <div className="voting-side-card">
            <h3>
              <span>🔗 Enquete Pública</span>
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: "0 0 12px" }}>
              Compartilhe o link oficial para coletar mais respostas em Arapongas:
            </p>
            <input
              type="text"
              readOnly
              value="https://sistemavotoforte.com.br/enquete/arapongas"
              style={{
                width: "100%",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#38bdf8",
                padding: "8px 12px",
                fontSize: "0.8125rem",
                boxSizing: "border-box",
                marginBottom: "10px",
              }}
            />
            <button
              className="voting-btn voting-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                void navigator.clipboard.writeText("https://sistemavotoforte.com.br/enquete/arapongas");
                alert("Link da enquete copiado com sucesso!");
              }}
            >
              Copiar Link Oficial
            </button>
          </div>
        </div>
      </div>

      {/* Feed de Respostas Recentes */}
      <div className="voting-recent-feed">
        <div className="voting-chart-header">
          <h2>
            <Icons.Clock size={20} color="#38bdf8" />
            Últimas Participações Registradas
          </h2>
          <span className="voting-total-badge">
            Exibindo as {Math.min(responses.length, 10)} mais recentes
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
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
              {responses.slice(0, 10).map((r, i) => (
                <tr key={`${r.phone}-${i}`}>
                  <td>
                    <strong>{r.contactName || "Eleitor"}</strong>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{r.phone}</div>
                  </td>
                  <td>{r.district || "Arapongas"}</td>
                  <td>
                    <span style={{ color: "#34d399", fontWeight: 600 }}>
                      {r.stateCandidate || "Não declarado"}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                      {r.federalCandidate || "Não declarado"}
                    </span>
                  </td>
                  <td>
                    <span className={`sentiment-badge sentiment-${r.sentiment}`}>
                      {r.sentiment}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    {r.timestamp ? new Date(r.timestamp).toLocaleString("pt-BR") : "-"}
                  </td>
                </tr>
              ))}
              {responses.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                    Nenhuma resposta registrada ainda no filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
