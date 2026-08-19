"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";
import {
  ARAPONGAS_POLLING_PLACES,
  ARAPONGAS_HISTORICAL_ELECTIONS,
  type PollingPlace,
  type CandidateResult,
} from "./electoral-tse-data";

type DistrictItem = {
  district: string;
  total: number;
};

type SummaryResponse = {
  districts?: DistrictItem[];
  error?: string;
};

type SessionResponse = {
  user?: {
    email?: string;
    role?: string;
  };
};

type PanelTab = "districts" | "colleges" | "elections";
type OrderMode = "rank" | "alphabetical";
type MobileSection = "contacts" | "sidebar";

const ADMIN_ROLES = new Set(["master", "gestor", "lider"]);
const DESKTOP_QUERY = "(min-width: 1121px)";
const MOBILE_QUERY = "(max-width: 760px)";
const NUMBER = new Intl.NumberFormat("pt-BR");
const PERCENT = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PARTY_COLORS: Record<string, string> = {
  PSD: "#1d4ed8",
  PL: "#0284c7",
  PP: "#0d9488",
  PT: "#dc2626",
  MDB: "#16a34a",
  Republicanos: "#7c3aed",
  União: "#2563eb",
  "União Brasil": "#2563eb",
  Podemos: "#0891b2",
  PSC: "#475569",
  PTB: "#ca8a04",
  NOVO: "#ea580c",
  PDT: "#b91c1c",
  PSOL: "#e11d48",
};

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export default function ContactDistrictRanking() {
  const [scope, setScope] = useState("all");
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [panelTab, setPanelTab] = useState<PanelTab>("districts");
  const [mode, setMode] = useState<OrderMode>("rank");
  const [showAll, setShowAll] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>("contacts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const requestVersion = useRef(0);

  // Filtros internos para a aba de eleições na barra lateral
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedOffice, setSelectedOffice] = useState<string>("prefeito");

  useEffect(() => {
    let cancelled = false;
    let requested = false;
    let authObserver: MutationObserver | null = null;

    const loadScope = () => {
      if (cancelled || requested) return;
      requested = true;
      authObserver?.disconnect();
      authObserver = null;

      void apiFetch("/api/session", { cache: "no-store" })
        .then(async (response) => ({
          response,
          data: (await response.json()) as SessionResponse,
        }))
        .then(({ response, data }) => {
          if (cancelled || !response.ok) return;
          const email = String(data.user?.email || "").trim().toLowerCase();
          const role = String(data.user?.role || "").trim().toLowerCase();
          const accessRole = String((data.user as { accessRole?: string })?.accessRole || "").trim().toLowerCase();
          if (!email) return;
          const isAdmin = ADMIN_ROLES.has(role) || accessRole === "gestor" || accessRole === "adm";
          setScope(isAdmin ? "all" : email);
        })
        .catch(() => {
          if (!cancelled) setError("Não foi possível identificar o escopo dos bairros.");
        });
    };

    if (!document.querySelector(".auth-page")) {
      loadScope();
      authObserver = new MutationObserver(() => {
        if (!document.querySelector(".auth-page")) {
          authObserver?.disconnect();
          authObserver = null;
          loadScope();
        }
      });
      authObserver.observe(document.body, { childList: true, subtree: true });
    }

    const handleScopeChange = (event: Event) => {
      const control = event.target as HTMLSelectElement | null;
      if (!control?.matches(".optimized-scope-control select")) return;
      setScope(control.value);
      setShowAll(false);
    };

    document.addEventListener("change", handleScopeChange, true);
    return () => {
      cancelled = true;
      authObserver?.disconnect();
      document.removeEventListener("change", handleScopeChange, true);
    };
  }, []);

  useEffect(() => {
    let observed = true;
    let grid: HTMLElement | null = null;
    let previousGridTemplate = "";
    let media: MediaQueryList | null = null;

    const syncGrid = () => {
      if (!grid || !media) return;
      grid.style.gridTemplateColumns = media.matches
        ? "minmax(0, 1fr) 350px"
        : "1fr";
    };

    const attach = () => {
      const next = document.querySelector<HTMLElement>(".optimized-content");
      if (!next || !observed) return false;
      grid = next;
      previousGridTemplate = next.style.gridTemplateColumns;
      media = window.matchMedia(DESKTOP_QUERY);
      syncGrid();
      media.addEventListener("change", syncGrid);
      setTarget(next);
      return true;
    };

    if (attach()) {
      return () => {
        observed = false;
        media?.removeEventListener("change", syncGrid);
        if (grid) grid.style.gridTemplateColumns = previousGridTemplate;
      };
    }

    const observer = new MutationObserver(() => {
      if (!attach()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observed = false;
      observer.disconnect();
      media?.removeEventListener("change", syncGrid);
      if (grid) grid.style.gridTemplateColumns = previousGridTemplate;
    };
  }, []);

  useEffect(() => {
    if (!target) return;
    target.classList.toggle("mobile-show-districts", mobileSection === "sidebar");
    return () => target.classList.remove("mobile-show-districts");
  }, [mobileSection, target]);

  const switchMobileSection = useCallback(
    (next: MobileSection) => {
      setMobileSection(next);
      if (!target || !window.matchMedia(MOBILE_QUERY).matches) return;
      window.requestAnimationFrame(() => {
        const top = target.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    },
    [target],
  );

  const load = useCallback(async () => {
    if (!scope) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as SummaryResponse;
      if (!response.ok) throw new Error(data.error || "Falha ao carregar bairros");
      if (version !== requestVersion.current) return;

      const normalized = (Array.isArray(data.districts) ? data.districts : [])
        .map((item) => ({
          district: String(item.district || "").trim(),
          total: finiteNumber(item.total),
        }))
        .filter((item) => item.district)
        .sort(
          (left, right) =>
            right.total - left.total ||
            left.district.localeCompare(right.district, "pt-BR"),
        );

      setDistricts(normalized);
    } catch (loadError) {
      if (version !== requestVersion.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar a relação de bairros agora.",
      );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (!scope) return;
    void load();
    const refresh = () => void load();
    window.addEventListener("voto-forte:records-changed", refresh);
    window.addEventListener("voto-forte:contacts-imported", refresh);
    window.addEventListener("voto-forte:refresh-dashboard", refresh);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener("voto-forte:records-changed", refresh);
      window.removeEventListener("voto-forte:contacts-imported", refresh);
      window.removeEventListener("voto-forte:refresh-dashboard", refresh);
    };
  }, [load, scope]);

  // Atualiza cargo padrão ao mudar de ano
  useEffect(() => {
    if (selectedYear === 2024 || selectedYear === 2020) {
      setSelectedOffice("prefeito");
    } else if (selectedYear === 2022) {
      setSelectedOffice("presidente");
    }
  }, [selectedYear]);

  const activeElectionData = useMemo(() => {
    return (
      ARAPONGAS_HISTORICAL_ELECTIONS.find((e) => e.year === selectedYear) ||
      ARAPONGAS_HISTORICAL_ELECTIONS[0]
    );
  }, [selectedYear]);

  const activeOfficeData = useMemo(() => {
    return (
      activeElectionData.offices.find((o) => o.office === selectedOffice) ||
      activeElectionData.offices[0]
    );
  }, [activeElectionData, selectedOffice]);

  const ranked = useMemo(
    () =>
      [...districts].sort(
        (left, right) =>
          right.total - left.total ||
          left.district.localeCompare(right.district, "pt-BR"),
      ),
    [districts],
  );

  const rows = useMemo(() => {
    if (mode === "alphabetical") {
      return [...districts].sort((left, right) =>
        left.district.localeCompare(right.district, "pt-BR"),
      );
    }
    return ranked;
  }, [districts, mode, ranked]);

  const visibleRows = showAll ? rows : rows.slice(0, 12);
  const maxTotal = Math.max(1, ranked[0]?.total || 0);
  const reached = districts.filter((item) => item.total > 0).length;

  const openDistrict = (district: string) => {
    window.dispatchEvent(
      new CustomEvent("voto-forte:filter-district-contacts", {
        detail: { district },
      }),
    );
    switchMobileSection("contacts");
  };

  const openDistrictDrawer = (district: string) => {
    window.dispatchEvent(
      new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
        detail: { district },
      }),
    );
  };

  const mobileSwitch = (
    <nav className="contact-mobile-switch" aria-label="Visualização do painel de contatos">
      <button
        type="button"
        className={mobileSection === "contacts" ? "is-active" : ""}
        aria-pressed={mobileSection === "contacts"}
        onClick={() => switchMobileSection("contacts")}
      >
        Contatos
      </button>
      <button
        type="button"
        className={mobileSection === "sidebar" ? "is-active" : ""}
        aria-pressed={mobileSection === "sidebar"}
        onClick={() => switchMobileSection("sidebar")}
      >
        Bairros & Colégios TSE
      </button>
    </nav>
  );

  const panel = (
    <aside className="optimized-panel district-panel" aria-busy={loading}>
      {/* Cabeçalho da Barra Lateral Direita */}
      <div className="district-panel-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <div>
            <small style={{ color: "#0284c7", fontWeight: 800 }}>INTELIGÊNCIA TERRITORIAL</small>
            <h2 style={{ fontSize: "18px", margin: "2px 0 0" }}>Painel Lateral</h2>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("voto-forte:open-whatsapp-district-modal"))}
            style={{
              padding: "6px 10px",
              borderRadius: "8px",
              background: "#16a34a",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
              border: 0,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 2px 6px rgba(22, 163, 74, 0.25)",
            }}
          >
            📲 Disparo
          </button>
        </div>
      </div>

      {/* Abas Principais da Barra Lateral Direita */}
      <div
        className="district-tabs"
        role="tablist"
        style={{
          gridTemplateColumns: "repeat(3, 1fr)",
          margin: "8px 0 12px",
          background: "#f1f5f9",
          padding: "3px",
          borderRadius: "10px",
        }}
      >
        <button
          type="button"
          className={panelTab === "districts" ? "is-active" : ""}
          onClick={() => setPanelTab("districts")}
          style={{ fontSize: "11px", fontWeight: 800, padding: "7px 2px" }}
        >
          📊 Bairros
        </button>
        <button
          type="button"
          className={panelTab === "colleges" ? "is-active" : ""}
          onClick={() => setPanelTab("colleges")}
          style={{ fontSize: "11px", fontWeight: 800, padding: "7px 2px" }}
        >
          🏫 Colégios
        </button>
        <button
          type="button"
          className={panelTab === "elections" ? "is-active" : ""}
          onClick={() => setPanelTab("elections")}
          style={{ fontSize: "11px", fontWeight: 800, padding: "7px 2px" }}
        >
          🗳️ Eleições
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: BAIRROS (RANKING)                                  */}
      {/* ======================================================== */}
      {panelTab === "districts" && (
        <>
          <div
            className="district-tabs"
            role="tablist"
            aria-label="Ordenação dos bairros"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: "10px" }}
          >
            <button
              type="button"
              className={mode === "rank" ? "is-active" : ""}
              onClick={() => {
                setMode("rank");
                setShowAll(false);
              }}
            >
              Mais cadastros
            </button>
            <button
              type="button"
              className={mode === "alphabetical" ? "is-active" : ""}
              onClick={() => {
                setMode("alphabetical");
                setShowAll(false);
              }}
            >
              A–Z
            </button>
          </div>

          {loading || !scope ? (
            <p className="optimized-empty">Carregando bairros…</p>
          ) : error ? (
            <p className="optimized-empty">{error}</p>
          ) : (
            <>
              <ol>
                {visibleRows.map((item) => (
                  <li key={item.district} className={item.total === 0 ? "is-empty" : undefined}>
                    <button
                      type="button"
                      className="district-row-button"
                      disabled={item.total <= 0}
                      onClick={() => openDistrict(item.district)}
                      title={`Abrir contatos de ${item.district}`}
                    >
                      <span className="district-name">
                        <span>{item.district}</span>
                        <span className="district-bar" aria-hidden="true">
                          <i
                            style={{
                              width: `${item.total ? Math.max((item.total / maxTotal) * 100, 4) : 0}%`,
                            }}
                          />
                        </span>
                      </span>
                      <b>{item.total.toLocaleString("pt-BR")}</b>
                    </button>
                  </li>
                ))}
              </ol>
              {!visibleRows.length && (
                <p className="optimized-empty">Nenhum bairro disponível.</p>
              )}
              {rows.length > 12 && (
                <button
                  className="district-show-more"
                  type="button"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll
                    ? "Mostrar menos"
                    : `Ver todos (${rows.length.toLocaleString("pt-BR")})`}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* ABA 2: COLÉGIOS DE VOTAÇÃO (TSE)                         */}
      {/* ======================================================== */}
      {panelTab === "colleges" && (
        <div style={{ display: "grid", gap: "8px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>
              {ARAPONGAS_POLLING_PLACES.length} Colégios Oficiais (61ª Zona):
            </span>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                    detail: { district: "Todos os Bairros", initialTab: "colleges" },
                  }),
                );
              }}
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#0284c7",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                padding: "2px 4px",
              }}
            >
              Ver todos →
            </button>
          </div>

          {ARAPONGAS_POLLING_PLACES.map((place: PollingPlace) => (
            <div
              key={place.id}
              style={{
                background: "#ffffff",
                border: "1.5px solid #e2e8f0",
                borderRadius: "12px",
                padding: "10px 12px",
                display: "grid",
                gap: "6px",
                transition: "all 0.15s ease",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                <strong style={{ fontSize: "13px", color: "#0f172a", lineHeight: "1.2" }}>
                  {place.shortName || place.name}
                </strong>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#0369a1",
                    background: "#e0f2fe",
                    padding: "2px 6px",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {NUMBER.format(place.totalVoters)} el.
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                📍 {place.district} · {place.sectionsCount} seções
              </div>
              <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                        detail: { district: place.district, initialTab: "electoral" },
                      }),
                    );
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: "6px",
                    background: "#0284c7",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 800,
                    border: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  🗳️ Ver Apuração Deste Colégio →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: ELEIÇÕES HISTÓRICAS DO TSE                        */}
      {/* ======================================================== */}
      {panelTab === "elections" && (
        <div style={{ display: "grid", gap: "10px" }}>
          {/* Botão de Destaque para o Painel Completo do TSE */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                  detail: { district: "Todos os Bairros", initialTab: "electoral" },
                }),
              );
            }}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0d2342 0%, #0284c7 100%)",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 900,
              border: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
            }}
          >
            🏛️ Abrir Painel Completo TSE (7 Cargos) →
          </button>

          {/* Seletor de Ano */}
          <div style={{ display: "flex", gap: "6px" }}>
            {[2024, 2022, 2020].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                style={{
                  flex: 1,
                  padding: "6px",
                  borderRadius: "8px",
                  background: selectedYear === yr ? "#0d2342" : "#f1f5f9",
                  color: selectedYear === yr ? "#ffffff" : "#475569",
                  fontSize: "12px",
                  fontWeight: 800,
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Seletor de Cargo na Sequência Exata Solicitada */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {[
              { id: "presidente", label: "Presidente", year: 2022 },
              { id: "senador", label: "Senador", year: 2022 },
              { id: "governador", label: "Governador", year: 2022 },
              { id: "deputado_federal", label: "Dep. Federal", year: 2022 },
              { id: "deputado_estadual", label: "Dep. Estadual", year: 2022 },
              { id: "prefeito", label: "Prefeito", year: 2024 },
              { id: "vereador", label: "Vereador", year: 2024 },
            ].map((off) => {
              const isSelected = selectedOffice === off.id;
              return (
                <button
                  key={off.id}
                  type="button"
                  onClick={() => {
                    setSelectedOffice(off.id);
                    if (off.id === "prefeito" || off.id === "vereador") {
                      if (selectedYear !== 2024 && selectedYear !== 2020) setSelectedYear(2024);
                    } else {
                      setSelectedYear(2022);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: isSelected ? "#0284c7" : "#ffffff",
                    color: isSelected ? "#ffffff" : "#0284c7",
                    border: "1px solid #0284c7",
                    fontSize: "11px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {off.label}
                </button>
              );
            })}
          </div>

          {/* Resumo de Votos e Candidatos */}
          <div style={{ maxHeight: "300px", overflowY: "auto", display: "grid", gap: "6px", paddingRight: "2px" }}>
            {activeOfficeData?.candidates?.slice(0, 6).map((c: CandidateResult, index: number) => {
              const color = PARTY_COLORS[c.party] || "#2563eb";
              return (
                <div
                  key={c.name}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    display: "grid",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "12px", color: "#0f172a" }}>
                        {index + 1}. {c.name}
                      </strong>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          color: "#fff",
                          background: color,
                          padding: "1px 5px",
                          borderRadius: "4px",
                          marginLeft: "6px",
                        }}
                      >
                        {c.party}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7" }}>
                      {PERCENT.format(c.percentage)}%
                    </span>
                  </div>
                  <div style={{ height: "5px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(3, c.percentage))}%`,
                        background: color,
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                  <small style={{ fontSize: "10px", color: "#64748b" }}>
                    {NUMBER.format(c.votes)} votos nominais
                  </small>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => openDistrictDrawer("Centro")}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "8px",
              background: "#0284c7",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 800,
              border: 0,
              cursor: "pointer",
              marginTop: "4px",
            }}
          >
            📊 Abrir Painel Completo de Apuração →
          </button>
        </div>
      )}
    </aside>
  );

  return target ? createPortal(<>{mobileSwitch}{panel}</>, target) : null;
}
