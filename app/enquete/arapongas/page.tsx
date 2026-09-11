"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type RankingItem = {
  candidate: string;
  votes: number;
  percentage: number;
};

type PollResults = {
  totalResponses: number;
  stateRanking: RankingItem[];
  federalRanking: RankingItem[];
};

const stateCandidateNames: Record<string, string> = {
  sergio_onofre: "Sergio Onofre",
  bazana: "Bazana",
  nenhum_indeciso: "Nenhum / Indeciso",
};

const federalCandidateNames: Record<string, string> = {
  pedro_lupion: "Pedro Lupion",
  luciano_ducci: "Luciano Ducci",
  ricardo_barros: "Ricardo Barros",
  bonin: "Bonin",
  beto_preto: "Beto Preto",
  outro_nome: "Outro nome / Indeciso",
};

const candidatePhotos: Record<string, string> = {
  sergio_onofre:
    "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  bazana:
    "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  pedro_lupion: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204395.jpg",
  luciano_ducci: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  ricardo_barros: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73788.jpg",
  bonin: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  beto_preto: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220698.jpg",
};

const PARTICIPANT_KEY = "vf_poll_arapongas_pid_v1";

function newParticipantId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateParticipantId() {
  try {
    const saved = window.localStorage.getItem(PARTICIPANT_KEY);
    if (saved) return saved;

    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${PARTICIPANT_KEY}=`))
      ?.split("=")[1];
    if (cookie) {
      window.localStorage.setItem(PARTICIPANT_KEY, cookie);
      return cookie;
    }

    const created = newParticipantId();
    window.localStorage.setItem(PARTICIPANT_KEY, created);
    document.cookie = `${PARTICIPANT_KEY}=${created}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
    return created;
  } catch {
    return newParticipantId();
  }
}

function CandidateAvatar({ candidate, size = 52 }: { candidate: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = candidatePhotos[candidate];

  if (!photo || failed) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          borderRadius: "50%",
          background: "linear-gradient(145deg, #e2e8f0, #cbd5e1)",
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px #cbd5e1",
          display: "grid",
          placeItems: "center",
          color: "#64748b",
          fontSize: `${Math.max(16, Math.round(size * 0.38))}px`,
          fontWeight: 800,
        }}
      >
        ?
      </div>
    );
  }

  return (
    <img
      src={photo}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        borderRadius: "50%",
        objectFit: "cover",
        objectPosition: "center",
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px #cbd5e1, 0 3px 10px rgba(15,23,42,0.12)",
        background: "#e2e8f0",
      }}
    />
  );
}

function RankingCard({
  title,
  icon,
  ranking,
  names,
}: {
  title: string;
  icon: string;
  ranking: RankingItem[];
  names: Record<string, string>;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "16px", marginTop: "14px", textAlign: "left" }}>
      <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e293b", marginBottom: "14px" }}>
        {icon} {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {ranking.map((item, index) => (
          <div key={item.candidate} style={{ display: "flex", gap: "11px", alignItems: "center" }}>
            <CandidateAvatar candidate={item.candidate} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", marginBottom: "6px" }}>
                <span style={{ color: "#334155", fontSize: "13px", fontWeight: index === 0 && item.votes > 0 ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {index === 0 && item.votes > 0 ? "🏆 " : ""}{names[item.candidate] || item.candidate}
                </span>
                <strong style={{ color: "#1d4ed8", fontSize: "14px", whiteSpace: "nowrap" }}>{item.percentage.toFixed(1)}%</strong>
              </div>
              <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, item.percentage))}%`,
                    background: "linear-gradient(90deg, #2563eb, #1d4ed8)",
                    borderRadius: "999px",
                    transition: "width .35s ease",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnqueteArapongasForm() {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<PollResults | null>(null);

  const loadResults = async () => {
    try {
      const response = await fetch("/api/enquete/arapongas-preview", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setResults({
        totalResponses: Number(data.totalResponses || 0),
        stateRanking: Array.isArray(data.stateRanking) ? data.stateRanking : [],
        federalRanking: Array.isArray(data.federalRanking) ? data.federalRanking : [],
      });
    } catch {
      // O resultado pode ser recarregado na próxima abertura.
    }
  };

  useEffect(() => {
    const p = searchParams?.get("tel") || searchParams?.get("phone") || searchParams?.get("p") || "";
    const n = searchParams?.get("nome") || searchParams?.get("name") || searchParams?.get("n") || "";
    setPhone(p);
    setName(n);

    const id = getOrCreateParticipantId();
    setParticipantId(id);

    const checkParticipation = async () => {
      try {
        const response = await fetch("/api/enquete/arapongas-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", participantId: id, phone: p }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.alreadyAnswered) {
            setAlreadyAnswered(true);
            setSubmitted(true);
            await loadResults();
          }
        }
      } catch {
        // Se a checagem inicial falhar, a API ainda valida duplicidade no envio.
      } finally {
        setChecking(false);
      }
    };

    void checkParticipation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q1 || !q2 || !q3) {
      setErrorMsg("Por favor, responda a todas as 3 perguntas.");
      return;
    }
    if (!participantId) {
      setErrorMsg("Não foi possível validar sua participação. Atualize a página e tente novamente.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/enquete/arapongas-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          participantId,
          phone,
          q1,
          q2,
          q3,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409 || data.alreadyAnswered) {
        setAlreadyAnswered(true);
        setSubmitted(true);
        if (data.stateRanking && data.federalRanking) {
          setResults(data as PollResults);
        } else {
          await loadResults();
        }
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Não foi possível registrar sua resposta.");
      }

      setAlreadyAnswered(false);
      setSubmitted(true);
      setResults({
        totalResponses: Number(data.totalResponses || 0),
        stateRanking: Array.isArray(data.stateRanking) ? data.stateRanking : [],
        federalRanking: Array.isArray(data.federalRanking) ? data.federalRanking : [],
      });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Falha ao registrar sua resposta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "grid", placeItems: "center", fontFamily: "'Inter', sans-serif", color: "#475569" }}>
        Verificando sua participação...
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ background: "#0d2342", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", textAlign: "center" }}>
          <img src="/enquete-capa-voto-forte.png" alt="ENQUETE VOTO FORTE PARANÁ" style={{ width: "100%", maxWidth: "480px", height: "auto", display: "block", margin: "0 auto" }} />
        </header>

        <main style={{ maxWidth: "480px", margin: "28px auto 36px", padding: "0 16px", flex: 1, width: "100%", boxSizing: "border-box" }}>
          <div style={{ background: "#fff", borderRadius: "18px", padding: "26px 20px", textAlign: "center", boxShadow: "0 6px 24px rgba(15,23,42,0.08)", border: "1px solid #e2e8f0" }}>
            <div style={{ width: "64px", height: "64px", background: alreadyAnswered ? "#eff6ff" : "#dcfce7", color: alreadyAnswered ? "#2563eb" : "#16a34a", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "30px", margin: "0 auto 16px" }}>
              {alreadyAnswered ? "🔒" : "✓"}
            </div>
            <h2 style={{ fontSize: "22px", color: "#1e293b", margin: "0 0 10px", fontWeight: 800 }}>
              {alreadyAnswered ? "Você já participou desta enquete" : "Obrigado por responder!"}
            </h2>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6, margin: "0" }}>
              {alreadyAnswered
                ? "Sua participação anterior foi reconhecida. Para manter a enquete justa, é permitida apenas uma resposta por participante."
                : `Sua resposta foi registrada com sucesso${name ? `, ${name}` : ""}. Obrigado por contribuir com a enquete de Arapongas.`}
            </p>

            <div style={{ marginTop: "22px", padding: "14px", borderRadius: "12px", background: "#eff6ff", border: "1px solid #bfdbfe" }}>
              <div style={{ color: "#1e40af", fontWeight: 800, fontSize: "16px" }}>Resultado parcial</div>
              <div style={{ color: "#64748b", fontSize: "12px", marginTop: "4px" }}>
                {results?.totalResponses ?? 0} participação{(results?.totalResponses ?? 0) === 1 ? "" : "ões"} válida{(results?.totalResponses ?? 0) === 1 ? "" : "s"} nesta preview
              </div>
            </div>

            {results && (
              <>
                <RankingCard title="Deputado Estadual" icon="🏛️" ranking={results.stateRanking} names={stateCandidateNames} />
                <RankingCard title="Deputado Federal" icon="🇧🇷" ranking={results.federalRanking} names={federalCandidateNames} />
              </>
            )}

            <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.5, margin: "20px 4px 0" }}>
              Resultado parcial de uma enquete online. As porcentagens são calculadas sobre as participações válidas registradas nesta versão de teste.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ background: "#0d2342", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", position: "sticky", top: 0, zIndex: 10, textAlign: "center" }}>
        <img src="/enquete-capa-voto-forte.png" alt="ENQUETE VOTO FORTE PARANÁ" style={{ width: "100%", maxWidth: "480px", height: "auto", display: "block", margin: "0 auto" }} />
      </header>

      <main style={{ maxWidth: "480px", margin: "20px auto 40px", padding: "0 16px", boxSizing: "border-box" }}>
        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
          <p style={{ color: "#475569", fontSize: "14px", lineHeight: 1.5, margin: "0 0 12px" }}>
            Sua opinião é muito importante! Responda a esta rápida enquete sobre Arapongas.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", padding: "10px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: 700, marginBottom: "20px" }}>
            🔒 1 resposta por participante • resultado percentual após o envio
          </div>

          {errorMsg && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <Question
              title="1. Você sabe quem são os candidatos a deputados estaduais e federais por Arapongas?"
              name="q1"
              value={q1}
              setValue={setQ1}
              options={[
                ["sim", "Sim, conheço a maioria"],
                ["alguns", "Conheço apenas alguns"],
                ["nao", "Não conheço nenhum"],
              ]}
            />
            <Question
              title="2. Em quem você votaria para deputado estadual em Arapongas?"
              name="q2"
              value={q2}
              setValue={setQ2}
              showPhotos
              options={[
                ["sergio_onofre", "Sergio Onofre"],
                ["bazana", "Bazana"],
                ["nenhum_indeciso", "Nenhum / Indeciso"],
              ]}
            />
            <Question
              title="3. E para Deputado Federal, em quem você votaria?"
              name="q3"
              value={q3}
              setValue={setQ3}
              showPhotos
              options={[
                ["pedro_lupion", "Pedro Lupion"],
                ["luciano_ducci", "Luciano Ducci"],
                ["ricardo_barros", "Ricardo Barros"],
                ["bonin", "Bonin"],
                ["beto_preto", "Beto Preto"],
                ["outro_nome", "Outro nome / Indeciso"],
              ]}
            />

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", background: loading ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 800, fontSize: "16px", padding: "16px", borderRadius: "12px", border: "none", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}
            >
              {loading ? "Validando e registrando..." : "Enviar Respostas 🚀"}
            </button>

            <p style={{ textAlign: "center", fontSize: "11px", color: "#94a3b8", margin: "-8px 0 0", lineHeight: 1.5 }}>
              A identificação técnica usada para impedir voto duplicado não é exibida nos resultados. Os resultados são apresentados somente de forma agregada.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function Question({
  title,
  name,
  value,
  setValue,
  options,
  showPhotos = false,
}: {
  title: string;
  name: string;
  value: string;
  setValue: (value: string) => void;
  options: [string, string][];
  showPhotos?: boolean;
}) {
  return (
    <div>
      <label style={{ display: "block", color: "#1e293b", fontWeight: 800, fontSize: "15px", marginBottom: "12px", lineHeight: 1.45 }}>
        {title}
      </label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {options.map(([optionValue, label]) => (
          <label
            key={optionValue}
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: showPhotos ? "10px 12px" : "12px 14px", borderRadius: "12px", border: value === optionValue ? "2px solid #2563eb" : "1px solid #e2e8f0", background: value === optionValue ? "#eff6ff" : "#fff", cursor: "pointer", transition: "all .15s ease" }}
          >
            <input type="radio" name={name} value={optionValue} checked={value === optionValue} onChange={() => setValue(optionValue)} style={{ accentColor: "#2563eb", width: "18px", height: "18px", flexShrink: 0 }} required />
            {showPhotos && <CandidateAvatar candidate={optionValue} size={54} />}
            <span style={{ color: "#334155", fontSize: showPhotos ? "14px" : "14px", fontWeight: 700, lineHeight: 1.35 }}>{label}</span>
          </label>
        ))}
      </div>
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
