"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./supabase-client";
import {
  ARAPONGAS_POLLING_PLACES,
  type PollingPlace,
  type ElectionYearData,
  type CandidateResult,
} from "./electoral-tse-data";

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
  PV: "#15803d",
  PROS: "#b45309",
  PSB: "#c2410c",
};

// Sequência exata de cargos solicitada pelo usuário
const ORDERED_OFFICES = [
  { id: "presidente", label: "Presidente", icon: "🇧🇷", defaultYear: 2022, availableYears: [2022], scope: "Federal" },
  { id: "senador", label: "Senador", icon: "🏛️", defaultYear: 2022, availableYears: [2022], scope: "Paraná" },
  { id: "governador", label: "Governador", icon: "🏢", defaultYear: 2022, availableYears: [2022], scope: "Paraná" },
  { id: "deputado_federal", label: "Dep. Federal", icon: "🏛️", defaultYear: 2022, availableYears: [2022], scope: "Federal" },
  { id: "deputado_estadual", label: "Dep. Estadual", icon: "🏛️", defaultYear: 2022, availableYears: [2022], scope: "Estadual" },
  { id: "prefeito", label: "Prefeito", icon: "👔", defaultYear: 2024, availableYears: [2024, 2020], scope: "Municipal" },
  { id: "vereador", label: "Vereador", icon: "🗳️", defaultYear: 2024, availableYears: [2024, 2020], scope: "Municipal" },
] as const;

// Lista de bairros de referência de Arapongas
const ARAPONGAS_DEFAULT_DISTRICTS = [
  "Centro",
  "Jardim San Raphael",
  "Conjunto Flamingos",
  "Jardim Panorama",
  "Jardim Caravelle",
  "Vila Nova",
  "Conjunto Del Condor",
  "Jardim Primavera",
  "Vila Araponguinha",
  "Jardim Petrópolis",
  "Jardim Columbia",
  "Jardim Mônaco",
  "Jardim Aeroporto",
  "Conjunto Palmares",
  "Jardim Vale das Perobas",
  "Jardim Bandeirantes",
  "Jardim Interlagos",
  "Parque Industrial",
  "Vila Aparecida",
  "Jardim Tropical",
  "Jardim Santa Alice",
  "Conjunto Águias",
  "Jardim Universitário",
  "Zona Rural",
];

export default function NeighborhoodElectoralDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [district, setDistrict] = useState("Centro");
  const [activeTab, setActiveTab] = useState<"contacts" | "colleges" | "electoral">("electoral");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DrawerData | null>(null);

  // Lista dinâmica de todos os bairros
  const [availableDistricts, setAvailableDistricts] = useState<string[]>(ARAPONGAS_DEFAULT_DISTRICTS);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [searchDistrictQuery, setSearchDistrictQuery] = useState("");
  const [showAllColleges, setShowAllColleges] = useState(false);

  // Filtros internos
  const [searchContact, setSearchContact] = useState("");
  const [contactProfileFilter, setContactProfileFilter] = useState<string>("");
  const [contactPage, setContactPage] = useState(1);
  const [searchCollege, setSearchCollege] = useState("");
  const [searchCandidate, setSearchCandidate] = useState("");
  const [selectedPollingPlaceId, setSelectedPollingPlaceId] = useState<string>("");

  // Sequência e seleção de cargos
  const [selectedOffice, setSelectedOffice] = useState<string>("presidente");
  const [selectedYear, setSelectedYear] = useState<number>(2022);

  // Carrega todos os bairros existentes no banco
  useEffect(() => {
    void apiFetch("/api/contacts?mode=summary", { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.districts && Array.isArray(json.districts)) {
          const names: string[] = json.districts
            .map((d: { district?: string }) => String(d?.district || "").trim())
            .filter(Boolean);
          const combined = Array.from(new Set([...names, ...ARAPONGAS_DEFAULT_DISTRICTS])).sort((a, b) =>
            a.localeCompare(b, "pt-BR"),
          );
          setAvailableDistricts(combined);
        }
      })
      .catch(() => undefined);
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
      setShowDistrictModal(false);
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
        if (showAllColleges) params.set("allColleges", "true");
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
  }, [district, isOpen, contactPage, searchContact, selectedPollingPlaceId, selectedYear, selectedOffice, showAllColleges]);

  // Manipulador da troca de cargo garantindo o ano correto
  const handleOfficeSelect = (officeId: string) => {
    const meta = ORDERED_OFFICES.find((o) => o.id === officeId);
    if (!meta) return;
    setSelectedOffice(officeId);
    if (!meta.availableYears.includes(selectedYear as never)) {
      setSelectedYear(meta.defaultYear);
    }
  };

  const activeOfficeMeta = useMemo(() => {
    return ORDERED_OFFICES.find((o) => o.id === selectedOffice) || ORDERED_OFFICES[0];
  }, [selectedOffice]);

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

  // Filtra lista de bairros do modal de busca
  const filteredDistrictsList = useMemo(() => {
    if (!searchDistrictQuery.trim()) return availableDistricts;
    const q = searchDistrictQuery.toLowerCase().trim();
    return availableDistricts.filter((d) => d.toLowerCase().includes(q));
  }, [availableDistricts, searchDistrictQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="vf-neighborhood-drawer-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13, 35, 66, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9990,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "12px",
        overflow: "hidden",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowDistrictModal(false);
          setIsOpen(false);
        }
      }}
    >
      <div
        className="vf-neighborhood-drawer-panel"
        style={{
          width: "min(920px, 100%)",
          height: "92vh",
          maxHeight: "92vh",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          animation: "vfDrawerSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          position: "relative",
        }}
      >
        {/* ======================================================== */}
        {/* MODAL DE BUSCA DE BAIRRO                                 */}
        {/* ======================================================== */}
        {showDistrictModal && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(15, 23, 42, 0.8)",
              zIndex: 200,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "20px",
                width: "min(480px, 100%)",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>
                    📍 Selecionar Bairro
                  </h3>
                  <small style={{ color: "#64748b" }}>Escolha o bairro de Arapongas para consultar</small>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDistrictModal(false)}
                  style={{
                    background: "#f1f5f9",
                    border: 0,
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <input
                type="search"
                autoFocus
                value={searchDistrictQuery}
                onChange={(e) => setSearchDistrictQuery(e.target.value)}
                placeholder="🔍 Digite para filtrar bairros..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "14px",
                  marginBottom: "12px",
                  boxSizing: "border-box",
                }}
              />

              <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: "6px", paddingRight: "4px" }}>
                {filteredDistrictsList.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDistrict(d);
                      setContactPage(1);
                      setShowDistrictModal(false);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: d === district ? "2px solid #0284c7" : "1px solid #e2e8f0",
                      background: d === district ? "#e0f2fe" : "#ffffff",
                      color: d === district ? "#0369a1" : "#1e293b",
                      fontWeight: d === district ? 900 : 600,
                      fontSize: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{d}</span>
                    {d === district && <span style={{ fontSize: "12px", fontWeight: 800 }}>✓ Selecionado</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* CABEÇALHO PRINCIPAL COM SELETOR DE BAIRRO VISÍVEL        */}
        {/* ======================================================== */}
        <header
          style={{
            background: "linear-gradient(135deg, #0d2342 0%, #17345c 100%)",
            color: "#ffffff",
            padding: "14px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Lado Esquerdo: Identificação e Seletor de Bairro no Computador e Mobile */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 900,
                    color: "#38bdf8",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: "rgba(56, 189, 248, 0.15)",
                    padding: "2px 7px",
                    borderRadius: "999px",
                  }}
                >
                  🏛️ Informações TSE
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>
                  Arapongas · PR (61ª Zona)
                </span>
              </div>

              {/* SELETOR DE BAIRRO CLARO E VISÍVEL NO COMPUTADOR */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <label style={{ fontSize: "12px", color: "#cbd5e1", fontWeight: 700 }}>
                  Bairro:
                </label>
                <select
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setContactPage(1);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 900,
                    fontSize: "14px",
                    border: "2px solid #38bdf8",
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: "230px",
                  }}
                >
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSearchDistrictQuery("");
                    setShowDistrictModal(true);
                  }}
                  title="Abrir busca rápida de bairros"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  🔍 Buscar Bairro
                </button>
              </div>
            </div>
          </div>

          {/* Lado Direito: Ações Rápidas */}
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
              📲 Disparar WhatsApp
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
            🏫 Colégios de Votação ({data?.pollingPlaces?.length ?? 0})
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
            🗳️ Dados Eleitorais (TSE)
          </button>
        </nav>

        {/* Conteúdo Principal com Rolagem Suave */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", background: "#f8fafc" }}>
          {/* ======================================================== */}
          {/* ABA 1: CONTATOS DO BAIRRO                                */}
          {/* ======================================================== */}
          {activeTab === "contacts" && (
            <div style={{ display: "grid", gap: "12px" }}>
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
              {/* Seletor de Escopo de Colégios */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowAllColleges(false)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: !showAllColleges ? "#0284c7" : "#ffffff",
                    color: !showAllColleges ? "#ffffff" : "#0284c7",
                    border: "1.5px solid #0284c7",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  📍 Colégios de {district} ({filteredColleges.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllColleges(true)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: showAllColleges ? "#0284c7" : "#ffffff",
                    color: showAllColleges ? "#ffffff" : "#0284c7",
                    border: "1.5px solid #0284c7",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  🏛️ Ver Todos os 18 Colégios de Arapongas
                </button>
              </div>

              {/* Barra de Pesquisa */}
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
                          📍 {place.address} — <b>{place.district}</b>
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
            <div style={{ display: "grid", gap: "12px" }}>
              {/* PAINEL DE CONTROLE DE CARGOS NA SEQUÊNCIA EXATA SOLICITADA */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  padding: "14px",
                  border: "1.5px solid #e2e8f0",
                  display: "grid",
                  gap: "12px",
                }}
              >
                {/* 1. SELEÇÃO DE CARGO NA SEQUÊNCIA EXATA SOLICITADA */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Selecione a Categoria de Votação:
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7" }}>
                      Dados Oficiais TSE (61ª Zona)
                    </span>
                  </div>

                  {/* BOTOES DE CARGO NA SEQUÊNCIA: Presidente, Senador, Governador, Deputado Federal, Deputado Estadual, Prefeito, Vereador */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: "6px",
                    }}
                  >
                    {ORDERED_OFFICES.map((off) => {
                      const isSelected = selectedOffice === off.id;
                      return (
                        <button
                          key={off.id}
                          type="button"
                          onClick={() => handleOfficeSelect(off.id)}
                          style={{
                            padding: "9px 10px",
                            borderRadius: "10px",
                            border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                            background: isSelected ? "#0284c7" : "#ffffff",
                            color: isSelected ? "#ffffff" : "#1e293b",
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: isSelected ? "0 4px 10px rgba(2, 132, 199, 0.3)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span>{off.icon}</span>
                          <span>{off.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SELEÇÃO DE ANO DA ELEIÇÃO */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#475569" }}>
                    Ano da Eleição:
                  </span>
                  {activeOfficeMeta.availableYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "8px",
                        background: selectedYear === yr ? "#0d2342" : "#f1f5f9",
                        color: selectedYear === yr ? "#ffffff" : "#475569",
                        fontSize: "12px",
                        fontWeight: 800,
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      {yr} {yr === 2024 ? "(Mais Recente)" : yr === 2022 ? "(Eleições Gerais)" : "(Anterior)"}
                    </button>
                  ))}
                </div>

                {/* 3. BUSCA RÁPIDA DE CANDIDATO */}
                <div style={{ position: "relative" }}>
                  <input
                    type="search"
                    value={searchCandidate}
                    onChange={(e) => setSearchCandidate(e.target.value)}
                    placeholder={`🔍 Buscar candidato a ${activeOfficeMeta.label} por nome, número ou partido...`}
                    style={{
                      width: "100%",
                      padding: "9px 34px 9px 12px",
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

                {/* FILTRO DE COLÉGIO ATIVO */}
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
                      🏫 Apuração das seções de: <b>{data?.selectedPollingPlace?.name}</b>
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
                      Remover filtro de colégio ×
                    </button>
                  </div>
                )}
              </div>

              {/* RESUMO DE VOTOS TOTAIS DA ELEIÇÃO */}
              {activeOfficeData && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                  }}
                >
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <small style={{ fontSize: "9px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                      Votos Válidos
                    </small>
                    <b style={{ display: "block", fontSize: "16px", color: "#0f172a", marginTop: "1px" }}>
                      {NUMBER.format(activeOfficeData.totalValidVotes)}
                    </b>
                  </div>
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <small style={{ fontSize: "9px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                      Votos Brancos
                    </small>
                    <b style={{ display: "block", fontSize: "16px", color: "#64748b", marginTop: "1px" }}>
                      {NUMBER.format(activeOfficeData.blankVotes)}
                    </b>
                  </div>
                  <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <small style={{ fontSize: "9px", color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>
                      Votos Nulos
                    </small>
                    <b style={{ display: "block", fontSize: "16px", color: "#64748b", marginTop: "1px" }}>
                      {NUMBER.format(activeOfficeData.nullVotes)}
                    </b>
                  </div>
                </div>
              )}

              {/* LISTAGEM DE CANDIDATOS E RESULTADOS OFICIAIS DO TSE */}
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
