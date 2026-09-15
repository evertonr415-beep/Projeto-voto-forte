"use client";

import { useEffect, useState } from "react";
import EnqueteArapongasFotosPreviewPage from "../arapongas-fotos-preview/page";
import ArapongasFotosPreviewLayout from "../arapongas-fotos-preview/layout";

const OFFICIAL_PARTICIPANT_KEY = "vf_poll_arapongas_pid_v1";
const VISUAL_PARTICIPANT_KEY = "vf_poll_arapongas_photos_preview_pid_v1";
const CANONICAL_ORIGIN = "https://sistemavotoforte.com.br";
const CANONICAL_PATH = "/enquete/arapongas";
const API_URL = "/api/enquete/arapongas-fotos-preview";

type ResultItem = { candidate: string; votes: number; percentage: number };
type ResultsPayload = {
  totalResponses?: number;
  managementRanking?: ResultItem[];
  presidentRanking?: ResultItem[];
  governorRanking?: ResultItem[];
  senatorRanking?: ResultItem[];
  federalRanking?: ResultItem[];
  stateRanking?: ResultItem[];
};

const candidateLabels: Record<string, string> = {
  lula_pt: "Lula",
  flavio_bolsonaro_pl: "Flávio Bolsonaro",
  augusto_cury_avante: "Augusto Cury",
  renan_santos_missao: "Renan Santos",
  ronaldo_caiado_psd: "Ronaldo Caiado",
  romeu_zema_novo: "Romeu Zema",
  sergio_moro_pl: "Sergio Moro",
  requiao_filho_pdt: "Requião Filho",
  sandro_alex_psd: "Sandro Alex",
  luiz_franca_missao: "Luiz França",
  alexandre_curi: "Alexandre Curi",
  cristina_graeml: "Cristina Graeml",
  deltan_dallagnol: "Deltan Dallagnol",
  filipe_barros: "Filipe Barros",
  gleisi: "Gleisi",
  dr_rosinha: "Dr Rosinha",
  neto_santos: "Neto Santos",
  ricardo_barros: "Ricardo Barros",
  pedro_lupion: "Pedro Lupion",
  beto_preto: "Beto Preto",
  luciano_ducci: "Luciano Ducci",
  bonin: "Bonin",
  marco_brasil: "Marco Brasil",
  santin_roveda: "Santin Roveda",
  pedro_paulo_bazana: "Pedro Paulo Bazana",
  sergio_onofre: "Sérgio Onofre",
  aline_franzon: "Aline Franzon",
  delegado_jacovos: "Delegado Jacovós",
  cobra_reporter: "Cobra Repórter",
  outro: "Outro",
  branco_nulo: "Branco/Nulo",
  ainda_nao_sei: "Ainda não sei",
};

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${name}=`))
      ?.split("=")[1] || ""
  );
}

function formatVotes(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function resultLabel(value: string) {
  return candidateLabels[value] || value;
}

function ResultCard({ title, ranking }: { title: string; ranking?: ResultItem[] }) {
  const items = Array.isArray(ranking) ? ranking : [];

  return (
    <section
      style={{
        marginTop: 16,
        background: "#fff",
        border: "1px solid #dfe7f0",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 3px 14px rgba(15,23,42,.04)",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: "1px solid #edf2f7",
        }}
      >
        <strong style={{ color: "#26364d", fontSize: 17 }}>{title}</strong>
        <span style={{ color: "#8b99ad", fontSize: 10, fontWeight: 900, letterSpacing: ".08em" }}>
          RESULTADO ATUAL
        </span>
      </div>

      <div style={{ padding: "8px 18px 14px" }}>
        {items.length === 0 ? (
          <div style={{ padding: "16px 0", color: "#94a3b8", fontSize: 13 }}>Resultado sendo atualizado...</div>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.candidate}`} style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                <strong style={{ color: "#334155", fontSize: 14 }}>{resultLabel(item.candidate)}</strong>
                <div style={{ textAlign: "right", minWidth: 78 }}>
                  <div style={{ color: "#174f8c", fontSize: 16, fontWeight: 900 }}>{Number(item.percentage || 0).toFixed(1).replace(".", ",")}%</div>
                  <div style={{ color: "#9aa6b6", fontSize: 11, marginTop: 2 }}>{formatVotes(item.votes)} votos</div>
                </div>
              </div>
              <div style={{ height: 8, marginTop: 8, background: "#edf2f7", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, Number(item.percentage || 0)))}%`,
                    borderRadius: 999,
                    background: "linear-gradient(90deg,#2563eb,#38a9dc)",
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PostVoteResults() {
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(API_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar resultados");
        const data = (await response.json()) as ResultsPayload;
        if (active) {
          setResults(data);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f3f6fb", fontFamily: "Inter, Arial, sans-serif", color: "#243247" }}>
      <header
        style={{
          background: "linear-gradient(180deg,#0d2d50 0%,#0a2542 100%)",
          color: "#fff",
          padding: "28px 18px 58px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 900, fontSize: 18 }}>
            <img src="/voto-forte-bandeira-icon.jpg" alt="Voto Forte" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />
            <span>VotoForte Arapongas</span>
          </div>
          <div style={{ width: 76, height: 76, borderRadius: "50%", margin: "24px auto 14px", display: "grid", placeItems: "center", background: "#16b874", fontSize: 42, fontWeight: 900 }}>✓</div>
          <h1 style={{ margin: "0 0 9px", fontSize: 28, lineHeight: 1.15, fontWeight: 950 }}>Voto registrado com sucesso</h1>
          <p style={{ margin: 0, color: "#cbd8e7", fontSize: 14, lineHeight: 1.55 }}>Obrigado por participar. Abaixo estão os percentuais atualizados da enquete.</p>
        </div>
      </header>

      <main style={{ maxWidth: 540, margin: "-34px auto 42px", padding: "0 12px" }}>
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
            <div style={{ marginTop: 4, color: "#0e467d", fontSize: 31, fontWeight: 950 }}>{formatVotes(results?.totalResponses || 0)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#52637a", fontSize: 12, fontWeight: 800, textAlign: "right" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#19b67a", boxShadow: "0 0 0 6px #e7f8f1" }} />
            <span>Resultados<br />atualizados</span>
          </div>
        </div>

        <p style={{ margin: "24px 4px 8px", color: "#66758a", fontSize: 13, lineHeight: 1.65 }}>
          Os dados abaixo usam a mesma base de resultados do VotoForte Paraná e são atualizados conforme novas participações são registradas.
        </p>

        {error && (
          <div style={{ marginTop: 14, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 14, padding: 14, fontSize: 13 }}>
            O voto foi registrado, mas os percentuais não carregaram nesta tentativa. Atualize a página para tentar novamente.
          </div>
        )}

        <ResultCard title="Avaliação da gestão" ranking={results?.managementRanking} />
        <ResultCard title="Presidente da República" ranking={results?.presidentRanking} />
        <ResultCard title="Governador do Paraná" ranking={results?.governorRanking} />
        <ResultCard title="Senador pelo Paraná" ranking={results?.senatorRanking} />
        <ResultCard title="Deputado Federal" ranking={results?.federalRanking} />
        <ResultCard title="Deputado Estadual" ranking={results?.stateRanking} />
      </main>
    </div>
  );
}

export default function EnqueteArapongasPage() {
  const [ready, setReady] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const publicAliases = new Set([
      "www.sistemavotoforte.com.br",
      "voto-forte-parana.vercel.app",
      "voto-forte-parana-evertonr415-1150s-projects.vercel.app",
      "voto-forte-parana-git-main-evertonr415-1150s-projects.vercel.app",
    ]);

    if (publicAliases.has(host)) {
      const canonicalUrl = `${CANONICAL_ORIGIN}${CANONICAL_PATH}${window.location.search}${window.location.hash}`;
      window.location.replace(canonicalUrl);
      return;
    }

    const originalFetch = window.fetch.bind(window);

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      try {
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

        if (method === "POST" && requestUrl.includes(API_URL)) {
          let action = "";
          if (typeof init?.body === "string") {
            try {
              action = String(JSON.parse(init.body)?.action || "");
            } catch {
              action = "";
            }
          }

          if (action === "submit" || action === "status") {
            const data = await response.clone().json().catch(() => null);
            const shouldShowResults =
              action === "submit"
                ? response.ok && Boolean(data?.success || data?.alreadyAnswered)
                : response.ok && Boolean(data?.alreadyAnswered);

            if (shouldShowResults) setShowResults(true);
          }
        }
      } catch {
        // Mantém o fluxo normal da enquete caso a inspeção da resposta falhe.
      }

      return response;
    };

    window.fetch = patchedFetch;

    try {
      const officialId =
        window.localStorage.getItem(OFFICIAL_PARTICIPANT_KEY) || readCookie(OFFICIAL_PARTICIPANT_KEY);

      if (officialId) {
        window.localStorage.setItem(VISUAL_PARTICIPANT_KEY, officialId);
        document.cookie = `${VISUAL_PARTICIPANT_KEY}=${officialId}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
      }
    } catch {
      // A tela ainda funciona normalmente se o navegador bloquear armazenamento local.
    } finally {
      setReady(true);
    }

    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    };
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f8fc", color: "#64748b", fontFamily: "Inter, sans-serif" }}>
        Carregando enquete...
      </div>
    );
  }

  if (showResults) return <PostVoteResults />;

  return (
    <ArapongasFotosPreviewLayout>
      <EnqueteArapongasFotosPreviewPage />
    </ArapongasFotosPreviewLayout>
  );
}
