"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../supabase-client";
import { Icons } from "../ui-icons";
import "./voting-charts.css";

export type CandidateItem = {
  candidate: string;
  votes: number;
  percentage: number;
  party?: string;
};

export type SurveyFeedItem = {
  phone: string;
  contactName: string;
  district: string;
  city: string;
  messageText: string;
  stateCandidate: string;
  federalCandidate: string;
  sentiment: "declarado" | "indeciso" | "apoio" | "critica" | "neutro";
  timestamp: string;
};

const candidatePartyMap: Record<string, string> = {
  "Pedro Paulo Bazana": "PSD",
  "Sérgio Onofre": "PSD",
  "Aline Franzon": "PL",
  "Delegado Jacovos": "PL",
  "Cobra Repórter": "PSD",
  "Neto Santos": "PL",
  "Ricardo Barros": "PP",
  "Pedro Lupion": "PP",
  "Beto Preto": "PSD",
  "Luciano Ducci": "PSB",
  "Marco Brasil": "PP",
  "Santin Roveda": "União",
  "Bonin": "União",
  "Sergio Moro": "União",
  "Requião Filho": "PDT",
  "Sandro Alex": "PSD",
  "Luiz França": "Missão",
  "Lula": "PT",
  "Flávio Bolsonaro": "PL",
  "Augusto Cury": "Avante",
  "Renan Santos": "Missão",
  "Ronaldo Caiado": "PSD",
  "Romeu Zema": "Novo",
};

const candidatePhotos: Record<string, string> = {
  "neto santos": "https://cdn.tnonline.com.br/eleicoes/2026/pr/fotos/FPR160002542284_div.jpg",
  "ricardo barros": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73788.jpg",
  "pedro lupion": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204395.jpg",
  "beto preto": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220698.jpg",
  "luciano ducci": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  "bonin": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  "marco brasil": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/219585.jpg",
  "santin roveda": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/236518.jpg",
  "pedro paulo bazana": "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  "sergio onofre": "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  "aline franzon": "https://operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/3d/3d52390db67b93f272fe787733302a2aa3c14fffa9028456a5cc4388f595cffc.jpg",
  "delegado jacovos": "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  "cobra reporter": "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
  "sergio moro": "https://legis.senado.leg.br/senadores/fotos-oficiais/6331",
  "sandro alex": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/160621.jpg",
  "requiao filho": "https://storage2.assembleia.pr.leg.br/img/jo-YJGXcfLRtRuh41Yn2yghhbOs%3D/full-fit-in/300x300/deputados/7d0fa4289d10706dee8d9f1d98956d4f17b6255a.png",
  "lula": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/73/7355fb81cb690d57fe915539390218a85cc5710e5ccf98de01df167e7ccfefc4.jpg",
  "flavio bolsonaro": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/ac/ace3990fdc7ec22b49acc1a60880ddb1c8bb1bc0cf0a593a3bb9cc9406eac78d.jpg",
  "augusto cury": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/0e/0e7261482f24db5eeb08307f2cd69a674cae28f0883af694c50f8c962e8c44f0.jpg",
  "escritor augusto cury": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/0e/0e7261482f24db5eeb08307f2cd69a674cae28f0883af694c50f8c962e8c44f0.jpg",
  "renan santos": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/17/1765b870a27728d48cee02be6e5c83959fe8c6a69d2c638e5ff3bfc86057b71f.jpg",
  "ronaldo caiado": "https://legis.senado.leg.br/senadores/fotos-oficiais/456",
  "romeu zema": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/c5/c54dfb71633b010e0366cf07d337c3e2a16eafa8882f26dc3ef02015ef0d7378.jpg",
  "zema": "https://revistaopera.operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/c5/c54dfb71633b010e0366cf07d337c3e2a16eafa8882f26dc3ef02015ef0d7378.jpg",
};

function normalizeCandidate(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIndecisiveCandidate(name: string) {
  const key = normalizeCandidate(name);
  return (
    key.includes("indeciso") ||
    key.includes("ainda nao sabe") ||
    key.includes("nao sabe") ||
    key.includes("branco") ||
    key.includes("nulo")
  );
}

function isOtherCandidate(name: string) {
  const key = normalizeCandidate(name);
  return key === "outro" || key.includes("outro candidato") || key.includes("outro nome");
}

function isSpecialCandidate(name: string) {
  return isIndecisiveCandidate(name) || isOtherCandidate(name);
}

function candidateInitials(name: string) {
  const key = normalizeCandidate(name);
  if (isIndecisiveCandidate(name)) return "?";
  if (isOtherCandidate(name)) return "+";
  if (!key) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function CandidateAvatar({ name, compact = false }: { name: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = candidatePhotos[normalizeCandidate(name)];

  return (
    <span
      className={`voting-candidate-avatar ${compact ? "compact" : ""} ${isSpecialCandidate(name) ? "special" : ""}`}
      aria-label={isSpecialCandidate(name) ? undefined : `Foto de ${name}`}
      aria-hidden={isSpecialCandidate(name) ? true : undefined}
    >
      {photo && !failed ? (
        <img
          src={photo}
          alt={`Foto de ${name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{candidateInitials(name)}</span>
      )}
    </span>
  );
}

function hideNetworkScopeOnCharts() {
  const changed = new Map<HTMLElement, string>();
  const normalizeText = (value: string | null | undefined) =>
    (value || "").replace(/\s+/g, " ").trim().toLowerCase();

  const hide = (element: HTMLElement) => {
    if (element.closest(".voting-charts-container")) return;
    let target = element;
    let parent = target.parentElement;
    let hops = 0;

    while (parent && hops < 3) {
      const parentText = normalizeText(parent.textContent);
      if (parentText !== "todos da rede") break;
      target = parent;
      parent = parent.parentElement;
      hops += 1;
    }

    if (!changed.has(target)) {
      changed.set(target, target.style.display);
      target.style.display = "none";
      target.dataset.vfChartsScopeHidden = "true";
    }
  };

  document.querySelectorAll<HTMLElement>("select, button, [role='button']").forEach((element) => {
    let label = normalizeText(element.textContent);
    if (element instanceof HTMLSelectElement) {
      label = normalizeText(element.options[element.selectedIndex]?.textContent);
    }
    if (label === "todos da rede") hide(element);
  });

  return () => {
    changed.forEach((display, element) => {
      element.style.display = display;
      delete element.dataset.vfChartsScopeHidden;
    });
  };
}

export default function VotingChartsClient({
  onBackToDashboard,
}: {
  onBackToDashboard?: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<
    "state" | "federal" | "governor" | "president" | "management"
  >("state");
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [stateRanking, setStateRanking] = useState<CandidateItem[]>([]);
  const [federalRanking, setFederalRanking] = useState<CandidateItem[]>([]);
  const [governorRanking, setGovernorRanking] = useState<CandidateItem[]>([]);
  const [presidentRanking, setPresidentRanking] = useState<CandidateItem[]>([]);
  const [managementRanking, setManagementRanking] = useState<CandidateItem[]>([]);
  const [managementTotalVotes, setManagementTotalVotes] = useState<number>(0);
  const [districtRanking, setDistrictRanking] = useState<{ district: string; total: number }[]>([]);
  const [responses, setResponses] = useState<SurveyFeedItem[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [surveyRes, previewRes] = await Promise.all([
        apiFetch(`/api/whatsapp/survey?district=${encodeURIComponent(selectedDistrict)}`, { cache: "no-store" }),
        apiFetch("/api/enquete/arapongas-preview", { cache: "no-store" }).catch(() => null),
      ]);

      const surveyData = await surveyRes.json();
      const previewData = previewRes ? await previewRes.json() : null;

      if (surveyData?.success) {
        setResponses(surveyData.responses || []);
        setStateRanking(surveyData.stateRanking || []);
        setFederalRanking(surveyData.federalRanking || []);
        if (surveyData.governorRanking?.length) setGovernorRanking(surveyData.governorRanking);
        if (surveyData.presidentRanking?.length) setPresidentRanking(surveyData.presidentRanking);
        setDistrictRanking(surveyData.districtRanking || []);
        setTotalVotes(
          Number(
            surveyData.totalResponses ||
              surveyData.kpis?.totalResponses ||
              (surveyData.responses ? surveyData.responses.length : 0),
          ),
        );
      }

      if (previewData?.success) {
        if (!surveyData?.governorRanking?.length && previewData.governorRanking?.length) {
          setGovernorRanking(previewData.governorRanking);
        }
        if (!surveyData?.presidentRanking?.length && previewData.presidentRanking?.length) {
          setPresidentRanking(previewData.presidentRanking);
        }
        if (!surveyData?.stateRanking?.length && previewData.stateRanking?.length) {
          setStateRanking(previewData.stateRanking);
        }
        if (!surveyData?.federalRanking?.length && previewData.federalRanking?.length) {
          setFederalRanking(previewData.federalRanking);
        }
        if (previewData.managementRanking?.length) {
          setManagementRanking(previewData.managementRanking);
          setManagementTotalVotes(Number(previewData.totalResponses || 0));
        } else {
          setManagementRanking([]);
          setManagementTotalVotes(0);
        }
      }

      setLastUpdated(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    } catch {
      // Mantém a última leitura válida em tela.
    } finally {
      setLoading(false);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => void loadData(), 15000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    let restore = hideNetworkScopeOnCharts();
    const observer = new MutationObserver(() => {
      restore();
      restore = hideNetworkScopeOnCharts();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      restore();
    };
  }, []);

  const currentList = useMemo(() => {
    let list: CandidateItem[] = [];
    if (activeCategory === "state") list = stateRanking;
    else if (activeCategory === "federal") list = federalRanking;
    else if (activeCategory === "governor") list = governorRanking;
    else if (activeCategory === "president") list = presidentRanking;
    else list = managementRanking;

    if (list.length > 0) return list;

    if (activeCategory === "state") {
      return [
        { candidate: "Pedro Paulo Bazana", votes: 0, percentage: 0 },
        { candidate: "Sérgio Onofre", votes: 0, percentage: 0 },
        { candidate: "Aline Franzon", votes: 0, percentage: 0 },
        { candidate: "Delegado Jacovos", votes: 0, percentage: 0 },
        { candidate: "Cobra Repórter", votes: 0, percentage: 0 },
        { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
      ];
    }
    if (activeCategory === "federal") {
      return [
        { candidate: "Neto Santos", votes: 0, percentage: 0 },
        { candidate: "Pedro Lupion", votes: 0, percentage: 0 },
        { candidate: "Ricardo Barros", votes: 0, percentage: 0 },
        { candidate: "Beto Preto", votes: 0, percentage: 0 },
        { candidate: "Luciano Ducci", votes: 0, percentage: 0 },
        { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
      ];
    }
    if (activeCategory === "governor") {
      return [
        { candidate: "Sergio Moro", votes: 0, percentage: 0 },
        { candidate: "Sandro Alex", votes: 0, percentage: 0 },
        { candidate: "Requião Filho", votes: 0, percentage: 0 },
        { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
      ];
    }
    if (activeCategory === "president") {
      return [
        { candidate: "Flávio Bolsonaro", votes: 0, percentage: 0 },
        { candidate: "Lula", votes: 0, percentage: 0 },
        { candidate: "Ronaldo Caiado", votes: 0, percentage: 0 },
        { candidate: "Augusto Cury", votes: 0, percentage: 0 },
        { candidate: "Indeciso / Não sabe", votes: 0, percentage: 0 },
      ];
    }
    return [
      { candidate: "Boa", votes: 0, percentage: 0 },
      { candidate: "Média", votes: 0, percentage: 0 },
      { candidate: "Ruim", votes: 0, percentage: 0 },
    ];
  }, [activeCategory, stateRanking, federalRanking, governorRanking, presidentRanking, managementRanking]);

  const orderedList = useMemo(() => {
    const byVotes = (a: CandidateItem, b: CandidateItem) =>
      b.votes - a.votes || b.percentage - a.percentage || a.candidate.localeCompare(b.candidate, "pt-BR");

    if (activeCategory === "management") return [...currentList].sort(byVotes);

    const candidates = currentList.filter((item) => !isSpecialCandidate(item.candidate)).sort(byVotes);
    const other = currentList.filter((item) => isOtherCandidate(item.candidate)).sort(byVotes);
    const undecided = currentList.filter((item) => isIndecisiveCandidate(item.candidate)).sort(byVotes);
    return [...candidates, ...other, ...undecided];
  }, [activeCategory, currentList]);

  const rankedCandidates = useMemo(
    () => orderedList.filter((item) => !isSpecialCandidate(item.candidate)),
    [orderedList],
  );
  const rankedCandidatesWithVotes = useMemo(
    () => rankedCandidates.filter((item) => item.votes > 0),
    [rankedCandidates],
  );
  const leader = rankedCandidatesWithVotes[0];
  const runnerUp = rankedCandidatesWithVotes[1];
  const indecisos = orderedList.find((item) => isIndecisiveCandidate(item.candidate));
  const displayedTotalVotes = activeCategory === "management" ? managementTotalVotes : totalVotes;

  const categoryTitle =
    activeCategory === "state"
      ? "Deputado Estadual"
      : activeCategory === "federal"
        ? "Deputado Federal"
        : activeCategory === "governor"
          ? "Governador do Paraná"
          : activeCategory === "president"
            ? "Presidente da República"
            : "Avaliação da Gestão Municipal";

  const exportCsv = () => {
    const headers = "Posição,Candidato,Partido,Votos,Percentual\n";
    const rows = orderedList
      .map((item, index) => {
        const party = item.party || candidatePartyMap[item.candidate] || "-";
        const position = isSpecialCandidate(item.candidate) ? "-" : index + 1;
        return `${position},"${item.candidate}","${party}","${item.votes}","${item.percentage}%"`;
      })
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `VotoForte-Apuracao-${activeCategory}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="voting-charts-container">
      <header className="voting-charts-header">
        <div className="voting-charts-title-group">
          <div className="voting-title-row">
            <h1>
              <span className="voting-title-icon">📊</span>
              <span>
                Apuração e Gráficos <span className="voting-title-desktop">de Votação</span>
              </span>
            </h1>
            <span className="voting-live-badge">
              <span className="voting-live-dot" /> Tempo real
            </span>
          </div>
          <p>
            Enquetes e mensagens de WhatsApp em Arapongas
            {lastUpdated && <span className="voting-last-update"> · Atualizado às {lastUpdated}</span>}
          </p>
        </div>

        <div className="voting-actions-row">
          <label className="district-selector-wrap">
            <span className="district-selector-label">📍 Bairro</span>
            <select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}>
              <option value="all">Todos os Bairros (Geral)</option>
              {districtRanking.map((district) => (
                <option key={district.district} value={district.district}>
                  {district.district} ({district.total})
                </option>
              ))}
            </select>
          </label>

          <button className="voting-btn" onClick={() => void loadData()} disabled={loading} title="Atualizar dados agora">
            <Icons.Clock size={16} /> <span>{loading ? "Atualizando…" : "Atualizar"}</span>
          </button>
          <button className="voting-btn" onClick={() => window.print()} title="Imprimir relatório">
            <Icons.Printer size={16} /> <span>Imprimir</span>
          </button>
          <button className="voting-btn" onClick={exportCsv} title="Baixar CSV">
            <Icons.Download size={16} /> <span>CSV</span>
          </button>
          {onBackToDashboard && (
            <button className="voting-btn voting-btn-primary" onClick={onBackToDashboard}>
              ← <span>Painel Principal</span>
            </button>
          )}
        </div>
      </header>

      <section className="voting-kpi-grid" aria-label="Resumo da apuração">
        <article className="voting-kpi-card voting-kpi-total">
          <div className="voting-kpi-label">Total de votos <span>🗳️</span></div>
          <div className="voting-kpi-value">{displayedTotalVotes.toLocaleString("pt-BR")}</div>
          <div className="voting-kpi-sub">
            {activeCategory === "management"
              ? "Respostas da avaliação municipal"
              : selectedDistrict === "all"
                ? "Todos os bairros"
                : selectedDistrict}
          </div>
        </article>

        <article className="voting-kpi-card voting-kpi-person voting-kpi-leader">
          <div className="voting-kpi-label">1º colocado <span>🥇</span></div>
          <div className="voting-kpi-person-row">
            {leader && <CandidateAvatar name={leader.candidate} compact />}
            <div className="voting-kpi-person-copy">
              <div className="voting-kpi-value voting-kpi-green">{leader ? `${leader.percentage.toFixed(1)}%` : "0%"}</div>
              <div className="voting-kpi-sub">{leader?.candidate || "Aguardando votos"}</div>
            </div>
          </div>
        </article>

        <article className="voting-kpi-card voting-kpi-person voting-kpi-runner">
          <div className="voting-kpi-label">2º colocado <span>🥈</span></div>
          <div className="voting-kpi-person-row">
            {runnerUp && <CandidateAvatar name={runnerUp.candidate} compact />}
            <div className="voting-kpi-person-copy">
              <div className="voting-kpi-value voting-kpi-blue">{runnerUp ? `${runnerUp.percentage.toFixed(1)}%` : "0%"}</div>
              <div className="voting-kpi-sub">{runnerUp?.candidate || "Aguardando votos"}</div>
            </div>
          </div>
        </article>

        <article className="voting-kpi-card voting-kpi-undecided">
          <div className="voting-kpi-label">Indecisos / não sabe <span>❓</span></div>
          <div className="voting-kpi-value voting-kpi-amber">{indecisos ? `${indecisos.percentage.toFixed(1)}%` : "0%"}</div>
          <div className="voting-kpi-sub">Potencial de convencimento</div>
        </article>
      </section>

      <nav className="voting-nav-tabs" aria-label="Cargo da apuração">
        <button className={`voting-tab-btn ${activeCategory === "state" ? "active" : ""}`} onClick={() => setActiveCategory("state")}>
          🏛️ <span>Estadual</span>
        </button>
        <button className={`voting-tab-btn ${activeCategory === "federal" ? "active" : ""}`} onClick={() => setActiveCategory("federal")}>
          🇧🇷 <span>Federal</span>
        </button>
        <button className={`voting-tab-btn ${activeCategory === "governor" ? "active" : ""}`} onClick={() => setActiveCategory("governor")}>
          🗳️ <span>Governador</span>
        </button>
        <button className={`voting-tab-btn ${activeCategory === "president" ? "active" : ""}`} onClick={() => setActiveCategory("president")}>
          🏢 <span>Presidente</span>
        </button>
        <button className={`voting-tab-btn ${activeCategory === "management" ? "active" : ""}`} onClick={() => setActiveCategory("management")}>
          📈 <span>Gestão</span>
        </button>
      </nav>

      <div className="voting-main-grid">
        <section className="voting-chart-card">
          <div className="voting-chart-header">
            <h2>
              <Icons.BarChart size={20} color="#38bdf8" />
              <span>Ranking — {categoryTitle}</span>
            </h2>
            <span className="voting-total-badge">
              Base: {orderedList.reduce((sum, item) => sum + item.votes, 0).toLocaleString("pt-BR")} votos
            </span>
          </div>

          <div className="candidate-bars-list">
            {orderedList.map((item) => {
              const party = item.party || candidatePartyMap[item.candidate];
              const special = isSpecialCandidate(item.candidate);
              const realRank = special
                ? 0
                : rankedCandidates.findIndex(
                    (candidate) => normalizeCandidate(candidate.candidate) === normalizeCandidate(item.candidate),
                  ) + 1;
              const rankLabel = isOtherCandidate(item.candidate) ? "+" : isIndecisiveCandidate(item.candidate) ? "?" : `${realRank}º`;

              return (
                <article
                  key={item.candidate}
                  className={`candidate-bar-item ${special ? "candidate-special" : ""} ${realRank === 1 ? "candidate-leader" : ""}`}
                >
                  <div className="candidate-bar-top">
                    <CandidateAvatar name={item.candidate} />
                    <div className="candidate-info">
                      <div className="candidate-name-line">
                        <span className="candidate-rank-badge">{rankLabel}</span>
                        <strong>{item.candidate}</strong>
                        {party && <span className="candidate-party">{party}</span>}
                      </div>
                      <span className="candidate-votes candidate-votes-mobile">{item.votes.toLocaleString("pt-BR")} votos</span>
                    </div>
                    <div className="candidate-metrics">
                      <span className="candidate-pct">{item.percentage.toFixed(1)}%</span>
                      <span className="candidate-votes candidate-votes-desktop">{item.votes.toLocaleString("pt-BR")} votos</span>
                    </div>
                  </div>
                  <div className="progress-track" aria-label={`${item.percentage.toFixed(1)}%`}>
                    <div className="progress-fill" style={{ width: `${Math.max(item.percentage, item.votes > 0 ? 2 : 0)}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="voting-sidebar-column">
          <section className="voting-side-card">
            <h3><span>📍 Top bairros</span><span className="voting-side-city">Arapongas</span></h3>
            <div className="district-mini-list">
              {districtRanking.slice(0, 8).map((district) => (
                <button
                  type="button"
                  key={district.district}
                  className="district-mini-item"
                  onClick={() => setSelectedDistrict(district.district)}
                >
                  <span className="district-mini-name">{district.district}</span>
                  <span className="district-mini-count">{district.total} votos</span>
                </button>
              ))}
              {districtRanking.length === 0 && <div className="voting-empty-small">Aguardando participações por bairro</div>}
            </div>
          </section>

          <section className="voting-side-card voting-public-poll-card">
            <h3><span>🔗 Enquete pública</span></h3>
            <p>Compartilhe o link oficial para coletar mais respostas em Arapongas.</p>
            <input type="text" readOnly value="https://sistemavotoforte.com.br/enquete/arapongas" />
            <button
              className="voting-btn voting-btn-primary voting-copy-btn"
              onClick={() => {
                void navigator.clipboard.writeText("https://sistemavotoforte.com.br/enquete/arapongas");
                alert("Link da enquete copiado com sucesso!");
              }}
            >
              Copiar link oficial
            </button>
          </section>
        </aside>
      </div>

      <section className="voting-recent-feed">
        <div className="voting-chart-header">
          <h2><Icons.Clock size={20} color="#38bdf8" /><span>Últimas participações</span></h2>
          <span className="voting-total-badge">{Math.min(responses.length, 10)} recentes</span>
        </div>

        <div className="voting-feed-desktop">
          <table className="voting-feed-table">
            <thead>
              <tr>
                <th>Nome / Telefone</th><th>Bairro</th><th>Dep. Estadual</th><th>Dep. Federal</th><th>Sentimento</th><th>Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {responses.slice(0, 10).map((response, index) => (
                <tr key={`${response.phone}-${index}`}>
                  <td><strong>{response.contactName || "Eleitor"}</strong><div className="voting-phone">{response.phone}</div></td>
                  <td>{response.district || "Arapongas"}</td>
                  <td><span className="voting-state-choice">{response.stateCandidate || "Não declarado"}</span></td>
                  <td><span className="voting-federal-choice">{response.federalCandidate || "Não declarado"}</span></td>
                  <td><span className={`sentiment-badge sentiment-${response.sentiment}`}>{response.sentiment}</span></td>
                  <td className="voting-date-cell">{response.timestamp ? new Date(response.timestamp).toLocaleString("pt-BR") : "-"}</td>
                </tr>
              ))}
              {responses.length === 0 && <tr><td colSpan={6} className="voting-empty-table">Nenhuma resposta registrada ainda no filtro selecionado.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="voting-feed-mobile">
          {responses.slice(0, 10).map((response, index) => (
            <article className="voting-feed-mobile-card" key={`mobile-${response.phone}-${index}`}>
              <div className="voting-feed-mobile-head">
                <div><strong>{response.contactName || "Eleitor"}</strong><span>{response.district || "Arapongas"}</span></div>
                <span className={`sentiment-badge sentiment-${response.sentiment}`}>{response.sentiment}</span>
              </div>
              <div className="voting-feed-mobile-votes">
                <span><small>Estadual</small>{response.stateCandidate || "Não declarado"}</span>
                <span><small>Federal</small>{response.federalCandidate || "Não declarado"}</span>
              </div>
              <div className="voting-feed-mobile-foot">
                <span>{response.phone}</span>
                <span>{response.timestamp ? new Date(response.timestamp).toLocaleString("pt-BR") : "-"}</span>
              </div>
            </article>
          ))}
          {responses.length === 0 && <div className="voting-empty-mobile">Nenhuma resposta registrada ainda no filtro selecionado.</div>}
        </div>
      </section>
    </div>
  );
}
