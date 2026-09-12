"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { apiFetch } from "./supabase-client";

interface SurveyResponseItem {
  phone: string;
  contactName: string;
  district: string;
  city: string;
  messageText: string;
  stateCandidate: string;
  federalCandidate: string;
  sentiment: "declarado" | "indeciso" | "apoio" | "critica" | "neutro";
  timestamp: string;
}

interface CandidateRanking {
  candidate: string;
  votes: number;
  percentage: number;
}

interface DistrictRanking {
  district: string;
  total: number;
}

export default function WhatsappSurveyIntelligence() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ranking" | "messages" | "simulate">("ranking");

  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [responses, setResponses] = useState<SurveyResponseItem[]>([]);
  const [stateRanking, setStateRanking] = useState<CandidateRanking[]>([]);
  const [federalRanking, setFederalRanking] = useState<CandidateRanking[]>([]);
  const [districtRanking, setDistrictRanking] = useState<DistrictRanking[]>([]);
  const [kpis, setKpis] = useState({
    totalResponses: 0,
    topStateCandidate: "-",
    topFederalCandidate: "-",
    activeDistrictsCount: 0,
  });

  // Simulation form
  const [simPhone, setSimPhone] = useState("");
  const [simMessage, setSimMessage] = useState("");
  const [simStatus, setSimStatus] = useState("");

  // Load survey data from API
  const loadSurveyData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/whatsapp/survey?district=${encodeURIComponent(selectedDistrict)}`;
      const res = await apiFetch(url, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setResponses(data.responses || []);
        setStateRanking(data.stateRanking || []);
        setFederalRanking(data.federalRanking || []);
        setDistrictRanking(data.districtRanking || []);
        setKpis(data.kpis || {});
      }
    } catch {
      // Silencia falha de conexão
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("voto-forte:open-survey-intelligence", handleOpen);
    return () => {
      window.removeEventListener("voto-forte:open-survey-intelligence", handleOpen);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadSurveyData();
    }
  }, [isOpen, loadSurveyData]);

  // Handle Simulation
  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone || !simMessage) {
      setSimStatus("Preencha o telefone e a mensagem de resposta.");
      return;
    }

    setSimStatus("Analisando e computando votos...");
    try {
      const res = await apiFetch("/api/whatsapp/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: simPhone, message: simMessage }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSimStatus("✅ Resposta analisada e voto computado com sucesso!");
        setSimMessage("");
        void loadSurveyData();
      } else {
        setSimStatus(`❌ Erro: ${data.error || "Falha ao processar"}`);
      }
    } catch (err) {
      setSimStatus(`❌ Erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Export CSV
  const exportCsv = () => {
    if (!responses.length) return;
    const headers = "Nome,Telefone,Bairro,Cidade,Deputado Estadual,Deputado Federal,Sentimento,Mensagem,DataHora\n";
    const rows = responses
      .map(
        (r) =>
          `"${r.contactName.replace(/"/g, '""')}","${r.phone}","${r.district}","${r.city}","${r.stateCandidate}","${r.federalCandidate}","${r.sentiment}","${r.messageText.replace(/"/g, '""')}","${r.timestamp}"`,
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `VotoForte-Apuracao-WhatsApp-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Generate and download visual print in PNG
  const downloadPrint = (item: SurveyResponseItem) => {
    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fundo do WhatsApp Dark
    ctx.fillStyle = "#0b141a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Barra superior
    ctx.fillStyle = "#202c33";
    ctx.fillRect(0, 0, canvas.width, 70);

    // Avatar
    ctx.beginPath();
    ctx.arc(45, 35, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#00a884";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((item.contactName || "E").charAt(0).toUpperCase(), 45, 41);

    // Nome e Bairro no Header
    ctx.textAlign = "left";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(item.contactName || "Eleitor(a)", 80, 30);

    ctx.fillStyle = "#8696a0";
    ctx.font = "12px sans-serif";
    ctx.fillText(`📍 ${item.district || "Arapongas"} · ${item.phone}`, 80, 50);

    // Balão de Mensagem Recebida do WhatsApp
    const bubbleX = 30;
    const bubbleY = 95;
    const bubbleW = 590;
    const bubbleH = 170;
    const radius = 12;

    ctx.fillStyle = "#202c33";
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, radius);
    ctx.fill();

    // Texto da Mensagem
    ctx.fillStyle = "#e9edef";
    ctx.font = "15px sans-serif";
    
    // Quebra de texto simples
    const words = item.messageText.split(" ");
    let line = "";
    let y = bubbleY + 35;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > bubbleW - 40 && n > 0) {
        ctx.fillText(line, bubbleX + 20, y);
        line = words[n] + " ";
        y += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, bubbleX + 20, y);

    // Hora no balão
    ctx.fillStyle = "#8696a0";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    const timeStr = new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    ctx.fillText(timeStr, bubbleX + bubbleW - 15, bubbleY + bubbleH - 12);

    // Rodapé de Classificação de Voto / IA
    ctx.textAlign = "left";
    ctx.fillStyle = "#111b21";
    ctx.fillRect(0, 280, canvas.width, 80);

    ctx.fillStyle = "#00a884";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("APURAÇÃO OFICIAL VOTO FORTE · INTENÇÃO DE VOTO IDENTIFICADA:", 30, 305);

    ctx.fillStyle = "#ffffff";
    ctx.font = "13px sans-serif";
    ctx.fillText(`🏛️ Dep. Estadual: ${item.stateCandidate}`, 30, 330);
    ctx.fillText(`🇧🇷 Dep. Federal: ${item.federalCandidate}`, 320, 330);

    // Download do PNG
    const link = document.createElement("a");
    link.download = `Comprovante-Voto-${item.contactName.replace(/\s+/g, "_")}-${item.phone}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="wt-drawer-overlay is-open" onClick={() => setIsOpen(false)} />

      <aside className="wt-drawer is-open" style={{ width: "min(780px, 100vw)", maxWidth: "100vw" }}>
        {/* Header */}
        <header className="wt-drawer-header">
          <div className="wt-drawer-title-group">
            <div className="wt-header-logo">
              <span style={{ fontSize: "24px" }}>📊</span>
            </div>
            <div>
              <h2>
                Apuração e Enquete Digital <span>🗳️</span>
              </h2>
              <p>Inteligência de respostas, ranking de deputados e prints</p>
            </div>
          </div>
          <button type="button" className="wt-close-btn" onClick={() => setIsOpen(false)}>
            ✕
          </button>
        </header>

        {/* Navigation Tabs */}
        <nav className="wt-tabs">
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "ranking" ? "is-active" : ""}`}
            onClick={() => setActiveTab("ranking")}
          >
            📊 Apuração & Rankings
          </button>
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "messages" ? "is-active" : ""}`}
            onClick={() => setActiveTab("messages")}
          >
            💬 Respostas & Prints ({responses.length})
          </button>
          <button
            type="button"
            className={`wt-tab-btn ${activeTab === "simulate" ? "is-active" : ""}`}
            onClick={() => setActiveTab("simulate")}
          >
            ➕ Registrar Resposta Manual
          </button>
        </nav>

        {/* Content */}
        <div className="wt-drawer-body">
          {activeTab === "ranking" && (
            <>
              {/* KPIs Grid */}
              <div className="wt-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                <div className="wt-stat-card">
                  <strong>{kpis.totalResponses}</strong>
                  <span>Total Respostas</span>
                </div>
                <div className="wt-stat-card is-success">
                  <strong style={{ fontSize: "16px" }}>{kpis.topStateCandidate}</strong>
                  <span>Líder Estadual</span>
                </div>
                <div className="wt-stat-card is-success">
                  <strong style={{ fontSize: "16px" }}>{kpis.topFederalCandidate}</strong>
                  <span>Líder Federal</span>
                </div>
                <div className="wt-stat-card">
                  <strong>{kpis.activeDistrictsCount}</strong>
                  <span>Bairros com Votos</span>
                </div>
              </div>

              {/* Filtro por Bairro */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--wt-text)" }}>Filtrar por Bairro:</label>
                  <select
                    className="wt-select"
                    style={{ width: "220px", padding: "6px 10px" }}
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                  >
                    <option value="all">Todos os Bairros</option>
                    {districtRanking.map((d) => (
                      <option key={d.district} value={d.district}>
                        {d.district} ({d.total})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={loadSurveyData}
                    style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}
                  >
                    🔄 Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    style={{ padding: "6px 12px", border: "none", borderRadius: "8px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}
                  >
                    📥 Exportar CSV / Excel
                  </button>
                </div>
              </div>

              {/* Grid de Rankings Estaduais e Federais */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {/* Ranking Estadual */}
                <section className="wt-card">
                  <div className="wt-card-title">
                    <span>🏛️</span> Deputados Estaduais Mais Votados
                  </div>

                  {stateRanking.length === 0 ? (
                    <div style={{ color: "var(--wt-text-muted)", fontSize: "13px", padding: "16px 0", textAlign: "center" }}>
                      Nenhum voto computado para estadual ainda.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {stateRanking.map((item, idx) => (
                        <div key={item.candidate} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700 }}>
                            <span>
                              {idx + 1}º {item.candidate}
                            </span>
                            <span style={{ color: "#16a34a" }}>
                              {item.votes} voto(s) ({item.percentage}%)
                            </span>
                          </div>
                          <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${item.percentage}%`,
                                background: idx === 0 ? "#16a34a" : "#2563eb",
                                borderRadius: "999px",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Ranking Federal */}
                <section className="wt-card">
                  <div className="wt-card-title">
                    <span>🇧🇷</span> Deputados Federais Mais Votados
                  </div>

                  {federalRanking.length === 0 ? (
                    <div style={{ color: "var(--wt-text-muted)", fontSize: "13px", padding: "16px 0", textAlign: "center" }}>
                      Nenhum voto computado para federal ainda.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {federalRanking.map((item, idx) => (
                        <div key={item.candidate} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700 }}>
                            <span>
                              {idx + 1}º {item.candidate}
                            </span>
                            <span style={{ color: "#2563eb" }}>
                              {item.votes} voto(s) ({item.percentage}%)
                            </span>
                          </div>
                          <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${item.percentage}%`,
                                background: idx === 0 ? "#2563eb" : "#9333ea",
                                borderRadius: "999px",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Bairros mais engajados */}
              <section className="wt-card" style={{ marginTop: "14px" }}>
                <div className="wt-card-title">
                  <span>📍</span> Participação e Respostas por Bairro
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {districtRanking.length === 0 ? (
                    <div style={{ color: "var(--wt-text-muted)", fontSize: "13px", padding: "10px 0" }}>
                      Nenhum bairro com respostas registradas ainda.
                    </div>
                  ) : (
                    districtRanking.map((d) => (
                      <div
                        key={d.district}
                        style={{
                          padding: "6px 12px",
                          background: "#f1f5f9",
                          borderRadius: "8px",
                          fontSize: "12px",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <strong>{d.district}</strong>: <span style={{ color: "#16a34a", fontWeight: 700 }}>{d.total} respostas</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "messages" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {responses.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--wt-text-muted)", padding: "30px", fontSize: "14px" }}>
                  Nenhuma resposta recebida ainda. Dispare a enquete para começar a coletar os votos!
                </div>
              ) : (
                responses.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "16px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Header do Eleitor */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: "#25d366",
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: "15px",
                          }}
                        >
                          {(item.contactName || "E").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: "14px", display: "block" }}>{item.contactName}</strong>
                          <small style={{ color: "#64748b", fontSize: "11px" }}>
                            📱 {item.phone} · 🏡 {item.district} ({item.city})
                          </small>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadPrint(item)}
                        style={{
                          background: "#1e293b",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        📸 Baixar Print PNG
                      </button>
                    </div>

                    {/* Balão Visual do WhatsApp */}
                    <div
                      style={{
                        background: "#dcf8c6",
                        border: "1px solid #c3e6cb",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        fontSize: "14px",
                        color: "#111827",
                        position: "relative",
                        maxWidth: "92%",
                      }}
                    >
                      &quot;{item.messageText}&quot;
                      <span
                        style={{
                          display: "block",
                          textAlign: "right",
                          fontSize: "10px",
                          color: "#6b7280",
                          marginTop: "6px",
                        }}
                      >
                        {new Date(item.timestamp).toLocaleTimeString("pt-BR")} ✓✓
                      </span>
                    </div>

                    {/* Classificação dos Votos */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", paddingTop: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748b" }}>VOTO APURADO:</span>
                      <span style={{ background: "rgba(22, 163, 74, 0.1)", color: "#15803d", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                        🏛️ Estadual: {item.stateCandidate}
                      </span>
                      <span style={{ background: "rgba(37, 99, 235, 0.1)", color: "#1d4ed8", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                        🇧🇷 Federal: {item.federalCandidate}
                      </span>
                      <span style={{ background: "#f1f5f9", color: "#475569", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", textTransform: "capitalize" }}>
                        Intenção: {item.sentiment}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "simulate" && (
            <section className="wt-card">
              <div className="wt-card-title">
                <span>🧪</span> Inserir / Testar Resposta de Eleitor Manualmente
              </div>

              <form onSubmit={handleSimulate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="wt-form-group">
                  <label>Telefone do Eleitor (com DDD)</label>
                  <input
                    type="tel"
                    className="wt-input"
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    placeholder="Ex: 43999998888"
                  />
                </div>

                <div className="wt-form-group">
                  <label>Texto da Resposta do Eleitor</label>
                  <textarea
                    className="wt-textarea"
                    rows={3}
                    value={simMessage}
                    onChange={(e) => setSimMessage(e.target.value)}
                    placeholder="Ex: Para deputado estadual vou votar no Pedro e para federal no Lucas!"
                  />
                </div>

                <button type="submit" className="wt-primary-btn">
                  Processar e Computar Voto
                </button>

                {simStatus && (
                  <div
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      background: simStatus.includes("✅") ? "rgba(34, 197, 94, 0.15)" : "#fee2e2",
                      color: simStatus.includes("✅") ? "#15803d" : "#b91c1c",
                      fontWeight: 600,
                    }}
                  >
                    {simStatus}
                  </div>
                )}
              </form>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
