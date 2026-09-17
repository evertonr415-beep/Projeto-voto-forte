"use client";

import React, { useState } from "react";

const ARAPONGAS_PANEL_URL =
  "https://www.votofortearapongas.com.br/desktop-production.html";

export default function ElectoralPanelClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
} = {}) {
  const [loaded, setLoaded] = useState(false);

  const handleBack = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
      return;
    }
    window.dispatchEvent(new CustomEvent("voto-forte:navigate-overview"));
  };

  return (
    <section
      style={{
        width: "100%",
        minHeight: "calc(100dvh - 24px)",
        display: "flex",
        flexDirection: "column",
        background: "#060d19",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(148,163,184,.14)",
      }}
      aria-label="Painel Eleitoral integrado"
    >
      <header
        style={{
          minHeight: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: "rgba(6,13,25,.96)",
          borderBottom: "1px solid rgba(148,163,184,.12)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <strong style={{ color: "#f8fafc", fontSize: 15 }}>
            Painel Eleitoral — Voto Forte Arapongas
          </strong>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            Ambiente integrado ao VOTO FORTE
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              border: "1px solid rgba(148,163,184,.2)",
              background: "rgba(15,23,42,.84)",
              color: "#e2e8f0",
              borderRadius: 10,
              padding: "8px 11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Voltar ao Dashboard
          </button>
          <a
            href={ARAPONGAS_PANEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              border: "1px solid rgba(56,189,248,.28)",
              background: "rgba(2,132,199,.16)",
              color: "#bae6fd",
              borderRadius: 10,
              padding: "8px 11px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Abrir em tela cheia ↗
          </a>
        </div>
      </header>

      <div style={{ position: "relative", flex: 1, minHeight: "calc(100dvh - 92px)" }}>
        {!loaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#cbd5e1",
              background: "#060d19",
              zIndex: 1,
              padding: 24,
              textAlign: "center",
            }}
          >
            Carregando Voto Forte Arapongas…
          </div>
        )}

        <iframe
          src={ARAPONGAS_PANEL_URL}
          title="Voto Forte Arapongas"
          onLoad={() => setLoaded(true)}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          style={{
            width: "100%",
            height: "calc(100dvh - 92px)",
            minHeight: 720,
            border: 0,
            display: "block",
            background: "#ffffff",
          }}
        />
      </div>
    </section>
  );
}
