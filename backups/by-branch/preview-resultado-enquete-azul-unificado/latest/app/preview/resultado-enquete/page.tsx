export default function PreviewResultadoEnquete() {
  const sample = [
    { label: "Boa", pct: "54,8%", votes: "5.497 votos", width: 54.8 },
    { label: "Ruim", pct: "24,2%", votes: "2.426 votos", width: 24.2 },
    { label: "Média", pct: "21,1%", votes: "2.117 votos", width: 21.1 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f3f6fb", fontFamily: "Inter, Arial, sans-serif", color: "#243247" }}>
      <div style={{ background: "#0d2342" }}>
        <header
          style={{
            width: "100%",
            background: "#0d2342",
            textAlign: "center",
          }}
        >
          <img
            src="/enquete-capa-voto-forte.png"
            alt="Enquete Voto Forte Paraná"
            style={{ width: "100%", maxWidth: 700, display: "block", margin: "0 auto" }}
          />
        </header>

        <section
          style={{
            background: "#0d2342",
            color: "#fff",
            padding: "20px 18px 50px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 540, margin: "0 auto" }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                margin: "0 auto 12px",
                display: "grid",
                placeItems: "center",
                background: "#16b874",
                fontSize: 31,
                fontWeight: 900,
              }}
            >
              ✓
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 23, lineHeight: 1.18, fontWeight: 900 }}>
              Voto registrado com sucesso
            </h1>
            <p style={{ margin: 0, color: "#d7e2ef", fontSize: 13, lineHeight: 1.5 }}>
              Obrigado por participar. Abaixo estão os percentuais atualizados da enquete.
            </p>
          </div>
        </section>
      </div>

      <main style={{ maxWidth: 540, margin: "-28px auto 42px", padding: "0 12px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 8px 24px rgba(15,23,42,.08)",
            border: "1px solid #e4ebf3",
          }}
        >
          <div>
            <div style={{ color: "#8290a5", fontSize: 11, fontWeight: 900, letterSpacing: ".08em" }}>PARTICIPAÇÕES</div>
            <div style={{ marginTop: 4, color: "#0e467d", fontSize: 31, fontWeight: 950 }}>10.040</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#52637a", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#19b67a", boxShadow: "0 0 0 6px #e7f8f1" }} />
            <span>Resultados<br />atualizados</span>
          </div>
        </div>

        <section style={{ marginTop: 18, background: "#fff", border: "1px solid #dfe7f0", borderRadius: 18, overflow: "hidden", boxShadow: "0 3px 14px rgba(15,23,42,.04)" }}>
          <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #edf2f7" }}>
            <strong style={{ color: "#26364d", fontSize: 17 }}>Avaliação da gestão</strong>
            <span style={{ color: "#8b99ad", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>RESULTADO ATUAL</span>
          </div>
          <div style={{ padding: "8px 18px 14px" }}>
            {sample.map((item) => (
              <div key={item.label} style={{ padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                  <strong style={{ color: "#334155", fontSize: 14 }}>{item.label}</strong>
                  <div style={{ textAlign: "right", minWidth: 78 }}>
                    <div style={{ color: "#174f8c", fontSize: 16, fontWeight: 900 }}>{item.pct}</div>
                    <div style={{ color: "#9aa6b6", fontSize: 11, marginTop: 2 }}>{item.votes}</div>
                  </div>
                </div>
                <div style={{ height: 8, marginTop: 8, background: "#edf2f7", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.width}%`, borderRadius: 999, background: "linear-gradient(90deg,#2563eb,#38a9dc)" }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
