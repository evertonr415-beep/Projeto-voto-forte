"use client";

import React from "react";
import WhatsappHumanizedBroadcaster from "../whatsapp-humanized-broadcaster";
import "../whatsapp-humanized-broadcaster.css";

export default function DisparadorHumanizadoPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080f1d",
        color: "#f8fafc",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "800px" }}>
        {/* Header do Robô */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "16px",
            marginBottom: "20px",
            borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "1.3rem",
                fontWeight: 900,
                color: "#fff",
              }}
            >
              <span>🤖</span>
              <span>Robô Disparador Humanizado</span>
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  padding: "3px 8px",
                  borderRadius: "999px",
                  fontWeight: 800,
                }}
              >
                Anti-Ban Ativo
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
              Simulador de digitação real, leitura de QR Code e fila segura de 150 disparos/dia · Arapongas-PR
            </p>
          </div>

          <a
            href="/sistema-completo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              color: "#cbd5e1",
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ← Painel Principal
          </a>
        </header>

        {/* Componente do Robô */}
        <WhatsappHumanizedBroadcaster />
      </div>
    </div>
  );
}
