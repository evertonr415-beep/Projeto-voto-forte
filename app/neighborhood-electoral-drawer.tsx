"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./supabase-client";
import type { PollingPlace, ElectionYearData, CandidateResult } from "./electoral-tse-data";

type ContactItem = {
  id: number;
  name?: string;
  phone?: string;
  district?: string;
  street?: string;
  number?: string;
  kind?: "Eleitor" | "Liderança";
  ownerEmail?: string;
};

type DrawerData = {
  district: string;
  totalContacts: number;
  contacts: ContactItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  pollingPlaces: PollingPlace[];
  selectedPollingPlace: PollingPlace | null;
  elections: ElectionYearData[];
};

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

export default function NeighborhoodElectoralDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [district, setDistrict] = useState("Centro");
  const [activeTab, setActiveTab] = useState<"contacts" | "colleges" | "electoral">("contacts");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DrawerData | null>(null);

  // Filtros internos
  const [searchContact, setSearchContact] = useState("");
  const [contactProfileFilter, setContactProfileFilter] = useState<string>("");
  const [contactPage, setContactPage] = useState(1);
  const [searchCollege, setSearchCollege] = useState("");
  const [searchCandidate, setSearchCandidate] = useState("");
  const [selectedPollingPlaceId, setSelectedPollingPlaceId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedOffice, setSelectedOffice] = useState<string>("prefeito");

  // Injetor de botões na barra lateral caso necessário
  useEffect(() => {
    const ensureSidebarItems = () => {
      const nav = document.querySelector<HTMLElement>(".sidebar nav");
      if (!nav) return;

      const broadcastBtn = nav.querySelector(".whaticket-broadcast-sidebar-btn");
      if (broadcastBtn && !nav.querySelector(".tse-colleges-sidebar-btn")) {
        const collegesBtn = document.createElement("button");
        collegesBtn.type = "button";
        collegesBtn.className = "tse-colleges-sidebar-btn";
        collegesBtn.title = "Colégios de Votação TSE";
        collegesBtn.innerHTML = `
          <span class="nav-icon" style="color: #38bdf8">🏫</span>
          <span class="nav-name">Colégios de Votação</span>
          <em style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4)">TSE</em>
        `;
        collegesBtn.addEventListener("click", () => {
          setDistrict("Centro");
          setActiveTab("colleges");
          setIsOpen(true);
        });

        const electionsBtn = document.createElement("button");
        electionsBtn.type = "button";
        electionsBtn.className = "tse-elections-sidebar-btn";
        electionsBtn.title = "Histórico Eleitoral TSE";
        electionsBtn.innerHTML = `
          <span class="nav-icon" style="color: #fbbf24">🗳️</span>
          <span class="nav-name">Histórico Eleitoral</span>
          <em style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4)">OFICIAL</em>
        `;
        electionsBtn.addEventListener("click", () => {
          setDistrict("Centro");
          setActiveTab("electoral");
          setIsOpen(true);
        });

        if (broadcastBtn.nextSibling) {
          nav.insertBefore(collegesBtn, broadcastBtn.nextSibling);
          nav.insertBefore(electionsBtn, collegesBtn.nextSibling);
        } else {
          nav.appendChild(collegesBtn);
          nav.appendChild(electionsBtn);
        }
      }
    };

    ensureSidebarItems();
    const observer = new MutationObserver(ensureSidebarItems);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Escuta eventos de abertura
  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ district?: string; initialTab?: "contacts" | "colleges" | "electoral" }>).detail;
      const targetDistrict = String(detail?.district || "Centro").trim();
      setDistrict(targetDistrict);
      if (detail?.initialTab) setActiveTab(detail.initialTab);
      setSelectedPollingPlaceId("");
      setContactPage(1);
      setSearchContact("");
      setSearchCollege("");
      setSearchCandidate("");
      setIsOpen(true);
    };

    window.addEventListener("voto-forte:open-neighborhood-electoral-drawer", handleOpen);
    return () => {
      window.removeEventListener("voto-forte:open-neighborhood-electoral-drawer", handleOpen);
    };
  }, []);

  // Busca dados sob demanda
  useEffect(() => {
    if (!isOpen || !district) return;
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          district,
          page: String(contactPage),
          pageSize: "15",
          year: String(selectedYear),
        });
        if (searchContact) params.set("q", searchContact);
        if (selectedPollingPlaceId) params.set("pollingPlaceId", selectedPollingPlaceId);
        if (selectedOffice) params.set("office", selectedOffice);

        const response = await apiFetch(`/api/electoral-territory?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await response.json();
        if (!cancelled && response.ok) {
          setData(json);
        }
      } catch (err) {
        console.error("Falha ao carregar dados territoriais", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [district, isOpen, contactPage, searchContact, selectedPollingPlaceId, selectedYear, selectedOffice]);

  // Atualiza cargo padrão ao mudar de ano
  useEffect(() => {
    if (selectedYear === 2024 || selectedYear === 2020) {
      setSelectedOffice("prefeito");
    } else if (selectedYear === 2022) {
      setSelectedOffice("presidente");
    }
  }, [selectedYear]);

  // Eleição e cargo ativos
  const activeYearData = useMemo(() => {
    return data?.elections?.find((e) => e.year === selectedYear) || data?.elections?.[0] || null;
  }, [data?.elections, selectedYear]);

  const activeOfficeData = useMemo(() => {
    return (
      activeYearData?.offices?.find((o) => o.office === selectedOffice) ||
      activeYearData?.offices?.[0] ||
      null
    );
  }, [activeYearData, selectedOffice]);

  // Filtra candidatos na busca rápida
  const filteredCandidates = useMemo(() => {
    if (!activeOfficeData?.candidates) return [];
    if (!searchCandidate.trim()) return activeOfficeData.candidates;
    const query = searchCandidate.toLowerCase().trim();
    return activeOfficeData.candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.party.toLowerCase().includes(query) ||
        String(c.ballotNumber || "").includes(query),
    );
  }, [activeOfficeData?.candidates, searchCandidate]);

  // Filtra colégios na busca rápida
  const filteredColleges = useMemo(() => {
    if (!data?.pollingPlaces) return [];
    if (!searchCollege.trim()) return data.pollingPlaces;
    const query = searchCollege.toLowerCase().trim();
    return data.pollingPlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.shortName && p.shortName.toLowerCase().includes(query)) ||
        p.address.toLowerCase().includes(query) ||
        p.district.toLowerCase().includes(query) ||
        p.sections.some((s) => String(s).includes(query)),
    );
  }, [data?.pollingPlaces, searchCollege]);

  // Filtra contatos por perfil
  const filteredContacts = useMemo(() => {
    if (!data?.contacts) return [];
    if (!contactProfileFilter) return data.contacts;
    return data.contacts.filter((c) => c.kind === contactProfileFilter);
  }, [data?.contacts, contactProfileFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="vf-neighborhood-drawer-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13, 35, 66, 0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 9990,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0",
        overflow: "hidden",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        className="vf-neighborhood-drawer-panel"
        style={{
          width: "min(860px, 100%)",
          height: "92vh",
          maxHeight: "92vh",
          background: "#ffffff",
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          animation: "vfDrawerSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Cabeçalho Principal */}
        <header
          style={{
            background: "linear-gradient(135deg, #0d2342 0%, #17345c 100%)",
            color: "#ffffff",
            padding: "16px 20px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#38bdf8",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  background: "rgba(56, 189, 248, 0.15)",
                  padding: "3px 8px",
                  borderRadius: "999px",
                }}
              >
                🗺️ Consulta Territorial Oficial
              </span>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>
                Arapongas · PR (61ª Zona)
              </span>
            </div>
            <h2 style={{ margin: "2px 0 0", fontSize: "22px", fontWeight: 900, color: "#ffffff", letterSpacing: "-0.3px" }}>
              {district}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", fontSize: "12px", color: "#cbd5e1" }}>
              <span>👥 <b>{NUMBER.format(data?.totalContacts ?? 0)}</b> contatos</span>
              <span>🏫 <b>{data?.pollingPlaces?.length ?? 0}</b> colégios</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("voto-forte:open-whatsapp-district-modal", {
                    detail: { district },
                  }),
                );
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                background: "#16a34a",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 800,
                border: 0,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
              }}
            >
              📲 Disparo WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                border: 0,
                color: "#ffffff",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "18px",
                fontWeight: 900,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              ✕
            </button>
          </div>
        </header>

        {/* Barra de Abas de Navegação */}
        <nav
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            background: "#f8fafc",
            borderBottom: "1.5px solid #e2e8f0",
            padding: "4px 8px 0",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("contacts")}
            style={{
              padding: "12px 6px",
              border: 0,
              background: "transparent",
              color: activeTab === "contacts" ? "#0284c7" : "#64748b",
              fontWeight: 800,
              fontSize: "13px",
              borderBottom: activeTab === "contacts" ? "3px solid #0284c7" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            📁 Contatos ({NUMBER.format(data?.totalContacts ?? 0)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("colleges")}
            style={{
              padding: "12px 6px",
              border: 0,
              background: "transparent",
              color: activeTab === "colleges" ? "#0284c7" : "#64748b",
              fontWeight: 800,
              fontSize: "13px",
              borderBottom: activeTab === "colleges" ? "3px solid #0284c7" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            🏫 Colégios TSE ({data?.pollingPlaces?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("electoral")}
            style={{
              padding: "12px 6px",
              border: 0,
              background: "transparent",
              color: activeTab === "electoral" ? "#0284c7" : "#64748b",
              fontWeight: 800,
              fontSize: "13px",
              borderBottom: activeTab === "electoral" ? "3px solid #0284c7" : "3px solid transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            🗳️ Histórico TSE
          </button>
        </nav>

        {/* Conteúdo Principal com Rolagem Suave */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", background: "#f8fafc" }}>
          {/* ======================================================== */}
          {/* ABA 1: CONTATOS DO BAIRRO                                */}
          {/* ======================================================== */}
          {activeTab === "contacts" && (
            <div style={{ display: "grid", gap: "12px" }}>
              {/* Barra de Busca e Filtros Rápidos */}
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="search"
                    value={searchContact}
                    onChange={(e) => {
                      setSearchContact(e.target.value);
                      setContactPage(1);
                    }}
                    placeholder={`🔍 Buscar por nome, telefone ou rua em ${district}...`}
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "14px",
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                  {searchContact && (
                    <button
                      type="button"
                      onClick={() => setSearchContact("")}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#e2e8f0",
                        border: 0,
                        borderRadius: "50%",
                        width: "20px",
                        height: "20px",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  {[
                    { label: "Todos", value: "" },
                    { label: "Eleitores", value: "Eleitor" },
                    { label: "Lideranças", value: "Liderança" },
                  ].map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => setContactProfileFilter(f.value)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        border: contactProfileFilter === f.value ? "1.5px solid #0284c7" : "1px solid #cbd5e1",
                        background: contactProfileFilter === f.value ? "#e0f2fe" : "#ffffff",
                        color: contactProfileFilter === f.value ? "#0369a1" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontWeight: 700 }}>
                  Carregando contatos de {district}...
                </div>
              ) : filteredContacts && filteredContacts.length > 0 ? (
                <div style={{ display: "grid", gap: "8px" }}>
                  {filteredContacts.map((c) => {
                    const cleanPhone = (c.phone || "").replace(/\D/g, "");
                    const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : "";
                    return (
                      <div
                        key={c.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "12px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                              {c.name || "Contato sem nome"}
                            </strong>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 7px",
                                borderRadius: "999px",
                                background: c.kind === "Liderança" ? "#fef3c7" : "#e0f2fe",
                                color: c.kind === "Liderança" ? "#92400e" : "#0369a1",
                              }}
                            >
                              {c.kind || "Eleitor"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                            📍 {c.street ? `${c.street}${c.number ? `, ${c.number}` : ""}` : district}
                          </div>
                        </div>

                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              background: "#dcfce7",
                              color: "#166534",
                              fontSize: "12px",
                              fontWeight: 800,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    );
                  })}

                  {/* Paginação */}
                  {data.totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                      <button
                        type="button"
                        disabled={contactPage <= 1}
                        onClick={() => setContactPage((p) => Math.max(1, p - 1))}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: contactPage <= 1 ? "not-allowed" : "pointer",
                        }}
                      >
                        ← Anterior
                      </button>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>
                        Página {data.page} de {data.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={contactPage >= data.totalPages}
                        onClick={() => setContactPage((p) => p + 1)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: contactPage >= data.totalPages ? "not-allowed" : "pointer",
                        }}
                      >
                        Próxima →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "26px", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "12px" }}>
                  Nenhum contato encontrado em {district}.
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 2: COLÉGIOS DE VOTAÇÃO (TSE)                         */}
          {/* ======================================================== */}
          {activeTab === "colleges" && (
            <div style={{ display: "grid", gap: "12px" }}>
              {/* Barra de Pesquisa Intuitiva de Colégios */}
              <div style={{ position: "relative" }}>
                <input
                  type="search"
                  value={searchCollege}
                  onChange={(e) => setSearchCollege(e.target.value)}
                  placeholder="🔍 Pesquisar colégio por nome, endereço, bairro ou seção..."
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
                {searchCollege && (
                  <button
                    type="button"
                    onClick={() => setSearchCollege("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "#e2e8f0",
                      border: 0,
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                {filteredColleges.map((place) => (
                  <div
                    key={place.id}
                    style={{
                      background: "#ffffff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: "#0284c7" }}>
                          {place.zone}
                        </span>
                        <h4 style={{ margin: "2px 0 0", fontSize: "16px", color: "#0f172a", fontWeight: 800 }}>
                          {place.name}
                        </h4>
                        <p style={{ margin: "3px 0 0", fontSize: "13px", color: "#64748b" }}>
                          📍 {place.address} — {place.district}
                        </p>
                      </div>
                      <span
                        style={{
                          background: "#e0f2fe",
                          color: "#0369a1",
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "4px 10px",
                          borderRadius: "999px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {NUMBER.format(place.totalVoters)} eleitores
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>
                        {place.sectionsCount} Seções:
                      </span>
                      {place.sections.map((sec) => (
                        <span
                          key={sec}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: "#f1f5f9",
                            color: "#334155",
                          }}
                        >
                          Sec. {sec}
                        </span>
                      ))}
                    </div>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "8px", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPollingPlaceId(place.id);
                          setActiveTab("electoral");
                        }}
                        style={{
                          padding: "7px 12px",
                          borderRadius: "8px",
                          background: "#0284c7",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 800,
                          border: 0,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        🗳️ Ver Resultados Eleitorais deste Colégio →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ABA 3: DADOS ELEITORAIS HISTÓRICOS (TSE)                 */}
          {/* ======================================================== */}
          {activeTab === "electoral" && (
            <div style={{ display: "grid", gap: "14px" }}>
              {/* Filtros de Ano, Cargo e Busca Rápida de Candidato */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  padding: "14px",
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gap: "10px",
                }}
              >
                {/* Seletor de Ano */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#334155" }}>Ano da Eleição:</span>
                  {[2024, 2022, 2020].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "8px",
                        background: selectedYear === yr ? "#0d2342" : "#f1f5f9",
                        color: selectedYear === yr ? "#ffffff" : "#475569",
                        fontSize: "13px",
                        fontWeight: 800,
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      {yr}
                    </button>
                  ))}
                </div>

                {/* Seletor de Cargo */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#334155" }}>Cargo:</span>
                  {activeYearData?.offices?.map((off) => (
                    <button
                      key={off.office}
                      type="button"
                      onClick={() => setSelectedOffice(off.office)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "8px",
                        background: selectedOffice === off.office ? "#0284c7" : "#ffffff",
                        color: selectedOffice === off.office ? "#ffffff" : "#0284c7",
                        border: "1px solid #0284c7",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {off.officeLabel}
                    </button>
                  ))}
                </div>

                {/* Barra de Pesquisa de Candidato */}
                <div style={{ position: "relative" }}>
                  <input
                    type="search"
                    value={searchCandidate}
                    onChange={(e) => setSearchCandidate(e.target.value)}
                    placeholder="🔍 Filtrar candidato por nome, partido ou número..."
                    style={{
                      width: "100%",
                      padding: "8px 32px 8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#f8fafc",
                      boxSizing: "border-box",
                    }}
                  />
                  {searchCandidate && (
                    <button
                      type="button"
                      onClick={() => setSearchCandidate("")}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "#e2e8f0",
                        border: 0,
                        borderRadius: "50%",
                        width: "18px",
                        height: "18px",
                        fontSize: "10px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filtro de Colégio Ativo */}
                {selectedPollingPlaceId && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#0369a1",
                    }}
                  >
                    <span>
                      🏫 Filtrado por: <b>{data?.selectedPollingPlace?.name}</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPollingPlaceId("")}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #7dd3fc",
                        color: "#0284c7",
                        borderRadius: "6px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Limpar filtro de colégio ×
                    </button>
                  </div>
                )}
              </div>

              {/* Estatísticas Gerais da Votação */}
              {activeOfficeData && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "10px",
                  }}
                >
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <small style={{ fontSize: "10px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                      Votos Válidos
                    </small>
                    <b style={{ display: "block", fontSize: "18px", color: "#0f172a", marginTop: "2px" }}>
                      {NUMBER.format(activeOfficeData.totalValidVotes)}
                    </b>
                  </div>
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <small style={{ fontSize: "10px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                      Votos Brancos
                    </small>
                    <b style={{ display: "block", fontSize: "18px", color: "#64748b", marginTop: "2px" }}>
                      {NUMBER.format(activeOfficeData.blankVotes)}
                    </b>
                  </div>
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <small style={{ fontSize: "10px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                      Votos Nulos
                    </small>
                    <b style={{ display: "block", fontSize: "18px", color: "#64748b", marginTop: "2px" }}>
                      {NUMBER.format(activeOfficeData.nullVotes)}
                    </b>
                  </div>
                </div>
              )}

              {/* Tabela e Cards dos Candidatos e Votação */}
              {filteredCandidates && filteredCandidates.length > 0 ? (
                <div style={{ display: "grid", gap: "8px" }}>
                  {filteredCandidates.map((c: CandidateResult, index: number) => {
                    const partyColor = PARTY_COLORS[c.party] || "#2563eb";
                    return (
                      <div
                        key={c.name}
                        style={{
                          background: "#ffffff",
                          border: "1.5px solid #e2e8f0",
                          borderRadius: "14px",
                          padding: "12px 14px",
                          display: "grid",
                          gap: "6px",
                          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                background: index === 0 ? "#fef08a" : "#f1f5f9",
                                color: index === 0 ? "#854d0e" : "#475569",
                                fontWeight: 900,
                                fontSize: "12px",
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              {index + 1}
                            </span>
                            <div>
                              <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                                {c.name} {c.ballotNumber ? `(${c.ballotNumber})` : ""}
                              </strong>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  color: "#ffffff",
                                  background: partyColor,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  marginLeft: "8px",
                                }}
                              >
                                {c.party}
                              </span>
                              {c.elected && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 900,
                                    color: "#166534",
                                    background: "#dcfce7",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    marginLeft: "6px",
                                  }}
                                >
                                  🏆 ELEITO
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <b style={{ fontSize: "15px", color: "#0f172a" }}>
                              {NUMBER.format(c.votes)} votos
                            </b>
                            <span style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#0284c7" }}>
                              {PERCENT.format(c.percentage)}%
                            </span>
                          </div>
                        </div>

                        {/* Barra de Progresso Visual de Votos */}
                        <div
                          style={{
                            height: "7px",
                            background: "#f1f5f9",
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, Math.max(2, c.percentage))}%`,
                              background: partyColor,
                              borderRadius: "999px",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>

                        {c.coalition && (
                          <small style={{ fontSize: "11px", color: "#64748b" }}>
                            Coligação: {c.coalition}
                          </small>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "26px", textAlign: "center", color: "#64748b", background: "#ffffff", borderRadius: "12px" }}>
                  Nenhum candidato encontrado com a busca "{searchCandidate}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
