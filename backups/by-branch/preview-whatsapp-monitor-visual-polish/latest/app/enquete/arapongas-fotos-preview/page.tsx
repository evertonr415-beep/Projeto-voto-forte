"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type RankingItem = { candidate: string; votes: number; percentage: number };
type PollResults = {
  totalResponses: number;
  presidentRanking: RankingItem[];
  governorRanking: RankingItem[];
  federalRanking: RankingItem[];
  stateRanking: RankingItem[];
};
type Candidate = { id: string; name: string; party?: string };
type Option = { value: string; label: string; party?: string; candidate?: boolean };

const presidentCandidates: Candidate[] = [
  { id: "lula_pt", name: "Lula", party: "PT" },
  { id: "flavio_bolsonaro_pl", name: "Flávio Bolsonaro", party: "PL" },
  { id: "augusto_cury_avante", name: "Augusto Cury", party: "Avante" },
  { id: "renan_santos_missao", name: "Renan Santos", party: "Missão" },
  { id: "ronaldo_caiado_psd", name: "Ronaldo Caiado", party: "PSD" },
  { id: "romeu_zema_novo", name: "Romeu Zema", party: "Novo" },
];

const governorCandidates: Candidate[] = [
  { id: "sergio_moro_pl", name: "Sergio Moro", party: "PL" },
  { id: "requiao_filho_pdt", name: "Requião Filho", party: "PDT" },
  { id: "sandro_alex_psd", name: "Sandro Alex", party: "PSD" },
  { id: "luiz_franca_missao", name: "Luiz França", party: "Missão" },
];

const federalCandidates: Candidate[] = [
  { id: "neto_santos", name: "Neto Santos", party: "NOVO" },
  { id: "ricardo_barros", name: "Ricardo Barros", party: "PP" },
  { id: "pedro_lupion", name: "Pedro Lupion", party: "REPUBLICANOS" },
  { id: "beto_preto", name: "Beto Preto", party: "PSD" },
  { id: "luciano_ducci", name: "Luciano Ducci", party: "PSB" },
  { id: "bonin", name: "Bonin", party: "REPUBLICANOS" },
  { id: "marco_brasil", name: "Marco Brasil", party: "PP" },
  { id: "santin_roveda", name: "Santin Roveda", party: "UNIÃO" },
];

const stateCandidates: Candidate[] = [
  { id: "pedro_paulo_bazana", name: "Pedro Paulo Bazana", party: "PSD" },
  { id: "sergio_onofre", name: "Sérgio Onofre", party: "PSD" },
  { id: "aline_franzon", name: "Aline Franzon", party: "MISSÃO" },
  { id: "delegado_jacovos", name: "Delegado Jacovós", party: "PL" },
  { id: "cobra_reporter", name: "Cobra Repórter", party: "PSD" },
];

const specialCandidates: Candidate[] = [
  { id: "outro", name: "Outro" },
  { id: "branco_nulo", name: "Branco/Nulo" },
  { id: "ainda_nao_sei", name: "Ainda não sei" },
];

const allCandidateInfo: Record<string, Candidate> = Object.fromEntries(
  [...presidentCandidates, ...governorCandidates, ...federalCandidates, ...stateCandidates, ...specialCandidates].map((c) => [c.id, c]),
);

const candidatePhotos: Record<string, string> = {
  lula_pt: "https://www.gov.br/planejamento/pt-br/assuntos/noticias/2026/imagens/55156120202_eb131de887_o.jpg",
  flavio_bolsonaro_pl: "https://legis.senado.leg.br/senadores/fotos-oficiais/5894",
  augusto_cury_avante: "https://media.gcmais.com.br/site-assets/articles/politica/augusto-cury--rimg.webp",
  renan_santos_missao: "https://static.poder360.com.br/2025/11/Renan-Santos-se-colocou-como-pre-candidato-para-presidencia-para-eleicoes-de-2026-2048x1152.jpg",
  ronaldo_caiado_psd: "https://www.portalolavodutra.com.br/uploads/69ca9a1f5783a.webp",
  romeu_zema_novo: "https://eleicoes.patria.agr.br/assets/romeu-zema-60E3nFzS.png",
  sergio_moro_pl: "https://www.adjoriparana.com.br/uploads/images/2025/07/sergio-moro-lidera-corrida-para-o-governo-do-parana-em-2026-aponta-pesquisa-3887.webp",
  requiao_filho_pdt: "https://media.extraguarapuava.com.br/2026/03/c116e75b-requiao-filho--scaled.jpg",
  sandro_alex_psd: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/160621.jpg",
  luiz_franca_missao: "https://busaocuritiba.com/wp-content/uploads/2025/09/Luiz-Franca-pre-candidato-ao-governo-do-Parana-pelo-MBL-1600x900.jpg",
  neto_santos: "https://cdn.tnonline.com.br/eleicoes/2026/pr/fotos/FPR160002542284_div.jpg",
  ricardo_barros: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73788.jpg",
  pedro_lupion: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204395.jpg",
  beto_preto: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220698.jpg",
  luciano_ducci: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  bonin: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  marco_brasil: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/219585.jpg",
  santin_roveda: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/236518.jpg",
  pedro_paulo_bazana: "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  sergio_onofre: "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  aline_franzon: "https://operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/3d/3d52390db67b93f272fe787733302a2aa3c14fffa9028456a5cc4388f595cffc.jpg",
  delegado_jacovos: "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  cobra_reporter: "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
};

const PARTICIPANT_KEY = "vf_poll_arapongas_photos_preview_pid_v1";
const API_URL = "/api/enquete/arapongas-fotos-preview";

function newParticipantId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateParticipantId() {
  try {
    const saved = window.localStorage.getItem(PARTICIPANT_KEY);
    if (saved) return saved;
    const created = newParticipantId();
    window.localStorage.setItem(PARTICIPANT_KEY, created);
    document.cookie = `${PARTICIPANT_KEY}=${created}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
    return created;
  } catch {
    return newParticipantId();
  }
}

function initialsFor(candidate: string) {
  if (candidate === "outro") return "+";
  if (candidate === "branco_nulo") return "—";
  if (candidate === "ainda_nao_sei") return "?";
  const label = allCandidateInfo[candidate]?.name || candidate;
  return label.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function CandidateAvatar({ candidate, size = 54 }: { candidate: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const photo = candidatePhotos[candidate];
  const info = allCandidateInfo[candidate];

  if (!photo || failed) {
    return (
      <div aria-hidden="true" style={{ width: size, height: size, minWidth: size, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(145deg,#eff6ff,#dbeafe)", border: "2px solid #fff", boxShadow: "0 0 0 1px #bfdbfe", color: "#1d4ed8", fontSize: Math.max(13, Math.round(size * 0.3)), fontWeight: 900 }}>
        {initialsFor(candidate)}
      </div>
    );
  }

  return (
    <img src={photo} alt={info?.name || "Candidato"} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={{ width: size, height: size, minWidth: size, borderRadius: "50%", objectFit: "cover", objectPosition: "center", border: "2px solid #fff", boxShadow: "0 0 0 1px #cbd5e1,0 3px 10px rgba(15,23,42,.12)", background: "#e2e8f0" }} />
  );
}

function cleanQuestionTitle(title: string) {
  const match = title.match(/^(\d+)\.\s*(.*)$/);
  return match ? { number: match[1], text: match[2] } : { number: "", text: title };
}

function Question({ title, name, value, setValue, options }: { title: string; name: string; value: string; setValue: (value: string) => void; options: Option[] }) {
  const heading = cleanQuestionTitle(title);
  return (
    <section style={{ padding: "20px 0 4px", borderTop: "1px solid #eef2f7" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        {heading.number && <span style={{ background: "#e8f0ff", color: "#1d4ed8", borderRadius: 999, padding: "5px 9px", fontSize: 10, fontWeight: 900, letterSpacing: ".06em" }}>PERGUNTA {heading.number}</span>}
      </div>
      <div style={{ color: "#172033", fontWeight: 900, fontSize: 15, marginBottom: 13, lineHeight: 1.48 }}>{heading.text}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <label key={`${name}-${option.value}`} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, minHeight: option.candidate ? 68 : 54, padding: option.candidate ? "9px 12px" : "11px 13px", paddingRight: 48, borderRadius: 15, border: selected ? "2px solid #2563eb" : "1px solid #dde4ee", background: selected ? "linear-gradient(135deg,#f5f9ff,#eef5ff)" : "#fff", boxShadow: selected ? "0 5px 16px rgba(37,99,235,.11)" : "0 1px 2px rgba(15,23,42,.03)", cursor: "pointer", transition: "border-color .15s ease, background .15s ease, box-shadow .15s ease" }}>
              <input type="radio" name={name} value={option.value} checked={selected} onChange={() => setValue(option.value)} required style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />
              {option.candidate && <CandidateAvatar candidate={option.value} size={52} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: selected ? "#153b80" : "#334155", fontSize: option.candidate ? 14.5 : 14, lineHeight: 1.35, fontWeight: selected ? 900 : 700 }}>{option.label}</div>
                {option.candidate && option.party && <span style={{ display: "inline-block", marginTop: 4, borderRadius: 999, background: selected ? "#dbeafe" : "#f1f5f9", color: selected ? "#1d4ed8" : "#64748b", padding: "3px 7px", fontSize: 10, lineHeight: 1, fontWeight: 850 }}>{option.party}</span>}
              </div>
              <span aria-hidden="true" style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", width: 25, height: 25, borderRadius: "50%", display: "grid", placeItems: "center", border: selected ? "2px solid #2563eb" : "1.5px solid #cbd5e1", background: selected ? "#2563eb" : "#fff", color: "#fff", fontSize: 14, fontWeight: 900, boxShadow: selected ? "0 3px 8px rgba(37,99,235,.2)" : "none" }}>{selected ? "✓" : ""}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function RankingCard({ title, icon, ranking }: { title: string; icon: string; ranking: RankingItem[] }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 15, marginTop: 14, textAlign: "left", boxShadow: "0 3px 12px rgba(15,23,42,.045)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 900, color: "#1e293b", marginBottom: 14 }}><span>{icon}</span><span>{title}</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ranking.map((item, index) => {
          const isLeader = index === 0 && item.votes > 0;
          const info = allCandidateInfo[item.candidate] || { id: item.candidate, name: item.candidate };
          return (
            <div key={item.candidate} style={{ display: "flex", gap: 11, alignItems: "center", padding: isLeader ? 9 : "7px 2px", borderRadius: 14, background: isLeader ? "#f5f9ff" : "transparent", border: isLeader ? "1px solid #dbeafe" : "1px solid transparent" }}>
              <CandidateAvatar candidate={item.candidate} size={48} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ color: "#334155", fontSize: 13, fontWeight: isLeader ? 900 : 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.name}</span>
                    {info.party && <span style={{ marginLeft: 6, color: "#64748b", background: "#f1f5f9", borderRadius: 999, padding: "2px 6px", fontSize: 9.5, fontWeight: 850 }}>{info.party}</span>}
                  </div>
                  <strong style={{ color: "#1d4ed8", fontSize: 14, whiteSpace: "nowrap" }}>{item.percentage.toFixed(1)}%</strong>
                </div>
                <div style={{ height: 7, background: "#e8edf4", borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(0, Math.min(100, item.percentage))}%`, background: "linear-gradient(90deg,#3b82f6,#1d4ed8)", borderRadius: 999 }} /></div>
              </div>
              {isLeader && <span style={{ fontSize: 14 }} title="Mais votado">🏆</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function candidateOptions(candidates: Candidate[]): Option[] {
  return [
    ...candidates.map((c) => ({ value: c.id, label: c.name, party: c.party, candidate: true })),
    ...specialCandidates.map((c) => ({ value: c.id, label: c.name, candidate: true })),
  ];
}

function EnqueteForm() {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<PollResults | null>(null);

  const presidentOptions = useMemo(() => candidateOptions(presidentCandidates), []);
  const governorOptions = useMemo(() => candidateOptions(governorCandidates), []);
  const federalOptions = useMemo(() => candidateOptions(federalCandidates), []);
  const stateOptions = useMemo(() => candidateOptions(stateCandidates), []);

  const setAnswer = (key: string, value: string) => setAnswers((current) => ({ ...current, [key]: value }));
  const normalizeResults = (data: Partial<PollResults>): PollResults => ({
    totalResponses: Number(data.totalResponses || 0),
    presidentRanking: Array.isArray(data.presidentRanking) ? data.presidentRanking : [],
    governorRanking: Array.isArray(data.governorRanking) ? data.governorRanking : [],
    federalRanking: Array.isArray(data.federalRanking) ? data.federalRanking : [],
    stateRanking: Array.isArray(data.stateRanking) ? data.stateRanking : [],
  });

  const loadResults = async () => {
    try {
      const response = await fetch(API_URL, { cache: "no-store" });
      if (!response.ok) return;
      setResults(normalizeResults(await response.json()));
    } catch {}
  };

  useEffect(() => {
    const p = searchParams?.get("tel") || searchParams?.get("phone") || searchParams?.get("p") || "";
    const n = searchParams?.get("nome") || searchParams?.get("name") || searchParams?.get("n") || "";
    setPhone(p);
    setName(n);
    const id = getOrCreateParticipantId();
    setParticipantId(id);

    const check = async () => {
      try {
        const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", participantId: id, phone: p }) });
        if (response.ok) {
          const data = await response.json();
          if (data.alreadyAnswered) { setAlreadyAnswered(true); setSubmitted(true); await loadResults(); }
        }
      } finally { setChecking(false); }
    };

    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const keys = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
    if (!keys.every((key) => Boolean(answers[key]))) { setErrorMsg("Por favor, responda a todas as 9 perguntas."); return; }
    setLoading(true); setErrorMsg("");

    try {
      const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", participantId, phone, ...answers }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 || data.alreadyAnswered) { setAlreadyAnswered(true); setSubmitted(true); setResults(normalizeResults(data)); return; }
      if (!response.ok || !data.success) throw new Error(data.error || "Não foi possível registrar sua resposta.");
      setSubmitted(true); setAlreadyAnswered(false); setResults(normalizeResults(data));
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Falha ao registrar sua resposta.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#475569", fontFamily: "Inter, sans-serif" }}>Verificando sua participação...</div>;

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f6f8fc", fontFamily: "Inter, sans-serif" }}>
        <header style={{ background: "#0d2342", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}><img src="/enquete-capa-voto-forte.png" alt="Enquete Voto Forte Paraná" style={{ width: "100%", maxWidth: 480, display: "block", margin: "0 auto" }} /></header>
        <main style={{ maxWidth: 500, margin: "26px auto 40px", padding: "0 14px" }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 22, padding: "24px 18px", textAlign: "center", boxShadow: "0 8px 28px rgba(15,23,42,.07)" }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%", display: "grid", placeItems: "center", background: alreadyAnswered ? "#eff6ff" : "#dcfce7", color: alreadyAnswered ? "#2563eb" : "#16a34a", fontSize: 30 }}>{alreadyAnswered ? "🔒" : "✓"}</div>
            <h2 style={{ margin: "0 0 9px", color: "#172033", fontSize: 22, fontWeight: 900 }}>{alreadyAnswered ? "Você já participou desta enquete" : "Obrigado pela participação!"}</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>{alreadyAnswered ? "Sua participação anterior foi reconhecida. Para manter a enquete justa, é permitida apenas uma resposta por participante." : `Sua resposta foi registrada com sucesso${name ? `, ${name}` : ""}. Obrigado por contribuir com a enquete de Arapongas.`}</p>
            <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background: "#f5f9ff", border: "1px solid #dbeafe" }}><div style={{ color: "#1e40af", fontWeight: 900, fontSize: 16 }}>Resultado parcial</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{results?.totalResponses ?? 0} participação{(results?.totalResponses ?? 0) === 1 ? "" : "ões"} válida{(results?.totalResponses ?? 0) === 1 ? "" : "s"} nesta preview</div></div>
            {results && <><RankingCard title="Presidente da República" icon="🇧🇷" ranking={results.presidentRanking} /><RankingCard title="Governador do Paraná" icon="🗳️" ranking={results.governorRanking} /><RankingCard title="Deputado Federal" icon="🏛️" ranking={results.federalRanking} /><RankingCard title="Deputado Estadual" icon="📊" ranking={results.stateRanking} /></>}
            <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, margin: "18px 4px 0" }}>Resultado parcial de uma enquete online. As porcentagens são calculadas somente sobre as participações válidas desta versão de teste.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fc", fontFamily: "Inter, sans-serif" }}>
      <header style={{ background: "#0d2342", textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,.15)", position: "sticky", top: 0, zIndex: 10 }}><img src="/enquete-capa-voto-forte.png" alt="Enquete Voto Forte Paraná" style={{ width: "100%", maxWidth: 480, display: "block", margin: "0 auto" }} /></header>
      <main style={{ maxWidth: 500, margin: "20px auto 42px", padding: "0 14px" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "18px 18px 22px", boxShadow: "0 6px 22px rgba(15,23,42,.055)" }}>
          <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.5, margin: "0 0 12px" }}>Sua opinião é muito importante! Responda à enquete eleitoral de Arapongas.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#f5f9ff", color: "#1e40af", border: "1px solid #dbeafe", padding: "11px 12px", borderRadius: 12, fontSize: 12, fontWeight: 800, marginBottom: 5 }}>🔒 <span>1 resposta por participante</span><span style={{ color: "#93a4bd" }}>•</span><span>resultado após o envio</span></div>
          {errorMsg && <div style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "11px 13px", borderRadius: 11, fontSize: 13, marginTop: 16 }}>{errorMsg}</div>}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Question title="1. COMO VOCÊ AVALIA A ATUAL GESTÃO DO GOVERNO ESTADUAL PARA SUA CIDADE?" name="q1" value={answers.q1 || ""} setValue={(v) => setAnswer("q1", v)} options={[{ value: "boa", label: "Boa" }, { value: "media", label: "Média" }, { value: "ruim", label: "Ruim" }]} />
            <Question title="2. COMO VOCÊ AVALIA A ATUAL ADMINISTRAÇÃO DA PREFEITURA DO SEU MUNICÍPIO?" name="q2" value={answers.q2 || ""} setValue={(v) => setAnswer("q2", v)} options={[{ value: "boa", label: "Boa" }, { value: "media", label: "Média" }, { value: "ruim", label: "Ruim" }]} />
            <Question title="3. VOCÊ CONHECE ALGUM CANDIDATO A DEPUTADO ESTADUAL OU FEDERAL QUE ESTÁ DISPUTANDO AS ELEIÇÕES DE 2026?" name="q3" value={answers.q3 || ""} setValue={(v) => setAnswer("q3", v)} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "alguns_nao_lembro", label: "Conheço alguns, mas não lembro os nomes" }]} />
            <Question title="4. HOJE, VOCÊ JÁ TEM UM CANDIDATO PARA PRESIDENTE DA REPÚBLICA?" name="q4" value={answers.q4 || ""} setValue={(v) => setAnswer("q4", v)} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "indeciso", label: "Ainda estou indeciso(a)" }]} />
            <Question title="5. HOJE, VOCÊ JÁ TEM UM CANDIDATO PARA GOVERNADOR DO PARANÁ?" name="q5" value={answers.q5 || ""} setValue={(v) => setAnswer("q5", v)} options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }, { value: "indeciso", label: "Ainda estou indeciso(a)" }]} />
            <Question title="6. EM QUEM VOCÊ VOTARIA PARA PRESIDENTE DA REPÚBLICA?" name="q6" value={answers.q6 || ""} setValue={(v) => setAnswer("q6", v)} options={presidentOptions} />
            <Question title="7. EM QUEM VOCÊ VOTARIA PARA GOVERNADOR DO PARANÁ?" name="q7" value={answers.q7 || ""} setValue={(v) => setAnswer("q7", v)} options={governorOptions} />
            <Question title="8. EM QUEM VOCÊ VOTARIA PARA DEPUTADO FEDERAL?" name="q8" value={answers.q8 || ""} setValue={(v) => setAnswer("q8", v)} options={federalOptions} />
            <Question title="9. EM QUEM VOCÊ VOTARIA PARA DEPUTADO ESTADUAL?" name="q9" value={answers.q9 || ""} setValue={(v) => setAnswer("q9", v)} options={stateOptions} />
            <button type="submit" disabled={loading} style={{ width: "100%", border: 0, borderRadius: 14, padding: 16, marginTop: 17, fontSize: 16, fontWeight: 900, color: "#fff", background: loading ? "#93c5fd" : "linear-gradient(135deg,#2f7df6,#1d4ed8)", cursor: loading ? "wait" : "pointer", boxShadow: "0 7px 18px rgba(37,99,235,.24)" }}>{loading ? "Validando e registrando..." : "Enviar respostas"}</button>
            <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", margin: "5px 5px 0", lineHeight: 1.5 }}>A identificação técnica usada para impedir resposta duplicada não aparece nos resultados. Os resultados são exibidos somente de forma agregada.</p>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function EnqueteArapongasFotosPreviewPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Carregando enquete...</div>}><EnqueteForm /></Suspense>;
}
