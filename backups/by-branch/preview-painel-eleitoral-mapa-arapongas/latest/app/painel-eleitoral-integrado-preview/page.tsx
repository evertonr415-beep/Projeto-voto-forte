"use client";

import { useState } from "react";

const MAPA_URL = "https://www.votofortearapongas.com.br";

export default function PainelEleitoralIntegradoPreview() {
  const [loading, setLoading] = useState(true);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#06111f",
        color: "#e5eef8",
        fontFamily: "Inter, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          minHeight: 72,
          padding: "12px 18px",
          borderBottom: "1px solid rgba(56,189,248,.22)",
          background: "#071528",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          position: "sticky",
          top: 0,
          zIndex: 20,
          boxShadow: "0 5px 18px rgba(0,0,0,.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <img
            src="/voto-forte-bandeira-icon.jpg"
            alt="Voto Forte Paraná"
            style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover" }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", letterSpacing: ".08em" }}>
              VOTO FORTE PARANÁ · PREVIEW
            </div>
            <h1 style={{ margin: "3px 0 0", fontSize: 21, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Painel Eleitoral
            </h1>
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(56,189,248,.26)",
            background: "rgba(8,47,73,.7)",
            color: "#7dd3fc",
            borderRadius: 999,
            padding: "7px 11px",
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Arapongas / PR
        </div>
      </header>

      <section style={{ position: "relative", flex: 1, minHeight: "calc(100dvh - 72px)", background: "#020817" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              display: "grid",
              placeItems: "center",
              background: "#06111f",
              color: "#94a3b8",
              fontSize: 14,
            }}
          >
            Carregando Mapa Eleitoral de Arapongas…
          </div>
        )}

        <iframe
          src={MAPA_URL}
          title="Mapa Eleitoral de Arapongas"
          onLoad={() => setLoading(false)}
          allow="fullscreen; geolocation"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            display: "block",
            width: "100%",
            height: "calc(100dvh - 72px)",
            border: 0,
            background: "#06111f",
          }}
        />
      </section>
    </main>
  );
}
