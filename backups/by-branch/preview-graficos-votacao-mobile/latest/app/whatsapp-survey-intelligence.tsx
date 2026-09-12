"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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

  const [simPhone, setSimPhone] = useState("");
  const [simMessage, setSimMessage] = useState("");
  const [simStatus, setSimStatus] = useState("");

  const maxDistrictTotal = useMemo(
    () => Math.max(1, ...districtRanking.map((item) => item.total)),
    [districtRanking],
  );

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
      // Mantém os dados atuais em caso de falha de conexão.
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
    URL.revokeObjectURL(link.href);
  };

  const downloadPrint = (item: SurveyResponseItem) => {
    const canvas = document.createElement("canvas");
    canvas.width = 650;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0b141a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#202c33";
    ctx.fillRect(0, 0, canvas.width, 70);

    ctx.beginPath();
    ctx.arc(45, 35, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#00a884";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((item.contactName || "E").charAt(0).toUpperCase(), 45, 41);

    ctx.textAlign = "left";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(item.contactName || "Eleitor(a)", 80, 30);
    ctx.fillStyle = "#8696a0";
    ctx.font = "12px sans-serif";
    ctx.fillText(`📍 ${item.district || "Arapongas"} · ${item.phone}`, 80, 50);

    const bubbleX = 30;
    const bubbleY = 95;
    const bubbleW = 590;
    const bubbleH = 170;

    ctx.fillStyle = "#202c33";
    ctx.beginPath();
    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 12);
    ctx.fill();

    ctx.fillStyle = "#e9edef";
    ctx.font = "15px sans-serif";
    const words = item.messageText.split(" ");
    let line = "";
    let y = bubbleY + 35;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      if (ctx.measureText(testLine).width > bubbleW - 40 && n > 0) {
        ctx.fillText(line, bubbleX + 20, y);
        line = words[n] + " ";
        y += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, bubbleX + 20, y);

    ctx.fillStyle = "#8696a0";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    const timeStr = new Date(item.timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    ctx.fillText(timeStr, bubbleX + bubbleW - 15, bubbleY + bubbleH - 12);

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

    const link = document.createElement("a");
    link.download = `Comprovante-Voto-${item.contactName.replace(/\s+/g, "_")}-${item.phone}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (!isOpen) return null;

  const renderRanking = (
    title: string,
    items: CandidateRanking[],
    kind: "state" | "federal",
  ) => (
    <section className="wt-card survey-ranking-card">
      <div className="wt-card-title survey-card-title">{title}</div>
      {items.length === 0 ? (
        <div className="survey-empty">
          Nenhum voto computado para {kind === "state" ? "estadual" : "federal"} ainda.
        </div>
      ) : (
        <div className="survey-ranking-list">
          {items.map((item, idx) => (
            <div key={item.candidate} className="survey-ranking-item">
              <div className="survey-ranking-line">
                <span className="survey-candidate-name">
                  <b>{idx + 1}º</b> {item.candidate}
                </span>
                <span className={`survey-votes ${kind}`}>
                  {item.votes} voto(s) · {item.percentage}%
                </span>
              </div>
              <div className="survey-progress-track">
                <div
                  className={`survey-progress-fill ${kind} ${idx === 0 ? "leader" : ""}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <>
      <div className="wt-drawer-overlay is-open" onClick={() => setIsOpen(false)} />

      <aside className="wt-drawer is-open survey-drawer">
        <header className="wt-drawer-header survey-header">
          <div className="wt-drawer-title-group survey-title-group">
            <div className="wt-header-logo survey-logo" aria-hidden="true">
              📊
            </div>
            <div className="survey-heading-copy">
              <h2>
                Apuração e Enquete Digital <span>🗳️</span>
              </h2>
              <p>Inteligência de respostas, ranking de deputados e prints</p>
            </div>
          </div>
          <button
            type="button"
            className="wt-close-btn survey-close"
            onClick={() => setIsOpen(false)}
            aria-label="Fechar apuração"
          >
            ✕
          </button>
        </header>

        <nav className="wt-tabs survey-tabs">
          <button
            type="button"
            className={`wt-tab-btn survey-tab ${activeTab === "ranking" ? "is-active" : ""}`}
            onClick={() => setActiveTab("ranking")}
          >
            <span className="survey-tab-icon">📊</span>
            <span className="survey-tab-desktop">Apuração & Rankings</span>
            <span className="survey-tab-mobile">Apuração</span>
          </button>
          <button
            type="button"
            className={`wt-tab-btn survey-tab ${activeTab === "messages" ? "is-active" : ""}`}
            onClick={() => setActiveTab("messages")}
          >
            <span className="survey-tab-icon">💬</span>
            <span className="survey-tab-desktop">Respostas & Prints ({responses.length})</span>
            <span className="survey-tab-mobile">Respostas ({responses.length})</span>
          </button>
          <button
            type="button"
            className={`wt-tab-btn survey-tab ${activeTab === "simulate" ? "is-active" : ""}`}
            onClick={() => setActiveTab("simulate")}
          >
            <span className="survey-tab-icon">＋</span>
            <span className="survey-tab-desktop">Registrar Resposta Manual</span>
            <span className="survey-tab-mobile">Manual</span>
          </button>
        </nav>

        <div className="wt-drawer-body survey-body">
          {activeTab === "ranking" && (
            <>
              <div className="wt-stats-grid survey-kpis">
                <div className="wt-stat-card survey-kpi-card">
                  <strong>{kpis.totalResponses}</strong>
                  <span>Total de respostas</span>
                </div>
                <div className="wt-stat-card survey-kpi-card">
                  <strong>{kpis.activeDistrictsCount}</strong>
                  <span>Bairros com votos</span>
                </div>
                <div className="wt-stat-card is-success survey-kpi-card survey-kpi-leader">
                  <strong>{kpis.topStateCandidate}</strong>
                  <span>Líder estadual</span>
                </div>
                <div className="wt-stat-card is-success survey-kpi-card survey-kpi-leader">
                  <strong>{kpis.topFederalCandidate}</strong>
                  <span>Líder federal</span>
                </div>
              </div>

              <div className="survey-toolbar">
                <div className="survey-filter">
                  <label htmlFor="survey-district">Filtrar por bairro</label>
                  <select
                    id="survey-district"
                    className="wt-select survey-select"
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

                <div className="survey-actions">
                  <button
                    type="button"
                    className="survey-action secondary"
                    onClick={loadSurveyData}
                    disabled={loading}
                  >
                    <span>↻</span> {loading ? "Atualizando..." : "Atualizar"}
                  </button>
                  <button
                    type="button"
                    className="survey-action primary"
                    onClick={exportCsv}
                    disabled={!responses.length}
                  >
                    <span>↓</span> Exportar
                    <span className="survey-export-desktop"> CSV / Excel</span>
                  </button>
                </div>
              </div>

              <div className="survey-ranking-grid">
                {renderRanking("🏛️ Deputados Estaduais Mais Votados", stateRanking, "state")}
                {renderRanking("🇧🇷 Deputados Federais Mais Votados", federalRanking, "federal")}
              </div>

              <section className="wt-card survey-district-card">
                <div className="wt-card-title survey-card-title">📍 Participação e Respostas por Bairro</div>
                {districtRanking.length === 0 ? (
                  <div className="survey-empty">Nenhum bairro com respostas registradas ainda.</div>
                ) : (
                  <div className="survey-district-list">
                    {districtRanking.map((d) => (
                      <div className="survey-district-row" key={d.district}>
                        <div className="survey-district-info">
                          <strong>{d.district}</strong>
                          <span>{d.total} respostas</span>
                        </div>
                        <div className="survey-district-track">
                          <div
                            className="survey-district-fill"
                            style={{ width: `${Math.max(5, (d.total / maxDistrictTotal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "messages" && (
            <div className="survey-message-list">
              {responses.length === 0 ? (
                <div className="survey-empty survey-empty-large">
                  Nenhuma resposta recebida ainda. Dispare a enquete para começar a coletar os votos!
                </div>
              ) : (
                responses.map((item, index) => (
                  <article className="survey-message-card" key={`${item.phone}-${index}`}>
                    <div className="survey-message-header">
                      <div className="survey-contact">
                        <div className="survey-avatar">
                          {(item.contactName || "E").charAt(0).toUpperCase()}
                        </div>
                        <div className="survey-contact-copy">
                          <strong>{item.contactName || "Eleitor(a)"}</strong>
                          <small>
                            📱 {item.phone} · 🏡 {item.district} ({item.city})
                          </small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="survey-print-btn"
                        onClick={() => downloadPrint(item)}
                      >
                        📸 <span>Baixar Print PNG</span>
                      </button>
                    </div>

                    <div className="survey-message-bubble">
                      &quot;{item.messageText}&quot;
                      <span>
                        {new Date(item.timestamp).toLocaleTimeString("pt-BR")} ✓✓
                      </span>
                    </div>

                    <div className="survey-vote-tags">
                      <b>VOTO APURADO:</b>
                      <span className="state">🏛️ Estadual: {item.stateCandidate}</span>
                      <span className="federal">🇧🇷 Federal: {item.federalCandidate}</span>
                      <span className="sentiment">Intenção: {item.sentiment}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {activeTab === "simulate" && (
            <section className="wt-card survey-manual-card">
              <div className="wt-card-title survey-card-title">
                🧪 Inserir / Testar Resposta de Eleitor Manualmente
              </div>

              <form onSubmit={handleSimulate} className="survey-manual-form">
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

                <button type="submit" className="wt-primary-btn survey-submit-btn">
                  Processar e Computar Voto
                </button>

                {simStatus && (
                  <div
                    className={`survey-status ${simStatus.includes("✅") ? "success" : "error"}`}
                  >
                    {simStatus}
                  </div>
                )}
              </form>
            </section>
          )}
        </div>
      </aside>

      <style jsx>{`
        .survey-drawer {
          width: min(780px, 100vw) !important;
          max-width: 100vw !important;
          overflow: hidden;
        }

        .survey-header {
          flex: 0 0 auto;
        }

        .survey-title-group {
          min-width: 0;
        }

        .survey-logo {
          flex: 0 0 auto;
          font-size: 24px;
        }

        .survey-heading-copy {
          min-width: 0;
        }

        .survey-heading-copy h2,
        .survey-heading-copy p {
          overflow-wrap: anywhere;
        }

        .survey-tabs {
          flex: 0 0 auto;
        }

        .survey-tab {
          min-width: 0;
        }

        .survey-tab-icon {
          margin-right: 5px;
        }

        .survey-tab-mobile {
          display: none;
        }

        .survey-body {
          overflow-x: hidden;
          overscroll-behavior: contain;
        }

        .survey-kpis {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .survey-kpi-card {
          min-width: 0;
        }

        .survey-kpi-card strong {
          overflow-wrap: anywhere;
        }

        .survey-kpi-leader strong {
          font-size: 16px;
          line-height: 1.25;
        }

        .survey-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 12px;
          margin: 14px 0;
        }

        .survey-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .survey-filter label {
          color: var(--wt-text);
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .survey-select {
          width: 220px;
          max-width: 100%;
          padding: 8px 10px;
        }

        .survey-actions {
          display: flex;
          gap: 8px;
          flex: 0 0 auto;
        }

        .survey-action {
          min-height: 38px;
          padding: 7px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          white-space: nowrap;
        }

        .survey-action.secondary {
          border: 1px solid rgba(148, 163, 184, 0.38);
          background: rgba(255, 255, 255, 0.96);
          color: #334155;
        }

        .survey-action.primary {
          border: 1px solid #16a34a;
          background: #16a34a;
          color: #fff;
        }

        .survey-action:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .survey-ranking-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
        }

        .survey-ranking-card,
        .survey-district-card,
        .survey-manual-card {
          min-width: 0;
        }

        .survey-card-title {
          line-height: 1.35;
        }

        .survey-ranking-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .survey-ranking-item {
          min-width: 0;
        }

        .survey-ranking-line {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 5px;
          font-size: 13px;
          font-weight: 700;
        }

        .survey-candidate-name {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .survey-votes {
          flex: 0 0 auto;
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .survey-votes.state {
          color: #16a34a;
        }

        .survey-votes.federal {
          color: #2563eb;
        }

        .survey-progress-track,
        .survey-district-track {
          height: 8px;
          background: rgba(226, 232, 240, 0.88);
          border-radius: 999px;
          overflow: hidden;
        }

        .survey-progress-fill,
        .survey-district-fill {
          height: 100%;
          border-radius: inherit;
          transition: width 0.2s ease;
        }

        .survey-progress-fill.state {
          background: #2563eb;
        }

        .survey-progress-fill.state.leader,
        .survey-district-fill {
          background: #16a34a;
        }

        .survey-progress-fill.federal {
          background: #9333ea;
        }

        .survey-progress-fill.federal.leader {
          background: #2563eb;
        }

        .survey-district-card {
          margin-top: 14px;
        }

        .survey-district-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .survey-district-row {
          min-width: 0;
          padding: 10px 11px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(148, 163, 184, 0.07);
          border-radius: 10px;
        }

        .survey-district-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          font-size: 12px;
        }

        .survey-district-info strong {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .survey-district-info span {
          flex: 0 0 auto;
          color: #22c55e;
          font-weight: 750;
          white-space: nowrap;
        }

        .survey-district-track {
          height: 6px;
        }

        .survey-empty {
          color: var(--wt-text-muted);
          font-size: 13px;
          padding: 16px 0;
          text-align: center;
        }

        .survey-empty-large {
          padding: 30px 16px;
        }

        .survey-message-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .survey-message-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
          gap: 10px;
          color: #111827;
          min-width: 0;
        }

        .survey-message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .survey-contact {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .survey-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #25d366;
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 15px;
          flex: 0 0 auto;
        }

        .survey-contact-copy {
          min-width: 0;
        }

        .survey-contact-copy strong,
        .survey-contact-copy small {
          display: block;
          overflow-wrap: anywhere;
        }

        .survey-contact-copy strong {
          font-size: 14px;
        }

        .survey-contact-copy small {
          color: #64748b;
          font-size: 11px;
          margin-top: 2px;
        }

        .survey-print-btn {
          border: none;
          border-radius: 8px;
          background: #1e293b;
          color: #fff;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          flex: 0 0 auto;
        }

        .survey-message-bubble {
          background: #dcf8c6;
          border: 1px solid #c3e6cb;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: #111827;
          position: relative;
          max-width: 92%;
          overflow-wrap: anywhere;
        }

        .survey-message-bubble > span {
          display: block;
          text-align: right;
          font-size: 10px;
          color: #6b7280;
          margin-top: 6px;
        }

        .survey-vote-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          padding-top: 4px;
        }

        .survey-vote-tags > b {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
        }

        .survey-vote-tags > span {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .survey-vote-tags .state {
          background: rgba(22, 163, 74, 0.1);
          color: #15803d;
        }

        .survey-vote-tags .federal {
          background: rgba(37, 99, 235, 0.1);
          color: #1d4ed8;
        }

        .survey-vote-tags .sentiment {
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .survey-manual-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .survey-status {
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .survey-status.success {
          background: rgba(34, 197, 94, 0.15);
          color: #15803d;
        }

        .survey-status.error {
          background: #fee2e2;
          color: #b91c1c;
        }

        @media (max-width: 640px) {
          .survey-drawer {
            width: 100vw !important;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0 !important;
          }

          .survey-header {
            padding: 14px 14px 12px !important;
            min-height: 88px;
            align-items: flex-start !important;
            gap: 8px;
          }

          .survey-title-group {
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .survey-logo {
            width: 38px !important;
            height: 38px !important;
            font-size: 20px;
            margin-top: 1px;
          }

          .survey-heading-copy h2 {
            margin: 0;
            font-size: 17px !important;
            line-height: 1.2;
            letter-spacing: -0.2px;
          }

          .survey-heading-copy p {
            margin: 5px 0 0;
            font-size: 11px !important;
            line-height: 1.35;
            max-width: 260px;
          }

          .survey-close {
            width: 36px !important;
            height: 36px !important;
            min-width: 36px;
            margin-top: 0;
          }

          .survey-tabs {
            display: grid !important;
            grid-template-columns: 1fr 1.18fr 0.82fr;
            gap: 0 !important;
            overflow: visible !important;
          }

          .survey-tab {
            min-height: 58px !important;
            padding: 8px 5px !important;
            font-size: 11px !important;
            line-height: 1.18;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 3px;
            white-space: normal !important;
          }

          .survey-tab-icon {
            margin: 0;
            font-size: 15px;
            line-height: 1;
          }

          .survey-tab-desktop,
          .survey-export-desktop {
            display: none;
          }

          .survey-tab-mobile {
            display: inline;
          }

          .survey-body {
            padding: 14px 12px calc(24px + env(safe-area-inset-bottom)) !important;
          }

          .survey-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 9px;
            margin: 0;
          }

          .survey-kpi-card {
            min-height: 96px;
            padding: 12px 10px !important;
            justify-content: center;
            text-align: center;
          }

          .survey-kpi-card strong {
            font-size: 24px !important;
            line-height: 1.1;
          }

          .survey-kpi-leader strong {
            font-size: 16px !important;
            line-height: 1.25;
          }

          .survey-kpi-card span {
            font-size: 11px !important;
            line-height: 1.3;
          }

          .survey-toolbar {
            display: block;
            margin: 14px 0 16px;
          }

          .survey-filter {
            display: block;
          }

          .survey-filter label {
            display: block;
            margin: 0 0 6px 2px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.45px;
            color: var(--wt-text-muted);
          }

          .survey-select {
            width: 100%;
            min-height: 42px;
            padding: 9px 11px;
          }

          .survey-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 9px;
          }

          .survey-action {
            width: 100%;
            min-height: 42px;
            padding: 8px 10px;
            font-size: 12px;
          }

          .survey-ranking-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 11px;
          }

          .survey-ranking-card,
          .survey-district-card,
          .survey-manual-card {
            padding: 14px !important;
            border-radius: 12px !important;
          }

          .survey-card-title {
            font-size: 14px !important;
            margin-bottom: 13px !important;
          }

          .survey-ranking-list {
            gap: 13px;
          }

          .survey-ranking-line {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: end;
            font-size: 12px;
          }

          .survey-candidate-name {
            line-height: 1.25;
          }

          .survey-votes {
            font-size: 11px;
          }

          .survey-progress-track {
            height: 7px;
          }

          .survey-district-card {
            margin-top: 11px;
          }

          .survey-district-list {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .survey-district-row {
            padding: 10px 11px;
          }

          .survey-district-info {
            font-size: 12px;
          }

          .survey-message-card {
            padding: 12px;
            border-radius: 12px;
          }

          .survey-message-header {
            align-items: flex-start;
          }

          .survey-contact {
            align-items: flex-start;
          }

          .survey-avatar {
            width: 34px;
            height: 34px;
          }

          .survey-contact-copy strong {
            font-size: 13px;
          }

          .survey-contact-copy small {
            font-size: 10px;
            line-height: 1.35;
          }

          .survey-print-btn {
            width: 36px;
            height: 36px;
            padding: 0;
            justify-content: center;
            font-size: 15px;
          }

          .survey-print-btn span {
            display: none;
          }

          .survey-message-bubble {
            max-width: 100%;
            font-size: 13px;
          }

          .survey-vote-tags {
            gap: 6px;
          }

          .survey-vote-tags > b {
            width: 100%;
          }

          .survey-vote-tags > span {
            max-width: 100%;
            font-size: 11px;
          }

          .survey-submit-btn {
            width: 100%;
            min-height: 44px;
          }
        }

        @media (max-width: 360px) {
          .survey-heading-copy h2 {
            font-size: 15px !important;
          }

          .survey-heading-copy p {
            font-size: 10px !important;
          }

          .survey-tab {
            font-size: 10px !important;
          }

          .survey-kpi-card {
            min-height: 92px;
          }

          .survey-kpi-leader strong {
            font-size: 14px !important;
          }

          .survey-ranking-line {
            grid-template-columns: 1fr;
            gap: 3px;
          }

          .survey-votes {
            text-align: left;
          }
        }
      `}</style>
    </>
  );
}
