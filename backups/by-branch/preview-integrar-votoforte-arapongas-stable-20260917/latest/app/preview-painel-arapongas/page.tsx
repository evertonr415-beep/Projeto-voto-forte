export default function PreviewPainelArapongasPage() {
  const panelUrl =
    "https://www.votofortearapongas.com.br/desktop-production.html";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#060d19",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          minHeight: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: "rgba(6,13,25,.98)",
          borderBottom: "1px solid rgba(148,163,184,.14)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <strong style={{ color: "#f8fafc", fontSize: 15 }}>
            Preview — Painel Eleitoral integrado
          </strong>
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            Demonstração isolada, sem acesso a dados internos do VOTO FORTE
          </span>
        </div>

        <a
          href={panelUrl}
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
          Abrir sistema original ↗
        </a>
      </header>

      <iframe
        src={panelUrl}
        title="Voto Forte Arapongas"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          width: "100%",
          height: "calc(100dvh - 59px)",
          minHeight: 720,
          border: 0,
          display: "block",
          background: "#ffffff",
          flex: 1,
        }}
      />
    </main>
  );
}
