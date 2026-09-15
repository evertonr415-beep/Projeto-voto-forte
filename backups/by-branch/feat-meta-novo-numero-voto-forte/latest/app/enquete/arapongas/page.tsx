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

const candidatePhotos: Record<string, string> = {
  alexandre_curi: "https://storage2.assembleia.pr.leg.br/img/y3n1sE1n35-E4-L_2B8B_P5U3qQ=/full-fit-in/300x300/deputados/alexandre-curi.png",
  cristina_graeml: "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
  deltan_dallagnol: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220559.jpg",
  dr_rosinha: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73459.jpg",
  filipe_barros: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204374.jpg",
  gleisi: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/74416.jpg",
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

function initialsFor(candidate: string) {
  const label = resultLabel(candidate);
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function ResultCandidateAvatar({ candidate }: { candidate: string }) {
  const [failed, setFailed] = useState(false);
  const photo = candidatePhotos[candidate];

  if (!photo || failed) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 46,
          height: 46,
          minWidth: 46,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(145deg,#eff6ff,#dbeafe)",
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px #bfdbfe",
          color: "#1d4ed8",
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {initialsFor(candidate)}
      </div>
    );
  }

  return (
    <img
      src={photo}
      alt={resultLabel(candidate)}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: 46,
        height: 46,
        minWidth: 46,
        borderRadius: "50%",
        objectFit: "cover",
        objectPosition: "center",
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px #cbd5e1,0 3px 10px rgba(15,23,42,.12)",
        background: "#e2e8f0",
      }}
    />
  );
}

function ResultCard({
  title,
  ranking,
  showCandidatePhotos = false,
}: {
  title: string;
  ranking?: ResultItem[];
  showCandidatePhotos?: boolean;
}) {
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
          items.map((item) => {
            const hasPhoto = showCandidatePhotos && Boolean(candidatePhotos[item.candidate]);
            return (
              <div key={`${title}-${item.candidate}`} style={{ padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                  <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 11, flex: 1 }}>
                    {hasPhoto && <ResultCandidateAvatar candidate={item.candidate} />}
                    <strong style={{ color: "#334155", fontSize: 14, lineHeight: 1.3 }}>{resultLabel(item.candidate)}</strong>
                  </div>
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
            );
          })
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
          width: "100%",
          background: "#0d2342",
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,.15)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <img
          src="/enquete-capa-voto-forte.png"
          alt="Enquete Voto Forte Paraná"
          style={{
            width: "100%",
            maxWidth: 700,
            display: "block",
            margin: "0 auto",
          }}
        />
      </header>

      <section
        style={{
          background: "linear-gradient(180deg,#0d2d50 0%,#0a2542 100%)",
          color: "#fff",
          padding: "30px 18px 58px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", margin: "0 auto 14px", display: "grid", placeItems: "center", background: "#16b874", fontSize: 42, fontWeight: 900 }}>✓</div>
          <h1 style={{ margin: "0 0 9px", fontSize: 28, lineHeight: 1.15, fontWeight: 950 }}>Voto registrado com sucesso</h1>
          <p style={{ margin: 0, color: "#cbd8e7", fontSize: 14, lineHeight: 1.55 }}>Obrigado por participar. Abaixo estão os percentuais atualizados da enquete.</p>
        </div>
      </section>

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
        <ResultCard title="Presidente da República" ranking={results?.presidentRanking} showCandidatePhotos />
        <ResultCard title="Governador do Paraná" ranking={results?.governorRanking} showCandidatePhotos />
        <ResultCard title="Senador pelo Paraná" ranking={results?.senatorRanking} showCandidatePhotos />
        <ResultCard title="Deputado Federal" ranking={results?.federalRanking} showCandidatePhotos />
        <ResultCard title="Deputado Estadual" ranking={results?.stateRanking} showCandidatePhotos />
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
