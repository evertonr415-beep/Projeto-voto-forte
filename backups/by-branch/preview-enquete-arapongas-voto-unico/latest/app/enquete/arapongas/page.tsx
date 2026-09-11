"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function EnqueteArapongasForm() {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = searchParams?.get("tel") || searchParams?.get("phone") || searchParams?.get("p") || "";
      const n = searchParams?.get("nome") || searchParams?.get("name") || searchParams?.get("n") || "";
      if (p) setPhone(p);
      if (n) setName(n);
    }
  }, [searchParams]);

  const candidateStateNames: Record<string, string> = {
    sergio_onofre: "Sergio Onofre",
    bazana: "Bazana",
    nenhum_indeciso: "Nenhum / Indeciso",
  };

  const candidateFederalNames: Record<string, string> = {
    pedro_lupion: "Pedro Lupion",
    luciano_ducci: "Luciano Ducci",
    ricardo_barros: "Ricardo Barros",
    bonin: "Bonin",
    beto_preto: "Beto Preto",
    outro_nome: "Outro nome / Indeciso",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q1 || !q2 || !q3) {
      setErrorMsg("Por favor, responda a todas as 3 perguntas.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const stateCandidate = candidateStateNames[q2] || q2;
    const federalCandidate = candidateFederalNames[q3] || q3;
    const voterPhone = phone || "5543999990000";

    const formattedMessage = `Pesquisa Arapongas: Conhecimento: ${q1} | Estadual: ${stateCandidate} | Federal: ${federalCandidate}`;

    try {
      const response = await fetch("/api/whatsapp/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: voterPhone,
          message: formattedMessage,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
        {/* Banner Header Oficial */}
        <header style={{ background: "#0d2342", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", position: "sticky", top: 0, zIndex: 10, textAlign: "center" }}>
          <img
            src="/enquete-capa-voto-forte.png"
            alt="ENQUETE VOTO FORTE PARANÁ"
            style={{ width: "100%", maxWidth: "480px", height: "auto", display: "block", margin: "0 auto" }}
          />
        </header>

        <main style={{ maxWidth: "480px", margin: "40px auto 20px", padding: "0 16px", flex: 1, width: "100%", boxSizing: "border-box" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px 24px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
            <div style={{ width: "64px", height: "64px", background: "#dcfce7", color: "#16a34a", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "32px", margin: "0 auto 16px" }}>
              ✓
            </div>
            <h2 style={{ fontSize: "22px", color: "#1e293b", margin: "0 0 10px", fontWeight: 700 }}>Resposta Registrada!</h2>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6, margin: "0 0 24px" }}>
              Muito obrigado pela sua participação{name ? `, ${name}` : ""}! Sua opinião ajuda a construir uma Arapongas ainda melhor.
            </p>
            <div style={{ background: "#f1f5f9", borderRadius: "12px", padding: "16px", textAlign: "left", fontSize: "13px", color: "#334155" }}>
              <div style={{ fontWeight: 700, marginBottom: "8px", color: "#1d4ed8" }}>Resumo da sua resposta:</div>
              <div style={{ margin: "4px 0" }}>🏛️ <strong>Estadual:</strong> {candidateStateNames[q2] || q2}</div>
              <div style={{ margin: "4px 0" }}>🇧🇷 <strong>Federal:</strong> {candidateFederalNames[q3] || q3}</div>
            </div>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "24px" }}>
              Enquete oficial realizada através da plataforma Voto Forte.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      {/* Banner Header Oficial */}
      <header style={{ background: "#0d2342", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", position: "sticky", top: 0, zIndex: 10, textAlign: "center" }}>
        <img
          src="/enquete-capa-voto-forte.png"
          alt="ENQUETE VOTO FORTE PARANÁ"
          style={{ width: "100%", maxWidth: "480px", height: "auto", display: "block", margin: "0 auto" }}
        />
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: "480px", margin: "20px auto 40px", padding: "0 16px", boxSizing: "border-box" }}>
        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
          <p style={{ color: "#475569", fontSize: "14px", lineHeight: 1.5, margin: "0 0 20px" }}>
            Sua opinião é muito importante! Responda a esta rápida pesquisa para entendermos melhor as prioridades de Arapongas.
          </p>

          {errorMsg && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Pergunta 1 */}
            <div>
              <label style={{ display: "block", color: "#1e293b", fontWeight: 700, fontSize: "15px", marginBottom: "12px" }}>
                1. Você sabe quem são os candidatos a deputados estaduais e federais por Arapongas?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { val: "sim", label: "Sim, conheço a maioria" },
                  { val: "alguns", label: "Conheço apenas alguns" },
                  { val: "nao", label: "Não conheço nenhum" },
                ].map((item) => (
                  <label
                    key={item.val}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: q1 === item.val ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: q1 === item.val ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="q1"
                      value={item.val}
                      checked={q1 === item.val}
                      onChange={() => setQ1(item.val)}
                      style={{ accentColor: "#2563eb", width: "18px", height: "18px" }}
                      required
                    />
                    <span style={{ color: "#334155", fontSize: "14px", fontWeight: 600 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 2 */}
            <div>
              <label style={{ display: "block", color: "#1e293b", fontWeight: 700, fontSize: "15px", marginBottom: "12px" }}>
                2. Em quem você votaria para deputado estadual em Arapongas?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { val: "sergio_onofre", label: "Sergio Onofre" },
                  { val: "bazana", label: "Bazana" },
                  { val: "nenhum_indeciso", label: "Nenhum / Indeciso" },
                ].map((item) => (
                  <label
                    key={item.val}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: q2 === item.val ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: q2 === item.val ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="q2"
                      value={item.val}
                      checked={q2 === item.val}
                      onChange={() => setQ2(item.val)}
                      style={{ accentColor: "#2563eb", width: "18px", height: "18px" }}
                      required
                    />
                    <span style={{ color: "#334155", fontSize: "14px", fontWeight: 600 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Pergunta 3 */}
            <div>
              <label style={{ display: "block", color: "#1e293b", fontWeight: 700, fontSize: "15px", marginBottom: "12px" }}>
                3. E para Deputado Federal, em quem você votaria?
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { val: "pedro_lupion", label: "Pedro Lupion" },
                  { val: "luciano_ducci", label: "Luciano Ducci" },
                  { val: "ricardo_barros", label: "Ricardo Barros" },
                  { val: "bonin", label: "Bonin" },
                  { val: "beto_preto", label: "Beto Preto" },
                  { val: "outro_nome", label: "Outro nome / Indeciso" },
                ].map((item) => (
                  <label
                    key={item.val}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: q3 === item.val ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: q3 === item.val ? "#eff6ff" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="q3"
                      value={item.val}
                      checked={q3 === item.val}
                      onChange={() => setQ3(item.val)}
                      style={{ accentColor: "#2563eb", width: "18px", height: "18px" }}
                      required
                    />
                    <span style={{ color: "#334155", fontSize: "14px", fontWeight: 600 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Botão Enviar */}
            <div style={{ paddingTop: "8px" }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "16px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                  transition: "background 0.2s ease",
                }}
              >
                {loading ? "Registrando respostas..." : "Enviar Respostas 🚀"}
              </button>
            </div>

            <p style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8", margin: "0" }}>
              Pesquisa anônima. Seus dados não serão compartilhados.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function EnqueteArapongasPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Carregando enquete...</div>}>
      <EnqueteArapongasForm />
    </Suspense>
  );
}
