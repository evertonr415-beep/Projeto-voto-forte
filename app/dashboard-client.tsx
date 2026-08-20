"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, supabase } from "./supabase-client";
import MeetingInteractiveCalendar from "./meeting-interactive-calendar";
import InstitutionalCommunicationClient from "./comunicacao-institucional/institutional-communication-client";
import InteractiveElectoralMap from "./electoral-map/interactive-electoral-map";

type View =
  | "Visão Geral"
  | "Contatos"
  | "Agenda Inteligente"
  | "Mapa Eleitoral"
  | "Comunicação Institucional"
  | "WhatsApp"
  | "Administração";
type Modal =
  | null
  | "cadastro"
  | "cadastro_lideranca"
  | "reuniao"
  | "filtros"
  | "perfil";

const menu: { label: View; icon: string; badge?: string }[] = [
  { label: "Visão Geral", icon: "▦" },
  { label: "Contatos", icon: "☷", badge: "NOVO" },
  { label: "Agenda Inteligente", icon: "◫", badge: "NOVO" },
  { label: "Mapa Eleitoral", icon: "✢", badge: "MAPA" },
  { label: "WhatsApp", icon: "◉" },
];

function Brand() {
  return (
    <div className="brand-lockup">
      <div className="brand-icons">
        <img
          className="parana-icon"
          src="/parana-icon-small.jpg"
          alt="Mapa do Estado do Paraná"
        />
      </div>
      <div>
        <strong>VOTO FORTE</strong>
        <div className="brand-state">
          <b>PARANÁ</b>
        </div>
      </div>
    </div>
  );
}

export type CurrentUser = {
  email: string;
  name: string;
  role: "master" | "admin" | "user";
};
type ManagedUser = {
  id: number;
  email: string;
  name: string;
  role: CurrentUser["role"];
  status: "active" | "blocked";
  lastSeenAt: string | null;
};
type AuditItem = {
  id: number;
  actorEmail: string;
  action: string;
  detail: string;
  createdAt: string;
};
type Contact = {
  name: string;
  phone: string;
  district: string;
  leader: string;
  kind: "Eleitor" | "Liderança";
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: "exact" | "approximate";
};
type Meeting = {
  title: string;
  date: string;
  day?: string;
  time?: string;
  address?: string;
  place: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
};
type Draft = { title: string; message: string };
type OwnedRecord = {
  id: number;
  ownerEmail: string;
  kind: "contact" | "meeting" | "draft";
  payload: Contact | Meeting | Draft;
  createdAt: string;
  updatedAt: string;
};
type OverviewSummary = {
  total: number;
  voters: number;
  leaders: number;
  meetings: number;
  districtsReached: number;
};

const EMPTY_OVERVIEW_SUMMARY: OverviewSummary = {
  total: 0,
  voters: 0,
  leaders: 0,
  meetings: 0,
  districtsReached: 0,
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "VF"
  );
}
function roleLabel(role: CurrentUser["role"]) {
  return role === "master"
    ? "Administrador Master"
    : role === "admin"
      ? "Administrador"
      : "Usuário";
}

export default function DashboardClient({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  const isAdmin = currentUser.role === "master" || currentUser.role === "admin";
  const [view, setView] = useState<View>("Visão Geral");
  const [modal, setModal] = useState<Modal>(null);
  const [presetMeetingDay, setPresetMeetingDay] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const open = useCallback((nextModal: Modal, dayPreset?: string) => {
    if (dayPreset) setPresetMeetingDay(dayPreset);
    else setPresetMeetingDay("");
    setModal(nextModal);
  }, []);
  const [records, setRecords] = useState<OwnedRecord[]>([]);
  const [availableUsers, setAvailableUsers] = useState<ManagedUser[]>([]);
  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [overviewSummary, setOverviewSummary] = useState<OverviewSummary>(
    EMPTY_OVERVIEW_SUMMARY,
  );
  const [overviewMeetings, setOverviewMeetings] = useState<
    (Meeting & { id: number; ownerEmail: string })[]
  >([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [contactsLoadedScope, setContactsLoadedScope] = useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [meetingsLoadedScope, setMeetingsLoadedScope] = useState<string | null>(null);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [draftsLoadedScope, setDraftsLoadedScope] = useState<string | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [contactFilter, setContactFilter] = useState<Contact["kind"] | "Todos">(
    "Todos",
  );
  const [contactDistrictFilter, setContactDistrictFilter] = useState("");

  const closeMapPopup = () => {
    window.dispatchEvent(new CustomEvent("voto-forte:close-map-popup"));
  };

  useEffect(() => {
    const openDistrictContacts = (event: Event) => {
      const district = String(
        (event as CustomEvent<{ district?: string }>).detail?.district || "",
      ).trim();
      if (!district) return;
      closeMapPopup();
      setContactFilter("Todos");
      setContactDistrictFilter(district);
      setView("Contatos");
      if (window.matchMedia("(max-width: 900px)").matches) setCollapsed(false);
    };
    window.addEventListener(
      "voto-forte:open-district-contacts",
      openDistrictContacts,
    );
    return () =>
      window.removeEventListener(
        "voto-forte:open-district-contacts",
        openDistrictContacts,
      );
  }, []);

  const closeMobileSidebar = useCallback(() => {
    closeMapPopup();
    if (typeof window !== "undefined" && window.innerWidth <= 1050) {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    const handleCloseMobile = () => {
      setCollapsed(false);
    };
    window.addEventListener("voto-forte:close-mobile-sidebar", handleCloseMobile);
    return () => {
      window.removeEventListener("voto-forte:close-mobile-sidebar", handleCloseMobile);
    };
  }, []);

  const navigateTo = (nextView: View) => {
    closeMapPopup();
    if (nextView === "Contatos") {
      setContactFilter("Todos");
      setContactDistrictFilter("");
    }
    setView(nextView);
    if (typeof window !== "undefined" && window.innerWidth <= 1050) {
      setCollapsed(false);
    }
  };

  const visibleMenu = isAdmin
    ? menu
    : menu.filter((item) => item.label !== "Administração");
  useEffect(() => {
    apiFetch("/api/audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "Acesso ao sistema",
        detail: "Sessão iniciada",
      }),
    }).catch(() => undefined);
    if (isAdmin)
      apiFetch("/api/users")
        .then((r) => r.json())
        .then((data) =>
          setAvailableUsers(
            (data.users || []).filter(
              (user: ManagedUser) => user.status === "active",
            ),
          ),
        )
        .catch(() => undefined);
  }, [isAdmin]);
  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [summaryResponse, meetingsResponse] = await Promise.all([
        apiFetch(
          `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
          { cache: "no-store" },
        ),
        apiFetch(
          `/api/records?owner=${encodeURIComponent(scope)}&kind=meeting&mode=overview`,
          { cache: "no-store" },
        ),
      ]);
      const [summaryData, meetingsData] = await Promise.all([
        summaryResponse.json(),
        meetingsResponse.json(),
      ]);
      if (!summaryResponse.ok)
        throw new Error(summaryData.error || "Não foi possível carregar os indicadores.");
      if (!meetingsResponse.ok)
        throw new Error(meetingsData.error || "Não foi possível carregar os próximos compromissos.");
      setOverviewSummary({
        total: Number(summaryData.total || 0),
        voters: Number(summaryData.voters || 0),
        leaders: Number(summaryData.leaders || 0),
        meetings: Number(summaryData.meetings || 0),
        districtsReached: Number(summaryData.districtsReached || 0),
      });
      const previewRecords = Array.isArray(meetingsData.records)
        ? (meetingsData.records as OwnedRecord[])
        : [];
      setOverviewMeetings(
        previewRecords.map((record) => ({
          id: record.id,
          ownerEmail: record.ownerEmail,
          ...(record.payload as Meeting),
        })),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a Visão Geral agora.",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, [scope]);

  useEffect(() => {
    setRecords([]);
    setOverviewSummary(EMPTY_OVERVIEW_SUMMARY);
    setOverviewMeetings([]);
    setContactsLoadedScope(null);
    setMeetingsLoadedScope(null);
    setDraftsLoadedScope(null);
    setLoadingContacts(false);
    setLoadingMeetings(false);
    setLoadingDrafts(false);
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (
      (view !== "Contatos" && view !== "Mapa Eleitoral") ||
      contactsLoadedScope === scope
    )
      return;
    let cancelled = false;
    setLoadingContacts(true);
    apiFetch(
      `/api/records?owner=${encodeURIComponent(scope)}&kind=contact&mode=dashboard`,
      { cache: "no-store" },
    )
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar os contatos.");
        const contactRecords = Array.isArray(data.records)
          ? (data.records as OwnedRecord[])
          : [];
        setRecords((current) => [
          ...current.filter((record) => record.kind !== "contact"),
          ...contactRecords,
        ]);
        setContactsLoadedScope(scope);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os contatos agora.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingContacts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactsLoadedScope, scope, view]);

  useEffect(() => {
    if (view !== "Agenda Inteligente" || meetingsLoadedScope === scope) return;
    let cancelled = false;
    setLoadingMeetings(true);
    apiFetch(
      `/api/records?owner=${encodeURIComponent(scope)}&kind=meeting&mode=dashboard`,
      { cache: "no-store" },
    )
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar a agenda.");
        const meetingRecords = Array.isArray(data.records)
          ? (data.records as OwnedRecord[])
          : [];
        setRecords((current) => [
          ...current.filter((record) => record.kind !== "meeting"),
          ...meetingRecords,
        ]);
        setMeetingsLoadedScope(scope);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a agenda agora.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingMeetings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingsLoadedScope, scope, view]);
  useEffect(() => {
    if (view !== "WhatsApp" || draftsLoadedScope === scope) return;
    let cancelled = false;
    setLoadingDrafts(true);
    apiFetch(
      `/api/records?owner=${encodeURIComponent(scope)}&kind=draft&mode=dashboard`,
      { cache: "no-store" },
    )
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok)
          throw new Error(data.error || "Não foi possível carregar os rascunhos.");
        const draftRecords = Array.isArray(data.records)
          ? (data.records as OwnedRecord[])
          : [];
        setRecords((current) => [
          ...current.filter((record) => record.kind !== "draft"),
          ...draftRecords,
        ]);
        setDraftsLoadedScope(scope);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os rascunhos agora.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingDrafts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draftsLoadedScope, scope, view]);
  const contacts = records
    .filter((record) => record.kind === "contact")
    .map((record) => ({
      id: record.id,
      ownerEmail: record.ownerEmail,
      ...(record.payload as Contact),
    }));
  const meetings = records
    .filter((record) => record.kind === "meeting")
    .map((record) => ({
      id: record.id,
      ownerEmail: record.ownerEmail,
      ...(record.payload as Meeting),
    }));
  const drafts = records
    .filter((record) => record.kind === "draft")
    .map((record) => ({
      id: record.id,
      ownerEmail: record.ownerEmail,
      ...(record.payload as Draft),
    }));
  async function createRecord(
    kind: OwnedRecord["kind"],
    payload: Contact | Meeting | Draft,
  ) {
    const ownerEmail = scope === "all" ? currentUser.email : scope;
    const response = await apiFetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, payload, ownerEmail }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "Não foi possível salvar.");
      return false;
    }
    setRecords((current) => [data.record, ...current]);
    void loadOverview();
    setNotice(
      kind === "contact"
        ? "Cadastro salvo no ambiente correto."
        : kind === "meeting"
          ? "Reunião salva no ambiente correto."
          : "Rascunho salvo no ambiente correto.",
    );
    return true;
  }
  async function updateContact(id: number, payload: Contact) {
    const response = await apiFetch("/api/records", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, payload }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "Não foi possível editar o contato.");
      return false;
    }
    setRecords((current) =>
      current.map((record) => (record.id === id ? data.record : record)),
    );
    void loadOverview();
    setNotice("Contato atualizado com segurança.");
    return true;
  }
  async function updateMeeting(id: number, payload: Meeting) {
    const response = await apiFetch("/api/records", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, payload }),
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(data.error || "Não foi possível editar a reunião.");
      return false;
    }
    setRecords((current) =>
      current.map((record) => (record.id === id ? data.record : record)),
    );
    void loadOverview();
    setNotice("Reunião atualizada com segurança.");
    return true;
  }
  async function deleteRecord(id: number, label = "Registro") {
    const response = await apiFetch(`/api/records?id=${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setNotice(
        data.error || `Não foi possível excluir ${label.toLowerCase()}.`,
      );
      return false;
    }
    setRecords((current) => current.filter((record) => record.id !== id));
    void loadOverview();
    setNotice(`${label} excluído.`);
    return true;
  }
  const contextName =
    scope === "all"
      ? "Todos os usuários"
      : availableUsers.find((user) => user.email === scope)?.name ||
        currentUser.name;
  const openVoterReport = () => {
    setContactFilter("Eleitor");
    setView("Contatos");
  };
  const content = view === "Visão Geral" ? (
    loadingOverview ? (
      <div className="loading-state">Carregando indicadores…</div>
    ) : (
      <Overview
        go={setView}
        open={setModal}
        openVoterReport={openVoterReport}
        summary={overviewSummary}
        meetings={overviewMeetings}
        contextName={contextName}
        userName={currentUser.name}
      />
    )
  ) : view === "Contatos" ? (
    loadingContacts && contactsLoadedScope !== scope ? (
      <div className="loading-state">Carregando contatos…</div>
    ) : (
      <ContactManager
        contacts={contacts}
        open={setModal}
        filter={contactFilter}
        setFilter={setContactFilter}
        districtFilter={contactDistrictFilter}
        setDistrictFilter={setContactDistrictFilter}
        scope={scope}
        tell={setNotice}
        importContact={(payload) => createRecord("contact", payload)}
        updateContact={updateContact}
        deleteContact={(id) => deleteRecord(id, "Contato")}
        isAdmin={isAdmin}
      />
    )
  ) : view === "Agenda Inteligente" || view === "Comunicação Institucional" ? (
    <InstitutionalCommunicationClient />
  ) : view === "Mapa Eleitoral" ? (
    <InteractiveElectoralMap initialContacts={contacts} />
  ) : view === "WhatsApp" ? (
    loadingDrafts ? (
      <div className="loading-state">Carregando rascunhos…</div>
    ) : (
      <Whatsapp
        tell={setNotice}
        drafts={drafts}
        save={(payload) => createRecord("draft", payload)}
      />
    )
  ) : view === "Administração" && isAdmin ? (
    <Administration
      currentUser={currentUser}
      tell={setNotice}
      onUsersChange={setAvailableUsers}
    />
  ) : (
    <Overview
      go={setView}
      open={setModal}
      openVoterReport={openVoterReport}
      summary={overviewSummary}
      meetings={overviewMeetings}
      contextName={contextName}
      userName={currentUser.name}
    />
  );

  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      {/* Backdrop para fechar o menu mobile ao tocar fora */}
      <div
        className={`sidebar-backdrop ${collapsed ? "is-active" : ""}`}
        onClick={() => setCollapsed(false)}
        aria-hidden={!collapsed}
      />
      <aside className="sidebar">
        <div className="sidebar-header-row">
          <button
            className="brand-button"
            onClick={() => navigateTo("Visão Geral")}
            aria-label="Voltar à Visão Geral"
          >
            <Brand />
          </button>
          <button
            type="button"
            className="sidebar-close-mobile-btn"
            onClick={() => setCollapsed(false)}
            aria-label="Fechar menu lateral"
            title="Fechar menu"
          >
            ✕
          </button>
        </div>
        <div id="vf-sidebar-municipality-host" className="vf-sidebar-municipality-host" />
        <div className="menu-label">NAVEGAÇÃO</div>
        <nav>
          {visibleMenu.map((item) => (
            <React.Fragment key={item.label}>
              <button
                className={view === item.label ? "active" : ""}
                onClick={() => {
                  navigateTo(item.label);
                  apiFetch("/api/audit", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      action: "Navegação",
                      detail: item.label,
                    }),
                  }).catch(() => undefined);
                }}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-name">{item.label}</span>
                {item.badge && <em>{item.badge}</em>}
              </button>
              {item.label === "WhatsApp" && (
                <>
                  <button
                    type="button"
                    className="whaticket-broadcast-sidebar-btn"
                    onClick={() => {
                      closeMobileSidebar();
                      window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"));
                    }}
                    title="Disparo em Massa Whaticket"
                  >
                    <span className="nav-icon" style={{ color: "#2ddd7f" }}>⚡</span>
                    <span className="nav-name">Disparo em Massa</span>
                    <em style={{ background: "rgba(45, 221, 127, 0.2)", color: "#2ddd7f", border: "1px solid rgba(45, 221, 127, 0.4)" }}>
                      WHATICKET
                    </em>
                  </button>

                  <button
                    type="button"
                    className="tse-info-sidebar-btn"
                    onClick={() => {
                      closeMobileSidebar();
                      window.dispatchEvent(
                        new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                          detail: { district: "Todos os Bairros (Geral - Arapongas)", initialTab: "electoral" },
                        }),
                      );
                    }}
                    title="Painel Eleitoral"
                  >
                    <span className="nav-icon" style={{ color: "#38bdf8" }}>🏛️</span>
                    <span className="nav-name">Painel Eleitoral</span>
                    <em style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)" }}>
                      TSE
                    </em>
                  </button>
                </>
              )}
            </React.Fragment>
          ))}
          {isAdmin && (
            <button
              className={`${view === "Administração" ? "active " : ""}administration-nav-item`}
              onClick={() => {
                navigateTo("Administração");
                apiFetch("/api/audit", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "Navegação",
                    detail: "Administração",
                  }),
                }).catch(() => undefined);
              }}
              title="Administração"
            >
              <span className="nav-icon">⚙</span>
              <span className="nav-name">Administração</span>
            </button>
          )}
        </nav>
        <div className="sidebar-message">
          <span>🇧🇷</span>
          <div>
            <b>Compromisso com Arapongas</b>
            <small>Estratégia, organização e resultado.</small>
          </div>
        </div>
        <button className="collapse" onClick={() => { closeMapPopup(); setCollapsed(!collapsed); }}>
          {collapsed ? "›" : "‹"}
          <span>Recolher menu</span>
        </button>
      </aside>
      <main>
        <header className="topbar">
          <div className="page-id">
            <button
              type="button"
              className="mobile-menu"
              onClick={() => {
                closeMapPopup();
                setCollapsed(!collapsed);
              }}
              aria-label="Abrir menu de navegação"
              title="Abrir menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4.5" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
                <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
                <rect x="3" y="17" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
              </svg>
            </button>
            <div>
              <small>
                {isAdmin
                  ? "VISÃO ADMINISTRATIVA · AMBIENTES PROTEGIDOS"
                  : "MEU AMBIENTE · DADOS PRIVATIVOS"}
              </small>
              <h1>{view}</h1>
            </div>
          </div>
          <div className="top-actions">
            {isAdmin && (
              <label className="scope-picker">
                <span>Visualizando</span>
                <select
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value);
                  }}
                >
                  <option value="all">Todos os usuários</option>
                  {availableUsers.map((user) => (
                    <option value={user.email} key={user.email}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="notification" aria-label="Notificações">
              ♧<i>3</i>
            </button>
            <button className="profile" onClick={() => setModal("perfil")}>
              <span>{initials(currentUser.name)}</span>
              <div>
                <b>{currentUser.name}</b>
                <small>{roleLabel(currentUser.role)}</small>
              </div>
              <i>⌄</i>
            </button>
          </div>
        </header>
        <section className="workspace">{content}</section>
      </main>
      {modal && (
        <ModalBox
          kind={modal}
          presetDay={presetMeetingDay}
          close={() => {
            setModal(null);
            setPresetMeetingDay("");
          }}
          tell={setNotice}
          meetings={meetings}
          currentUser={currentUser}
          onSave={createRecord}
        />
      )}
      {notice && (
        <div className="toast" onAnimationEnd={() => setNotice("")}>
          <span>✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}

const BrasiliaClockWidget = React.memo(function BrasiliaClockWidget({
  contextName,
  userName,
  onOpenCadastro,
}: {
  contextName: string;
  userName: string;
  onOpenCadastro: () => void;
}) {
  const [brasiliaNow, setBrasiliaNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setBrasiliaNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const brasiliaHour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(brasiliaNow),
  );
  const greeting =
    brasiliaHour < 12
      ? "Bom dia"
      : brasiliaHour < 18
        ? "Boa tarde"
        : "Boa noite";
  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(brasiliaNow);
  const formattedTime = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(brasiliaNow);

  return (
    <div className="welcome-pro">
      <div className="welcome-copy">
        <span>AMBIENTE SELECIONADO · {contextName.toUpperCase()}</span>
        <h2>
          {greeting}, {userName}
        </h2>
        <p>
          Gestão eleitoral protegida. Seus indicadores estão organizados por
          usuário.
        </p>
      </div>
      <div className="welcome-actions">
        <div className="brasilia-clock" aria-label="Data e hora de Brasília">
          <small>{formattedDate}</small>
          <strong>{formattedTime}</strong>
          <em>Horário de Brasília</em>
        </div>
        <button onClick={onOpenCadastro}>+ Novo cadastro</button>
      </div>
    </div>
  );
});

function Overview({
  go,
  open,
  openVoterReport,
  summary,
  meetings,
  contextName,
  userName,
}: {
  go: (v: View) => void;
  open: (m: Modal) => void;
  openVoterReport: () => void;
  summary: OverviewSummary;
  meetings: (Meeting & { id: number; ownerEmail: string })[];
  contextName: string;
  userName: string;
}) {
  const leaders = summary.leaders;
  const voters = summary.voters;
  const districts = summary.districtsReached;
  return (
    <>
      <BrasiliaClockWidget
        contextName={contextName}
        userName={userName}
        onOpenCadastro={() => open("cadastro")}
      />
      <div className="kpis">
        <Kpi
          tone="green"
          icon="♜"
          value={String(leaders)}
          label="Lideranças ativas"
          delta="Cadastrar liderança"
          onClick={() => open("cadastro_lideranca")}
        />
        <Kpi
          tone="blue"
          icon="♙"
          value={String(voters)}
          label="Eleitores cadastrados"
          delta="Ver relatório de eleitores"
          onClick={openVoterReport}
        />
        <Kpi
          tone="gold"
          icon="✢"
          value={String(districts)}
          label="Bairros alcançados"
          delta="Abrir mapa eleitoral"
          onClick={() => go("Mapa Eleitoral")}
        />
        <Kpi
          tone="violet"
          icon="◫"
          value={String(summary.meetings)}
          label="Reuniões agendadas"
          delta="Abrir agenda inteligente"
          onClick={() => go("Agenda Inteligente")}
        />
      </div>
      <div className="dashboard-grid">
        <article className="panel agenda-summary">
          <PanelTitle
            title="Próximos compromissos"
            subtitle="Agenda do ambiente"
            action="Ver agenda"
            onClick={() => go("Agenda Inteligente")}
          />
          {meetings.length ? (
            meetings.slice(0, 3).map((meeting, index) => (
              <div className="event" key={meeting.id}>
                <div className="event-date">
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <small>AGENDA</small>
                </div>
                <div>
                  <span>{meeting.date}</span>
                  <b>{meeting.title}</b>
                  <small>⌖ {meeting.place}</small>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">
              Nenhum compromisso agendado neste ambiente.
            </p>
          )}
        </article>
        <article className="panel activity">
          <PanelTitle
            title="Privacidade ativa"
            subtitle="Separação por identidade"
          />
          <div className="activity-line">
            <span className="dot d0" />
            <div>
              <small>SEGURANÇA</small>
              <b>Dados vinculados ao usuário autenticado</b>
            </div>
            <time>Ativo</time>
          </div>
          <div className="activity-line">
            <span className="dot d1" />
            <div>
              <small>AUDITORIA</small>
              <b>Ações administrativas registradas</b>
            </div>
            <time>Ativo</time>
          </div>
        </article>
      </div>
    </>
  );
}

function Kpi({
  tone,
  icon,
  value,
  label,
  delta,
  onClick,
}: {
  tone: string;
  icon: string;
  value: string;
  label: string;
  delta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="kpi kpi-link"
      onClick={onClick}
      aria-label={`${label}: ${delta}`}
    >
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div>
        <strong>{value}</strong>
        <b>{label}</b>
        <small>↗ {delta}</small>
      </div>
      <span className="kpi-arrow" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
function PanelTitle({
  title,
  subtitle,
  action,
  onClick,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {action && <button onClick={onClick}>{action} →</button>}
    </div>
  );
}

async function ensureLeaflet() {
  let stylesheet = document.querySelector<HTMLLinkElement>(
    'link[data-vf-leaflet]',
  );
  if (!stylesheet) {
    stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    stylesheet.dataset.vfLeaflet = "true";
    document.head.appendChild(stylesheet);
  }

  if (!stylesheet.sheet) {
    await new Promise<void>((resolve, reject) => {
      const loaded = () => resolve();
      const failed = () => reject(new Error("leaflet-css"));
      stylesheet?.addEventListener("load", loaded, { once: true });
      stylesheet?.addEventListener("error", failed, { once: true });
      window.setTimeout(() => {
        if (stylesheet?.sheet) resolve();
      }, 1500);
    });
  }

  if (!(window as any).L) {
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-vf-leaflet]",
    );
    if (!script) {
      script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.dataset.vfLeaflet = "true";
      document.head.appendChild(script);
    }

    if (!(window as any).L) {
      await new Promise<void>((resolve, reject) => {
        if ((window as any).L) {
          resolve();
          return;
        }
        script?.addEventListener("load", () => resolve(), { once: true });
        script?.addEventListener("error", () => reject(new Error("leaflet-js")), {
          once: true,
        });
      });
    }
  }

  const L = (window as any).L;
  if (!L) throw new Error("leaflet-unavailable");
  return L;
}

async function geocodeMeetingAddress(address: string) {
  const query = /brasil/i.test(address) ? address : `${address}, Brasil`;
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
    { headers: { "accept-language": "pt-BR" } },
  );
  if (!response.ok) throw new Error("geocoding");
  const result = await response.json();
  if (!result[0]) return null;
  return {
    latitude: Number(result[0].lat),
    longitude: Number(result[0].lon),
    locationLabel: String(result[0].display_name || address),
  };
}

function MeetingLocationMap({
  latitude,
  longitude,
  label,
  onChange,
}: {
  latitude: number;
  longitude: number;
  label: string;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    async function start() {
      const L = await ensureLeaflet();
      if (cancelled || !element.current) return;
      map.current = L.map(element.current).setView([latitude, longitude], 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map.current);
      marker.current = L.marker([latitude, longitude], { draggable: true })
        .addTo(map.current)
        .bindPopup(label)
        .openPopup();
      marker.current.on("dragend", () => {
        const point = marker.current.getLatLng();
        onChange(point.lat, point.lng);
      });
      setTimeout(() => map.current?.invalidateSize(), 80);
    }
    start().catch(() => undefined);
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !marker.current) return;
    marker.current.setLatLng([latitude, longitude]).bindPopup(label);
    map.current.setView([latitude, longitude], 17);
  }, [latitude, longitude, label]);
  return (
    <div className="meeting-location">
      <div ref={element} className="meeting-location-map" />
      <p>
        <b>⌖ Local identificado</b>
        <span>{label}</span>
        <small>Arraste o pino para corrigir a posição, se necessário.</small>
      </p>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CityMap({ contacts = [] }: { contacts?: Contact[] }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const contactLayer = useRef<any>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    "Mapa real de Arapongas",
  );
  const districts = new Set(
    contacts.map((contact) => contact.district).filter(Boolean),
  ).size;

  useEffect(() => {
    let cancelled = false;
    async function startMap() {
      const L = await ensureLeaflet();
      if (cancelled || !mapElement.current || mapInstance.current) return;
      const map = L.map(mapElement.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 11,
        closePopupOnClick: true,
      }).setView([-23.4153, -51.4256], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapInstance.current = map;
      (window as any).__vfBaseElectoralMap = map;
      window.dispatchEvent(
        new CustomEvent("voto-forte:base-electoral-map-ready", { detail: { map } }),
      );
      const closePopup = () => map.closePopup();
      window.addEventListener("voto-forte:close-map-popup", closePopup);
      map.on("movestart zoomstart", closePopup);
      map._vfClosePopup = closePopup;
      contactLayer.current = L.layerGroup().addTo(map);
      contacts
        .filter(
          (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
        )
        .forEach((contact) => {
          const marker = L.marker(
            [Number(contact.latitude), Number(contact.longitude)],
            {
              icon: L.divIcon({
                className: "contact-pin",
                html: `<span>${initials(contact.name)}</span>`,
                iconSize: [38, 48],
                iconAnchor: [19, 46],
                popupAnchor: [0, -44],
              }),
            },
          );
          marker.bindPopup(
            `<strong>${contact.name}</strong><small>${contact.kind} · ${contact.district}</small><p>${contact.street || ""}, ${contact.number || ""}</p>`,
            { autoClose: true, closeOnClick: true, closeButton: true },
          );
          marker.addTo(contactLayer.current);
        });
      setTimeout(() => map.invalidateSize(), 100);

    }
    startMap().catch(() =>
      setLocationMessage("Não foi possível carregar o mapa agora"),
    );
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        if (mapInstance.current._vfClosePopup)
          window.removeEventListener("voto-forte:close-map-popup", mapInstance.current._vfClosePopup);
        if ((window as any).__vfBaseElectoralMap === mapInstance.current)
          delete (window as any).__vfBaseElectoralMap;
        mapInstance.current.remove();
        mapInstance.current = null;
        contactLayer.current = null;
      }
    };
  }, [contacts]);

  useEffect(() => {
    const L = (window as any).L,
      layer = contactLayer.current;
    if (!L || !layer) return;
    layer.clearLayers();
    contacts
      .filter(
        (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
      )
      .forEach((contact) => {
        const marker = L.marker(
          [Number(contact.latitude), Number(contact.longitude)],
          {
            icon: L.divIcon({
              className: "contact-pin",
              html: `<span>${initials(contact.name)}</span>`,
              iconSize: [38, 48],
              iconAnchor: [19, 46],
              popupAnchor: [0, -44],
            }),
          },
        );
        marker.bindPopup(
          `<strong>${contact.name}</strong><small>${contact.kind} · ${contact.district}</small><p>${contact.street || ""}, ${contact.number || ""}</p>`,
          { autoClose: true, closeOnClick: true, closeButton: true },
        );
        marker.addTo(layer);
      });
  }, [contacts]);

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationMessage("Geolocalização indisponível neste aparelho");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        mapInstance.current?.setView(
          [result.coords.latitude, result.coords.longitude],
          17,
        );
        setLocationMessage("Sua localização no mapa");
        setLocating(false);
      },
      () => {
        setLocationMessage(
          "Permita o acesso à localização para exibir sua posição",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  function returnToArapongas() {
    mapInstance.current?.setView([-23.4153, -51.4256], 13);
    setLocationMessage("Mapa real de Arapongas");
  }
  function fitPins() {
    const valid = contacts.filter(
      (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude),
    );
    if (!valid.length) {
      returnToArapongas();
      return;
    }
    const L = (window as any).L;
    mapInstance.current?.fitBounds(
      L.latLngBounds(
        valid.map((c) => [Number(c.latitude), Number(c.longitude)]),
      ),
      { padding: [55, 55], maxZoom: 17 },
    );
    setLocationMessage(`${valid.length} alfinete(s) centralizado(s)`);
  }
  return (
    <div className="city-map real-city-map">
      <div
        ref={mapElement}
        className="leaflet-map"
        aria-label="Mapa real de Arapongas com bairros e pessoas cadastradas"
      />
      <div className="real-map-toolbar">
        <div>
          <strong>{locationMessage}</strong>
          <small>
            {districts} bairros com presença · limites em laranja ·{" "}
            {contacts.filter((c) => c.latitude).length} alfinetes
          </small>
        </div>
        <button type="button" onClick={fitPins}>
          ⌖ Centralizar alfinetes
        </button>
        <button type="button" onClick={locateUser} disabled={locating}>
          {locating ? "Localizando…" : "Minha localização"}
        </button>
        <button type="button" className="map-home" onClick={returnToArapongas}>
          Arapongas
        </button>
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function PageHead({
  eyebrow,
  title,
  text,
  action,
  onClick,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {action && <button onClick={onClick}>{action}</button>}
    </div>
  );
}
function csvCell(value: string) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}
function downloadFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function parseCsv(text: string): Contact[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) return [];
  const sep =
    (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length
      ? ";"
      : ",";
  const split = (line: string) => {
    const out: string[] = [];
    let cell = "",
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === sep && !quoted) {
        out.push(cell.trim());
        cell = "";
      } else cell += c;
    }
    out.push(cell.trim());
    return out;
  };
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const head = split(lines[0]).map(norm);
  const val = (r: string[], n: string[]) => {
    const i = head.findIndex((h) => n.includes(h));
    return i < 0 ? "" : (r[i] || "").trim();
  };
  return lines
    .slice(1)
    .map(split)
    .map(
      (r) =>
        ({
          name: val(r, ["nome", "name"]),
          phone: val(r, ["telefone", "celular", "whatsapp", "phone"]),
          district: val(r, ["bairro", "district"]),
          leader: val(r, ["lideranca", "lider", "leader"]),
          kind:
            norm(val(r, ["perfil", "tipo", "kind"])) === "lideranca"
              ? "Liderança"
              : "Eleitor",
          cep: val(r, ["cep"]),
          street: val(r, ["rua", "logradouro", "endereco", "street"]),
          number: val(r, ["numero", "number"]),
        }) as Contact,
    )
    .filter((c) => c.name && c.phone);
}
function parseVcf(text: string): Contact[] {
  return text
    .split(/END:VCARD/i)
    .map((card) => {
      const field = (key: string) =>
        card
          .match(new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:(.*)`, `im`))?.[1]
          ?.trim() || "";
      return {
        name: field("FN"),
        phone: field("TEL"),
        district: "",
        street: "",
        number: "",
        leader: "",
        kind: "Eleitor",
      } as Contact;
    })
    .filter((c) => c.name && c.phone);
}
function ContactManager({
  contacts,
  open,
  filter,
  setFilter,
  districtFilter,
  setDistrictFilter,
  scope,
  tell,
  importContact,
  updateContact,
  deleteContact,
  isAdmin,
}: {
  contacts: (Contact & { id: number; ownerEmail: string })[];
  open: (m: Modal) => void;
  filter: Contact["kind"] | "Todos";
  setFilter: (filter: Contact["kind"] | "Todos") => void;
  districtFilter: string;
  setDistrictFilter: (district: string) => void;
  scope: string;
  tell: (s: string) => void;
  importContact: (c: Contact) => Promise<boolean>;
  updateContact: (id: number, c: Contact) => Promise<boolean>;
  deleteContact: (id: number) => Promise<boolean>;
  isAdmin: boolean;
}) {
  const [preview, setPreview] = useState<Contact[]>([]),
    [saving, setSaving] = useState(false),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<
      (Contact & { id: number; ownerEmail: string }) | null
    >(null);
  const [districtContacts, setDistrictContacts] = useState<
    (Contact & { id: number; ownerEmail: string })[]
  >([]);
  const [districtTotal, setDistrictTotal] = useState(0);
  const [districtPage, setDistrictPage] = useState(1);
  const [districtTotalPages, setDistrictTotalPages] = useState(1);
  const [districtLoading, setDistrictLoading] = useState(false);

  useEffect(() => {
    setDistrictPage(1);
  }, [districtFilter, filter, scope]);

  useEffect(() => {
    if (!districtFilter) {
      setDistrictContacts([]);
      setDistrictTotal(0);
      setDistrictTotalPages(1);
      setDistrictLoading(false);
      return;
    }
    let cancelled = false;
    setDistrictLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        owner: scope,
        district: districtFilter,
        page: String(districtPage),
        pageSize: "100",
      });
      if (filter === "Eleitor" || filter === "Liderança")
        params.set("profile", filter);
      if (query.trim()) params.set("q", query.trim());
      apiFetch(`/api/contacts?${params.toString()}`, { cache: "no-store" })
        .then(async (response) => ({ response, data: await response.json() }))
        .then(({ response, data }) => {
          if (cancelled) return;
          if (!response.ok) throw new Error(data.error || "Não foi possível carregar os contatos do bairro.");
          setDistrictContacts(Array.isArray(data.contacts) ? data.contacts : []);
          setDistrictTotal(Number(data.total || 0));
          setDistrictTotalPages(Math.max(1, Number(data.totalPages || 1)));
        })
        .catch((error) => {
          if (!cancelled) {
            setDistrictContacts([]);
            setDistrictTotal(0);
            setDistrictTotalPages(1);
            tell(error instanceof Error ? error.message : "Não foi possível carregar os contatos do bairro.");
          }
        })
        .finally(() => {
          if (!cancelled) setDistrictLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [districtFilter, filter, scope, query, districtPage, tell]);

  const profileContacts = useMemo(
    () => (filter === "Todos" ? contacts : contacts.filter((c) => c.kind === filter)),
    [contacts, filter],
  );
  const filteredContacts = districtFilter ? districtContacts : profileContacts;
  const list = useMemo(() => {
    if (districtFilter) return filteredContacts;
    const q = query.trim().toLowerCase();
    if (!q) return filteredContacts;
    return filteredContacts.filter((c) =>
      `${c.name} ${c.phone} ${c.district} ${c.ownerEmail}`
        .toLowerCase()
        .includes(q),
    );
  }, [districtFilter, filteredContacts, query]);

  const { voters, leaders, districts } = useMemo(() => {
    let vCount = 0;
    let lCount = 0;
    const districtSet = new Set<string>();
    for (const c of contacts) {
      if (c.kind === "Eleitor") vCount++;
      else if (c.kind === "Liderança") lCount++;
      if (c.district) districtSet.add(c.district);
    }
    return { voters: vCount, leaders: lCount, districts: districtSet.size };
  }, [contacts]);
  async function pick(file?: File) {
    if (!file) return;
    const parsed = file.name.toLowerCase().endsWith(".vcf")
      ? parseVcf(await file.text())
      : parseCsv(await file.text());
    setPreview(parsed);
    tell(
      parsed.length
        ? `${parsed.length} contato(s) encontrados.`
        : "Nenhum contato válido encontrado.",
    );
  }
  async function saveAll() {
    setSaving(true);
    let saved = 0;
    const phones = new Set(contacts.map((c) => c.phone.replace(/\D/g, "")));
    for (const c of preview) {
      const p = c.phone.replace(/\D/g, "");
      if (p && !phones.has(p) && (await importContact(c))) {
        saved++;
        phones.add(p);
      }
    }
    setSaving(false);
    setPreview([]);
    tell(`${saved} contato(s) importado(s); duplicados ignorados.`);
  }
  const rows = () =>
    contacts.map((c) => [
      c.name,
      c.phone,
      c.kind,
      c.district,
      c.cep || "",
      c.street || "",
      c.number || "",
      c.leader || "",
      c.ownerEmail,
    ]);
  function csv() {
    downloadFile(
      "contatos-voto-forte.csv",
      "\ufeff" +
        [
          [
            "Nome",
            "WhatsApp",
            "Perfil",
            "Bairro",
            "CEP",
            "Rua",
            "Número",
            "Liderança",
            "Responsável",
          ],
          ...rows(),
        ]
          .map((r) => r.map(csvCell).join(";"))
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  async function excel() {
    const X = await import("xlsx");
    const b = X.utils.book_new();
    X.utils.book_append_sheet(
      b,
      X.utils.aoa_to_sheet([
        [
          "Nome",
          "WhatsApp",
          "Perfil",
          "Bairro",
          "CEP",
          "Rua",
          "Número",
          "Liderança",
          "Responsável",
        ],
        ...rows(),
      ]),
      "Contatos",
    );
    X.writeFile(b, "contatos-voto-forte.xlsx");
  }
  function vcf() {
    downloadFile(
      "contatos-voto-forte.vcf",
      contacts
        .map(
          (c) =>
            `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${c.name}\r\nTEL;TYPE=CELL:${c.phone}\r\nNOTE:${c.kind} - Voto Forte Paraná\r\nEND:VCARD`,
        )
        .join("\r\n"),
      "text/vcard;charset=utf-8",
    );
  }
  async function confirmDelete(contact: Contact & { id: number }) {
    if (window.confirm(`Excluir o contato ${contact.name}?`))
      await deleteContact(contact.id);
  }
  return (
    <>
      <PageHead
        eyebrow={
          isAdmin
            ? "CONTROLE ADMINISTRATIVO DE CONTATOS"
            : "MINHA BASE PRIVATIVA"
        }
        title="Gerenciamento de contatos"
        text={
          isAdmin
            ? "Consulte e gerencie contatos de todos os usuários no ambiente selecionado."
            : "Importe, edite e exporte somente os seus próprios contatos."
        }
        action="+ Novo cadastro"
        onClick={() => open("cadastro")}
      />
      <div
        className="management-filter"
        role="group"
        aria-label="Filtrar contatos"
      >
        <button
          className={filter === "Todos" ? "active" : ""}
          onClick={() => setFilter("Todos")}
        >
          Todos
        </button>
        <button
          className={filter === "Eleitor" ? "active" : ""}
          onClick={() => setFilter("Eleitor")}
        >
          Eleitores
        </button>
        <button
          className={filter === "Liderança" ? "active" : ""}
          onClick={() => setFilter("Liderança")}
        >
          Lideranças
        </button>
      </div>
      {districtFilter && (
        <div className="district-contact-filter" role="status">
          <span>
            Bairro selecionado: <b>{districtFilter}</b> · {districtLoading ? "carregando…" : `${districtTotal} contato(s)`}
          </span>
          <button type="button" onClick={() => setDistrictFilter("")}>
            Limpar bairro
          </button>
        </div>
      )}
      <div className="summary-strip">
        <span>
          <b>{contacts.length}</b>Total de contatos
        </span>
        <span>
          <b>{voters}</b>Eleitores
        </span>
        <span>
          <b>{leaders}</b>Lideranças
        </span>
        <span>
          <b>{districts}</b>Bairros
        </span>
      </div>
      <div className="contact-module-grid">
        <article className="panel import-contacts">
          <span className="feature-icon">⇧</span>
          <h3>Importar contatos</h3>
          <p>Selecione CSV ou VCF e confira antes de salvar.</p>
          <label className="file-picker">
            Selecionar arquivo
            <input
              type="file"
              accept=".csv,.vcf"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </label>
          <footer>Duplicados são ignorados.</footer>
        </article>
        <article className="panel export-contacts">
          <span className="feature-icon">⇩</span>
          <h3>
            {isAdmin ? "Exportar contatos exibidos" : "Exportar meus contatos"}
          </h3>
          <p>{contacts.length} contato(s) neste ambiente.</p>
          <div className="export-buttons">
            <button onClick={csv}>CSV</button>
            <button onClick={() => void excel()}>Excel</button>
            <button onClick={vcf}>VCF</button>
          </div>
        </article>
      </div>
      {preview.length > 0 && (
        <article className="panel import-preview">
          <PanelTitle
            title="Conferir antes de importar"
            subtitle={`${preview.length} contato(s) encontrados`}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>WhatsApp</th>
                  <th>Perfil</th>
                  <th>Bairro</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((c, i) => (
                  <tr key={i}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{c.kind}</td>
                    <td>{c.district || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="import-actions">
            <button onClick={() => setPreview([])}>Cancelar</button>
            <button
              className="primary"
              disabled={saving}
              onClick={() => void saveAll()}
            >
              {saving ? "Importando…" : `Importar ${preview.length}`}
            </button>
          </div>
        </article>
      )}
      <article className="panel contact-directory">
        <div className="table-tools">
          <div>
            <h3>Contatos cadastrados</h3>
            <p>
              {isAdmin
                ? "Pesquisa por nome, telefone, bairro ou usuário responsável."
                : "Pesquisa dentro da sua base particular."}
            </p>
          </div>
          <div className="search">
            <span>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contato"
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contato</th>
                <th>WhatsApp</th>
                <th>Bairro</th>
                {isAdmin && <th>Responsável</th>}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person">
                      <span>{initials(c.name)}</span>
                      <b>{c.name}</b>
                    </div>
                  </td>
                  <td>{c.phone}</td>
                  <td>{c.district || "—"}</td>
                  {isAdmin && <td>{c.ownerEmail}</td>}
                  <td>
                    <div className="contact-actions">
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                      >
                        WhatsApp
                      </a>
                      <button onClick={() => setEditing(c)}>Editar</button>
                      <button
                        className="danger"
                        onClick={() => void confirmDelete(c)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!districtLoading && !list.length && (
            <p className="empty-state">Nenhum contato encontrado.</p>
          )}
          {districtLoading && (
            <p className="empty-state">Carregando contatos deste bairro…</p>
          )}
        </div>
        {districtFilter && districtTotalPages > 1 && (
          <div className="import-actions">
            <button
              type="button"
              disabled={districtPage <= 1 || districtLoading}
              onClick={() => setDistrictPage((page) => Math.max(1, page - 1))}
            >
              Página anterior
            </button>
            <span>
              Página {districtPage} de {districtTotalPages} · {districtTotal} contato(s)
            </span>
            <button
              type="button"
              disabled={districtPage >= districtTotalPages || districtLoading}
              onClick={() => setDistrictPage((page) => Math.min(districtTotalPages, page + 1))}
            >
              Próxima página
            </button>
          </div>
        )}
      </article>
      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <header>
              <div>
                <small>CONTATO · {editing.ownerEmail}</small>
                <h3>Editar contato</h3>
              </div>
              <button onClick={() => setEditing(null)}>×</button>
            </header>
            <form
              className="modal-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await updateContact(editing.id, editing)) setEditing(null);
              }}
            >
              <label>
                Nome completo
                <input
                  required
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <div>
                <label>
                  WhatsApp
                  <input
                    required
                    value={editing.phone}
                    onChange={(e) =>
                      setEditing({ ...editing, phone: e.target.value })
                    }
                  />
                </label>
                <label>
                  Perfil
                  <select
                    value={editing.kind}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        kind: e.target.value as Contact["kind"],
                      })
                    }
                  >
                    <option>Eleitor</option>
                    <option>Liderança</option>
                  </select>
                </label>
              </div>
              <label>
                Bairro
                <input
                  value={editing.district}
                  onChange={(e) =>
                    setEditing({ ...editing, district: e.target.value })
                  }
                />
              </label>
              <label>
                Liderança responsável
                <input
                  value={editing.leader}
                  onChange={(e) =>
                    setEditing({ ...editing, leader: e.target.value })
                  }
                />
              </label>
              <footer>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
                <button className="primary" type="submit">
                  Salvar alterações
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
function Agenda({
  meetings,
  tell,
  open,
  updateMeeting,
  deleteMeeting,
  isAdmin,
  users,
}: {
  meetings: (Meeting & { id: number; ownerEmail: string })[];
  tell: (s: string) => void;
  open: (m: Modal, dayPreset?: string) => void;
  updateMeeting: (id: number, m: Meeting) => Promise<boolean>;
  deleteMeeting: (id: number) => Promise<boolean>;
  isAdmin: boolean;
  users: ManagedUser[];
}) {
  const [editing, setEditing] = useState<
    (Meeting & { id: number; ownerEmail: string }) | null
  >(null);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");
  const normalizedSearch = meetingSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredMeetings = meetings.filter((meeting) => {
    const owner = users.find((user) => user.email === meeting.ownerEmail);
    const searchable = `${meeting.title} ${meeting.ownerEmail} ${owner?.name || ""}`.toLocaleLowerCase("pt-BR");
    const meetingDay = meeting.day || meeting.date.split(" · ")[0] || "";
    return (
      (!isAdmin || ownerFilter === "all" || meeting.ownerEmail === ownerFilter) &&
      (!normalizedSearch || searchable.includes(normalizedSearch)) &&
      (!dateFrom || meetingDay >= dateFrom) &&
      (!dateTo || meetingDay <= dateTo)
    );
  });
  const ordered = [...filteredMeetings].sort((a, b) =>
    String(a.day || a.date).localeCompare(String(b.day || b.date)),
  );
  async function remove(meeting: Meeting & { id: number }) {
    if (window.confirm(`Excluir a reunião “${meeting.title}”?`))
      await deleteMeeting(meeting.id);
  }
  return (
    <>
      <PageHead
        eyebrow="ORGANIZAÇÃO E MOBILIZAÇÃO"
        title="Agenda de Reuniões"
        text={
          isAdmin
            ? "Visualize os compromissos do ambiente selecionado ou a agenda consolidada."
            : "Cadastre e gerencie somente as suas próprias reuniões."
        }
        action="+ Nova reunião"
        onClick={() => open("reuniao")}
      />
      <div className="agenda-cards">
        <article className="panel agenda-overview">
          <span className="feature-icon">◫</span>
          <small>MINHA ORGANIZAÇÃO</small>
          <h3>{meetings.length} reunião(ões) cadastrada(s)</h3>
          <p>
            Nome, data, hora, endereço, local e observações ficam reunidos em um
            só lugar.
          </p>
        </article>
        <article className="panel agenda-map" style={{ padding: "16px 18px", overflow: "visible" }}>
          <MeetingInteractiveCalendar
            meetings={meetings}
            onSelectDate={(dayString) => open("reuniao", dayString)}
          />
        </article>
      </div>
      <article className="panel meeting-list">
        <PanelTitle
          title="Reuniões cadastradas"
          subtitle={`${ordered.length} de ${meetings.length} compromisso(s) exibido(s)`}
        />
        {isAdmin && (
          <div className="meeting-admin-filters" aria-label="Filtros administrativos de reuniões">
            <label>
              <span>Pesquisar reunião ou usuário</span>
              <input
                type="search"
                value={meetingSearch}
                onChange={(event) => setMeetingSearch(event.target.value)}
                placeholder="Nome da reunião, usuário ou e-mail"
              />
            </label>
            <label>
              <span>Usuário responsável</span>
              <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                <option value="all">Todos os usuários</option>
                {users.map((user) => (
                  <option value={user.email} key={user.email}>{user.name} — {user.email}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Data inicial</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              <span>Data final</span>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => { setMeetingSearch(""); setOwnerFilter("all"); setDateFrom(""); setDateTo(""); }}
            >
              Limpar filtros
            </button>
          </div>
        )}
        {ordered.length ? (
          ordered.map((m, i) => (
            <div className="meeting-row meeting-detailed" key={m.id}>
              <div className="meeting-number">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="meeting-main">
                <b>{m.title}</b>
                <small>
                  <strong>Data e hora:</strong>{" "}
                  {m.day && m.time
                    ? `${m.day.split("-").reverse().join("/")} às ${m.time}`
                    : m.date}
                </small>
                <small>
                  <strong>Local:</strong> {m.place}
                </small>
                <small>
                  <strong>Endereço:</strong> {m.address || m.place}
                </small>
                {m.notes && <p>{m.notes}</p>}
                {isAdmin && <em>Responsável: {m.ownerEmail}</em>}
              </div>
              <div className="meeting-actions">
                <span className="confirmed">✓ Agendada</span>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá! Confirmamos sua participação em: ${m.title}, ${m.day && m.time ? `${m.day.split("-").reverse().join("/")} às ${m.time}` : m.date}, no local ${m.place}, endereço ${m.address || m.place}.`)}`}
                >
                  WhatsApp
                </a>
                <button onClick={() => setEditing(m)}>Editar</button>
                <button className="danger" onClick={() => void remove(m)}>
                  Excluir
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-state">
            Nenhuma reunião cadastrada. Clique em “Nova reunião” para começar.
          </p>
        )}
      </article>
      {editing && (
        <MeetingEditor
          meeting={editing}
          close={() => setEditing(null)}
          save={updateMeeting}
        />
      )}
    </>
  );
}

function MeetingEditor({
  meeting,
  close,
  save,
}: {
  meeting: Meeting & { id: number };
  close: () => void;
  save: (id: number, m: Meeting) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    ...meeting,
    day: meeting.day || meeting.date.split(" · ")[0] || "",
    time: meeting.time || meeting.date.split(" · ")[1] || "",
    address: meeting.address || "",
    notes: meeting.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState("");
  async function locate() {
    if (!form.address.trim()) return;
    setLocating(true);
    setMapError("");
    try {
      const point = await geocodeMeetingAddress(form.address);
      if (!point) return setMapError("Endereço não localizado. Confira rua, número, cidade e CEP.");
      setForm((current) => ({ ...current, ...point }));
    } catch { setMapError("Não foi possível localizar o endereço agora."); }
    finally { setLocating(false); }
  }
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="modal meeting-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>AGENDA DE REUNIÕES</small>
            <h3>Editar reunião</h3>
          </div>
          <button onClick={close}>×</button>
        </header>
        <form
          className="modal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) {
              setMapError("Localize o endereço no mapa antes de salvar.");
              return;
            }
            setBusy(true);
            const payload: Meeting = {
              title: form.title.trim(),
              day: form.day,
              time: form.time,
              date: `${form.day} · ${form.time}`,
              address: form.address.trim(),
              place: form.place.trim(),
              notes: form.notes?.trim(),
              latitude: form.latitude,
              longitude: form.longitude,
              locationLabel: form.locationLabel,
            };
            if (await save(form.id, payload)) close();
            setBusy(false);
          }}
        >
          <label>
            Nome da reunião
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <div>
            <label>
              Data
              <input
                required
                type="date"
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value })}
              />
            </label>
            <label>
              Hora
              <input
                required
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>
          <label>
            Endereço completo
            <div className="address-locate-row">
              <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value, latitude: undefined, longitude: undefined })}/>
              <button type="button" onClick={() => void locate()} disabled={locating}>{locating ? "Localizando…" : "Localizar no mapa"}</button>
            </div>
          </label>
          {mapError && <p className="map-error">{mapError}</p>}
          {Number.isFinite(form.latitude) && Number.isFinite(form.longitude) && <MeetingLocationMap latitude={Number(form.latitude)} longitude={Number(form.longitude)} label={form.locationLabel || form.address} onChange={(latitude, longitude) => setForm((current) => ({ ...current, latitude, longitude }))}/>} 
          <label>
            Local
            <input
              required
              value={form.place}
              onChange={(e) => setForm({ ...form, place: e.target.value })}
            />
          </label>
          <label>
            Observações
            <textarea
              required
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <footer>
            <button type="button" onClick={close}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar alterações"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
function MapPage({
  open,
  contacts,
}: {
  open: (m: Modal) => void;
  contacts: (Contact & { id: number; ownerEmail: string })[];
}) {
  const leaders = contacts.filter((p) => p.kind === "Liderança").length;
  const voters = contacts.length - leaders;
  const coverage = new Set(contacts.map((p) => p.district)).size;
  return (
    <>
      <PageHead
        eyebrow="INTELIGÊNCIA TERRITORIAL"
        title="Mapa eleitoral de Arapongas"
        text="Visualize somente a base do ambiente selecionado ou a consolidação administrativa."
        action="Filtros do mapa"
        onClick={() => open("filtros")}
      />
      <article className="panel full-map">
        <CityMap contacts={contacts} />
        <div className="map-legend">
          <h4>CAMADAS DO MAPA</h4>
          <label>
            <input type="checkbox" defaultChecked />
            <i className="legend-dot green-dot" /> Lideranças <b>{leaders}</b>
          </label>
          <label>
            <input type="checkbox" defaultChecked />
            <i className="legend-dot blue-dot" /> Eleitores <b>{voters}</b>
          </label>
          <hr />
          <small>BAIRROS COM PRESENÇA</small>
          <strong>{coverage}</strong>
          <div className="mini-bar">
            <i style={{ width: `${Math.min(100, (coverage / 38) * 100)}%` }} />
          </div>
        </div>
      </article>
    </>
  );
}
function Whatsapp({
  tell,
  drafts,
  save,
}: {
  tell: (s: string) => void;
  drafts: (Draft & { id: number; ownerEmail: string })[];
  save: (draft: Draft) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState(
    "Olá! O VOTO FORTE PARANÁ convida você para nosso próximo encontro em Arapongas. Contamos com sua presença!",
  );
  return (
    <>
      <PageHead
        eyebrow="COMUNICAÇÃO PRIVATIVA"
        title="Central de WhatsApp"
        text="Cada usuário mantém os próprios rascunhos; administradores podem analisar a visão consolidada."
      />
      <div className="wa-layout">
        <div style={{ gridColumn: "1 / -1", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"))}
            style={{
              width: "100%",
              padding: "16px 20px",
              background: "linear-gradient(135deg, #17345c, #0f172a)",
              border: "1px solid #2ddd7f",
              borderRadius: "14px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(45, 221, 127, 0.15)",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <span style={{ fontSize: "26px", color: "#2ddd7f", filter: "drop-shadow(0 0 8px rgba(45, 221, 127, 0.6))" }}>⚡</span>
              <div>
                <strong style={{ fontSize: "15px", display: "block", color: "#2ddd7f" }}>
                  Disparo em Massa Whaticket / ZapAPI
                </strong>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Envie mensagens em lote para eleitores e lideranças com atraso anti-bloqueio
                </span>
              </div>
            </div>
            <span
              style={{
                background: "#2ddd7f",
                color: "#0f172a",
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "13px",
                whiteSpace: "nowrap",
              }}
            >
              Abrir Disparador →
            </span>
          </button>
        </div>
        <article className="panel composer">
          <div className="composer-head">
            <span>◉</span>
            <div>
              <h3>Nova mensagem</h3>
              <p>Prepare o conteúdo antes de escolher o destinatário.</p>
            </div>
          </div>
          <label>
            Nome do rascunho
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Convite — reunião do Centro"
            />
          </label>
          <label>
            Mensagem
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} />
            <small>{msg.length}/1.000 caracteres</small>
          </label>
          <div className="composer-actions">
            <button
              onClick={async () => {
                if (!title.trim()) {
                  tell("Informe um nome para o rascunho.");
                  return;
                }
                if (await save({ title: title.trim(), message: msg })) {
                  setTitle("");
                }
              }}
            >
              Salvar rascunho
            </button>
            <a
              target="_blank"
              href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
            >
              Continuar no WhatsApp →
            </a>
          </div>
        </article>
        <article className="panel drafts">
          <PanelTitle
            title="Rascunhos recentes"
            subtitle="Mensagens do ambiente selecionado"
          />
          {drafts.length ? (
            drafts.map((x) => (
              <div className="draft" key={x.id}>
                <span>◉</span>
                <div>
                  <b>{x.title}</b>
                  <small>{x.ownerEmail}</small>
                </div>
                <button
                  onClick={() => {
                    setTitle(x.title);
                    setMsg(x.message);
                    tell(`Rascunho “${x.title}” selecionado.`);
                  }}
                >
                  Usar
                </button>
              </div>
            ))
          ) : (
            <p className="empty-state">Nenhum rascunho salvo neste ambiente.</p>
          )}
        </article>
      </div>
    </>
  );
}


function Administration({
  currentUser,
  tell,
  onUsersChange,
}: {
  currentUser: CurrentUser;
  tell: (message: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
}) {
  type AdminSection = "users" | "audit" | "backup";
  const [section, setSection] = useState<AdminSection>("users");
  const isMaster = currentUser.role === "master";
  return (
    <>
      <PageHead
        eyebrow="ADMINISTRAÇÃO E SEGURANÇA"
        title="Administração"
        text="Gerencie acessos, acompanhe atividades e proteja a base do VOTO FORTE em um único lugar."
      />
      <div className="management-filter" role="tablist" aria-label="Seções administrativas">
        <button
          role="tab"
          aria-selected={section === "users"}
          className={section === "users" ? "active" : ""}
          onClick={() => setSection("users")}
        >
          Usuários e acessos
        </button>
        <button
          role="tab"
          aria-selected={section === "audit"}
          className={section === "audit" ? "active" : ""}
          onClick={() => setSection("audit")}
        >
          Atividades / Auditoria
        </button>
        {isMaster && (
          <button
            role="tab"
            aria-selected={section === "backup"}
            className={section === "backup" ? "active" : ""}
            onClick={() => setSection("backup")}
          >
            Banco de Dados e Backup
          </button>
        )}
      </div>
      {section === "backup" && isMaster ? (
        <BackupCenter tell={tell} embedded />
      ) : (
        <Users
          currentUser={currentUser}
          tell={tell}
          onUsersChange={onUsersChange}
          section={section === "audit" ? "audit" : "users"}
          embedded
        />
      )}
    </>
  );
}

type BackupItem = {
  id: number;
  created_at: string;
  created_by: string;
  backup_version: number;
  checksum: string;
  item_count: number;
};
function BackupCenter({ tell, embedded = false }: { tell: (message: string) => void; embedded?: boolean }) {
  const [backups, setBackups] = useState<BackupItem[]>([]),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<File | null>(null),
    [confirmation, setConfirmation] = useState("");
  const [schedule, setSchedule] = useState(
    "Diariamente às 03:00 (horário de Brasília)",
  );
  const load = useCallback(async () => {
    const response = await apiFetch("/api/backups");
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Não foi possível carregar os backups.");
    setBackups(data.backups || []);
    if (data.schedule) setSchedule(data.schedule);
  }, []);
  useEffect(() => {
    load().catch((error) =>
      tell(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os backups.",
      ),
    );
  }, [load, tell]);
  async function createBackup() {
    setBusy(true);
    try {
      const response = await apiFetch("/api/backups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      tell("Backup completo criado. Agora você pode baixá-lo.");
    } catch (error) {
      tell(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o backup.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function downloadBackup(id: number, createdAt: string) {
    setBusy(true);
    try {
      const response = await apiFetch(`/api/backups?download=${id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `VotoForte-Backup-${new Date(createdAt).toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      tell("Arquivo de backup baixado com sucesso.");
    } catch (error) {
      tell(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar o backup.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function restoreBackup() {
    if (!selected || confirmation !== "RESTAURAR") return;
    setBusy(true);
    try {
      const backup = JSON.parse(await selected.text());
      const response = await apiFetch("/api/backups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore", backup }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelected(null);
      setConfirmation("");
      await load();
      tell(
        `Backup restaurado: ${data.restored?.records || 0} registros recuperados.`,
      );
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      tell(
        error instanceof Error
          ? error.message
          : "O arquivo não pôde ser restaurado.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!embedded && (
        <PageHead
          eyebrow="PROTEÇÃO E RECUPERAÇÃO"
          title="Banco de Dados e Backup"
          text="Cópias completas, verificadas e acessíveis somente pelo Administrador Master."
        />
      )}
      <div className="backup-status-grid">
        <article>
          <span>✓</span>
          <div>
            <small>BACKUP AUTOMÁTICO</small>
            <b>Ativo</b>
            <p>{schedule}</p>
          </div>
        </article>
        <article>
          <span>↻</span>
          <div>
            <small>RETENÇÃO</small>
            <b>30 dias</b>
            <p>Cópias antigas são removidas automaticamente</p>
          </div>
        </article>
        <article>
          <span>⌁</span>
          <div>
            <small>CONTEÚDO</small>
            <b>Base completa</b>
            <p>Usuários, contatos, reuniões, configurações e auditoria</p>
          </div>
        </article>
      </div>
      <article className="security-banner">
        <span>◆</span>
        <div>
          <b>Proteção em duas camadas</b>
          <p>
            O sistema mantém cópias automáticas diárias. Baixe periodicamente um
            arquivo para guardar também fora da plataforma.
          </p>
        </div>
        <i>PROTEGIDO</i>
      </article>
      <div className="backup-grid">
        <article className="panel backup-create">
          <div className="feature-icon">⇩</div>
          <small>CÓPIA SOB DEMANDA</small>
          <h3>Exportar backup completo</h3>
          <p>
            Cria uma fotografia atual de todas as informações do VOTO FORTE e
            libera o arquivo para download.
          </p>
          <button disabled={busy} onClick={() => void createBackup()}>
            {busy ? "Processando…" : "Criar novo backup"}
          </button>
        </article>
        <article className="panel backup-restore">
          <div className="feature-icon danger-icon">↺</div>
          <small>RECUPERAÇÃO CONTROLADA</small>
          <h3>Restaurar um backup</h3>
          <p>
            Selecione um arquivo JSON gerado pelo sistema. Uma cópia de
            segurança será criada automaticamente antes da restauração.
          </p>
          <label className="backup-file">
            {selected ? selected.name : "Selecionar arquivo de backup"}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                setSelected(event.target.files?.[0] || null);
                setConfirmation("");
              }}
            />
          </label>
          {selected && (
            <>
              <label className="restore-confirm">
                Para confirmar, digite <b>RESTAURAR</b>
                <input
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(event.target.value.toUpperCase())
                  }
                />
              </label>
              <button
                className="danger-button"
                disabled={busy || confirmation !== "RESTAURAR"}
                onClick={() => void restoreBackup()}
              >
                {busy ? "Restaurando…" : "Restaurar dados"}
              </button>
            </>
          )}
        </article>
      </div>
      <article className="panel backup-history">
        <PanelTitle
          title="Histórico de backups"
          subtitle="Cópias automáticas e manuais disponíveis para download"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data e hora</th>
                <th>Origem</th>
                <th>Itens</th>
                <th>Verificação</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td>
                    <i
                      className={
                        item.created_by === "automatic"
                          ? "automatic-tag"
                          : "manual-tag"
                      }
                    >
                      {item.created_by === "automatic"
                        ? "Automático"
                        : "Manual"}
                    </i>
                  </td>
                  <td>{item.item_count}</td>
                  <td>
                    <code>{item.checksum.slice(0, 12)}…</code>
                  </td>
                  <td>
                    <button
                      className="download-backup"
                      disabled={busy}
                      onClick={() =>
                        void downloadBackup(item.id, item.created_at)
                      }
                    >
                      Baixar arquivo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!backups.length && (
            <p className="empty-state">Nenhum backup disponível.</p>
          )}
        </div>
      </article>
    </>
  );
}

function Users({
  currentUser,
  tell,
  onUsersChange,
  section = "users",
  embedded = false,
}: {
  currentUser: CurrentUser;
  tell: (message: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
  section?: "users" | "audit";
  embedded?: boolean;
}) {
  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [adminCount, setAdminCount] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "user" as CurrentUser["role"],
  });
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    () =>
      apiFetch("/api/users")
        .then((r) => r.json())
        .then((data) => {
          if (data.users) {
            setUsersList(data.users);
            onUsersChange(
              data.users.filter(
                (user: ManagedUser) => user.status === "active",
              ),
            );
          }
          if (data.logs) setLogs(data.logs);
          if (typeof data.adminCount === "number")
            setAdminCount(data.adminCount);
        })
        .catch(() => tell("Não foi possível atualizar os usuários agora.")),
    [onUsersChange, tell],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function addUser(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await apiFetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      tell(data.error || "Não foi possível cadastrar o usuário.");
      return;
    }
    setForm({ name: "", email: "", role: "user" });
    tell("Usuário cadastrado com acesso individual protegido.");
    void load();
  }
  async function updateUser(
    email: string,
    changes: { role?: CurrentUser["role"]; status?: ManagedUser["status"] },
  ) {
    const response = await apiFetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, ...changes }),
    });
    const data = await response.json();
    if (!response.ok) {
      tell(data.error || "Não foi possível alterar a permissão.");
      return;
    }
    tell("Permissão atualizada com segurança.");
    void load();
  }
  return (
    <>
      {!embedded && (
        <PageHead
          eyebrow="SEGURANÇA, PRIVACIDADE E AUDITORIA"
          title="Central de usuários"
          text="Administradores acompanham toda a operação; cada usuário acessa somente o próprio ambiente."
        />
      )}
      {section === "users" ? (
        <>
      <div className="admin-kpis">
        <article>
          <small>ADMINISTRADORES</small>
          <b>{adminCount}/3</b>
          <span>{3 - adminCount} vaga(s) protegida(s)</span>
        </article>
        <article>
          <small>USUÁRIOS CADASTRADOS</small>
          <b>{usersList.length}</b>
          <span>Ambientes individuais</span>
        </article>
        <article>
          <small>ATIVIDADES REGISTRADAS</small>
          <b>{logs.length}</b>
          <span>Rastreabilidade ativa</span>
        </article>
      </div>
      <article className="security-banner">
        <span>◆</span>
        <div>
          <b>Separação real de dados por usuário</b>
          <p>
            As consultas e gravações usam o e-mail autenticado como
            proprietário. Administradores podem analisar todos os ambientes.
          </p>
        </div>
        <i>PROTEGIDO</i>
      </article>
      <div className="users-admin-grid">
        <article className="panel user-create">
          <PanelTitle
            title="Cadastrar acesso"
            subtitle="Preencha uma das vagas ou crie um usuário comum"
          />
          <form onSubmit={addUser}>
            <label>
              Nome completo
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              E-mail de acesso
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label>
              Nível
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as CurrentUser["role"],
                  })
                }
              >
                <option value="user">
                  Usuário — vê somente o próprio sistema
                </option>
                {currentUser.role === "master" && (
                  <option value="admin" disabled={adminCount >= 3}>
                    Administrador — vê todos os usuários
                  </option>
                )}
              </select>
            </label>
            <button disabled={saving}>
              {saving ? "Salvando…" : "Cadastrar usuário"}
            </button>
          </form>
        </article>
        <article className="panel data-panel users-table">
          <PanelTitle
            title="Pessoas com acesso"
            subtitle="Papéis, último acesso e bloqueio imediato"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Nível</th>
                  <th>Último acesso</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => (
                  <tr key={user.email}>
                    <td>
                      <div className="person">
                        <span>{initials(user.name)}</span>
                        <b>{user.name}</b>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {currentUser.role === "master" &&
                      user.role !== "master" ? (
                        <select
                          className="role-select"
                          value={user.role}
                          onChange={(event) =>
                            void updateUser(user.email, {
                              role: event.target.value as CurrentUser["role"],
                            })
                          }
                        >
                          <option value="user">Usuário</option>
                          <option
                            value="admin"
                            disabled={adminCount >= 3 && user.role === "user"}
                          >
                            Administrador
                          </option>
                        </select>
                      ) : (
                        <span
                          className={
                            user.role === "master" ? "master-tag" : "role-tag"
                          }
                        >
                          {roleLabel(user.role)}
                        </span>
                      )}
                    </td>
                    <td>
                      {user.lastSeenAt
                        ? new Date(user.lastSeenAt).toLocaleString("pt-BR")
                        : "Ainda não acessou"}
                    </td>
                    <td>
                      <i
                        className={
                          user.status === "active"
                            ? "active-status"
                            : "blocked-status"
                        }
                      >
                        {user.status === "active" ? "Ativo" : "Bloqueado"}
                      </i>
                    </td>
                    <td>
                      {user.role !== "master" && (
                        <button
                          className="user-action"
                          onClick={() =>
                            void updateUser(user.email, {
                              status:
                                user.status === "active" ? "blocked" : "active",
                            })
                          }
                        >
                          {user.status === "active" ? "Bloquear" : "Reativar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
        </>
      ) : (
        <>
      <article className="panel audit-panel">
        <PanelTitle
          title="Atividade de todos os usuários"
          subtitle="Registro de acessos e ações para análise administrativa"
        />
        <div className="audit-list">
          {logs.length ? (
            logs.slice(0, 12).map((log) => (
              <div key={log.id}>
                <span>{initials(log.actorEmail)}</span>
                <p>
                  <b>{log.action}</b>
                  <small>
                    {log.actorEmail} · {log.detail}
                  </small>
                </p>
                <time>{new Date(log.createdAt).toLocaleString("pt-BR")}</time>
              </div>
            ))
          ) : (
            <p className="empty-state">
              As atividades aparecerão aqui conforme os usuários utilizarem o
              sistema.
            </p>
          )}
        </div>
      </article>
        </>
      )}
    </>
  );
}

function ModalBox({
  kind,
  presetDay,
  close,
  tell,
  meetings,
  currentUser,
  onSave,
}: {
  kind: Exclude<Modal, null>;
  presetDay?: string;
  close: () => void;
  tell: (s: string) => void;
  meetings: (Meeting & { id: number; ownerEmail: string })[];
  currentUser: CurrentUser;
  onSave: (
    kind: OwnedRecord["kind"],
    payload: Contact | Meeting | Draft,
  ) => Promise<boolean>;
}) {
  const titles = {
    cadastro: "Novo cadastro",
    cadastro_lideranca: "Cadastrar liderança",
    reuniao: "Agendar reunião",
    filtros: "Filtros do mapa",
    perfil: "Minha conta",
  };
  const [meeting, setMeeting] = useState<Meeting>({
    title: "",
    day: presetDay || (kind === "reuniao" ? new Date().toISOString().split("T")[0] : ""),
    time: "19:00",
    date: "",
    address: "",
    place: "",
    notes: "",
  });
  const [contact, setContact] = useState<Contact>({
    name: "",
    phone: "",
    district: "",
    leader: "",
    kind: kind === "cadastro_lideranca" ? "Liderança" : "Eleitor",
    cep: "",
    street: "",
    number: "",
  });
  const [saving, setSaving] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [meetingLocating, setMeetingLocating] = useState(false);
  const [meetingMapError, setMeetingMapError] = useState("");
  const [contactLocating, setContactLocating] = useState(false);
  async function locateContact() {
    if (!contact.street?.trim() || !contact.number?.trim()) {
      setAddressStatus("Informe a rua e o número antes de localizar.");
      return;
    }
    setContactLocating(true);
    setAddressStatus("Conferindo rua, número, CEP e município…");
    try {
      const query = new URLSearchParams({
        street: contact.street, number: contact.number,
        district: contact.district || "", cep: contact.cep || "",
        city: contact.city || "Arapongas", state: contact.state || "PR",
      });
      const response = await fetch(`/api/address?${query}`);
      const point = await response.json();
      if (!response.ok) throw new Error(point.error || "Endereço não localizado");
      setContact((current) => ({
        ...current, latitude: point.latitude, longitude: point.longitude,
        locationLabel: point.locationLabel,
        locationPrecision: point.precision === "exact" ? "exact" : "approximate",
      }));
      setAddressStatus(point.precision === "exact"
        ? "Número e rua confirmados. Confira o pino antes de salvar."
        : "Local aproximado: o número não foi confirmado pelo mapa. Arraste o pino até a residência correta.");
    } catch (error) {
      setAddressStatus(error instanceof Error ? error.message : "Não foi possível localizar o endereço.");
    } finally { setContactLocating(false); }
  }
  async function locateMeeting() {
    if (!meeting.address?.trim()) return;
    setMeetingLocating(true);
    setMeetingMapError("");
    try {
      const point = await geocodeMeetingAddress(meeting.address);
      if (!point) {
        setMeetingMapError(
          "Endereço não localizado. Confira rua, número, cidade e CEP.",
        );
        return;
      }
      setMeeting((current) => ({ ...current, ...point }));
    } catch {
      setMeetingMapError("Não foi possível localizar o endereço agora.");
    } finally {
      setMeetingLocating(false);
    }
  }
  const save = async () => {
    if (kind === "reuniao") {
      if (
        !meeting.title ||
        !meeting.day ||
        !meeting.time ||
        !meeting.address ||
        !meeting.place ||
        !meeting.notes
      ) {
        tell("Preencha todos os campos obrigatórios da reunião.");
        return;
      }
      if (
        !Number.isFinite(meeting.latitude) ||
        !Number.isFinite(meeting.longitude)
      ) {
        setMeetingMapError("Localize o endereço no mapa antes de agendar.");
        tell("Localize o endereço e confirme o pino no mapa.");
        return;
      }
      const slot = `${meeting.day} · ${meeting.time}`;
      if (meetings.some((item) => item.date === slot)) {
        tell("Este horário já está ocupado. Escolha um dos horários livres.");
        return;
      }
      setSaving(true);
      const ok = await onSave("meeting", {
        ...meeting,
        title: meeting.title.trim(),
        day: meeting.day,
        time: meeting.time,
        date: slot,
        address: meeting.address.trim(),
        place: meeting.place.trim(),
        notes: meeting.notes.trim(),
      });
      setSaving(false);
      if (ok) close();
      return;
    }
    if (kind === "cadastro" || kind === "cadastro_lideranca") {
      if (
        !contact.name ||
        !contact.phone ||
        !contact.cep ||
        !contact.street ||
        !contact.number ||
        !contact.district
      ) {
        tell("Preencha nome, WhatsApp, CEP, rua, número e bairro.");
        return;
      }
      if (!Number.isFinite(contact.latitude) || !Number.isFinite(contact.longitude)) {
        setAddressStatus("Localize e confirme o pino no mapa antes de salvar.");
        tell("Localize o endereço e confira o pino antes de salvar.");
        return;
      }
      setSaving(true);
      const ok = await onSave("contact", contact);
      setSaving(false);
      if (ok) close();
      return;
    }
    tell("Informações salvas com segurança.");
    close();
  };
  async function lookupCep() {
    const cep = (contact.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setAddressStatus("Consultando CEP…");
    try {
      const response = await fetch(`/api/address?action=cep&cep=${cep}`);
      const data = await response.json();
      if (data.erro) {
        setAddressStatus("CEP não encontrado.");
        return;
      }
      setContact((current) => ({
        ...current,
        cep: data.cep || current.cep,
        street: data.logradouro || current.street,
        district: data.bairro || current.district,
        city: data.localidade || "Arapongas",
        state: data.uf || "PR",
        latitude: undefined,
        longitude: undefined,
      }));
      setAddressStatus(
        "CEP localizado. Informe o número para fixar o alfinete.",
      );
    } catch {
      setAddressStatus("Não foi possível consultar o CEP agora.");
    }
  }
  const addressFields = (
    <>
      <div className="address-grid">
        <label>
          CEP
          <input
            required
            inputMode="numeric"
            value={contact.cep}
            onBlur={lookupCep}
            onChange={(e) => setContact({ ...contact, cep: e.target.value, latitude: undefined, longitude: undefined })}
            placeholder="00000-000"
          />
        </label>
        <label>
          Número
          <input
            required
            value={contact.number}
            onChange={(e) => setContact({ ...contact, number: e.target.value, latitude: undefined, longitude: undefined })}
            placeholder="123"
          />
        </label>
      </div>
      <label>
        Rua
        <input
          required
          value={contact.street}
          onChange={(e) => setContact({ ...contact, street: e.target.value, latitude: undefined, longitude: undefined })}
          placeholder="Preenchida pelo CEP"
        />
      </label>
      <label>
        Bairro
        <input
          required
          value={contact.district}
          onChange={(e) => setContact({ ...contact, district: e.target.value, latitude: undefined, longitude: undefined })}
          placeholder="Preenchido pelo CEP"
        />
      </label>
      {addressStatus && <p className="address-status">⌖ {addressStatus}</p>}
      <button type="button" className="locate-contact-button" onClick={() => void locateContact()} disabled={contactLocating}>
        {contactLocating ? "Localizando…" : "Localizar e conferir no mapa"}
      </button>
      {Number.isFinite(contact.latitude) && Number.isFinite(contact.longitude) && (
        <MeetingLocationMap
          latitude={Number(contact.latitude)} longitude={Number(contact.longitude)}
          label={contact.locationLabel || `${contact.street}, ${contact.number}`}
          onChange={(latitude, longitude) => setContact((current) => ({ ...current, latitude, longitude, locationPrecision: "exact", locationLabel: `Pino confirmado manualmente — ${current.street}, ${current.number}` }))}
        />
      )}
      <label>
        Liderança responsável
        <input
          value={contact.leader}
          onChange={(e) => setContact({ ...contact, leader: e.target.value })}
          placeholder="Opcional"
        />
      </label>
    </>
  );
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className={`modal ${kind === "reuniao" ? "meeting-modal" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <small>VOTO FORTE PARANÁ</small>
            <h3>{titles[kind]}</h3>
          </div>
          <button onClick={close}>×</button>
        </header>
        {kind === "filtros" ? (
          <div className="filter-list">
            <label>
              <input type="checkbox" defaultChecked /> Limites oficiais de
              bairros
            </label>
            <label>
              <input type="checkbox" defaultChecked /> Lideranças
            </label>
            <label>
              <input type="checkbox" defaultChecked /> Eleitores
            </label>
          </div>
        ) : kind === "perfil" ? (
          <div className="profile-box">
            <span>{initials(currentUser.name)}</span>
            <h4>{currentUser.name}</h4>
            <p>{roleLabel(currentUser.role)}</p>
            <button onClick={() => tell("Configurações de conta abertas.")}>
              Configurações da conta
            </button>
            <button
              className="logout-link"
              onClick={() => void supabase.auth.signOut()}
            >
              Sair da plataforma
            </button>
          </div>
        ) : (
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              {kind === "reuniao" ? "Nome da reunião" : "Nome completo"}
              <input
                required
                value={kind === "reuniao" ? meeting.title : contact.name}
                onChange={(e) =>
                  kind === "reuniao"
                    ? setMeeting({ ...meeting, title: e.target.value })
                    : setContact({ ...contact, name: e.target.value })
                }
                placeholder={
                  kind === "reuniao"
                    ? "Ex.: Reunião com lideranças"
                    : "Nome da pessoa"
                }
              />
            </label>
            <div>
              <label>
                {kind === "reuniao" ? "Data" : "WhatsApp"}
                <input
                  required
                  type={kind === "reuniao" ? "date" : "tel"}
                  value={kind === "reuniao" ? meeting.day : contact.phone}
                  onChange={(e) =>
                    kind === "reuniao"
                      ? setMeeting({ ...meeting, day: e.target.value })
                      : setContact({ ...contact, phone: e.target.value })
                  }
                />
              </label>
              <label>
                {kind === "reuniao" ? "Hora" : "Perfil"}
                {kind === "reuniao" ? (
                  <input
                    required
                    type="time"
                    value={meeting.time}
                    onChange={(e) =>
                      setMeeting({ ...meeting, time: e.target.value })
                    }
                  />
                ) : (
                  <select
                    value={contact.kind}
                    onChange={(e) =>
                      setContact({
                        ...contact,
                        kind: e.target.value as Contact["kind"],
                      })
                    }
                    disabled={kind === "cadastro_lideranca"}
                  >
                    <option>Eleitor</option>
                    <option>Liderança</option>
                  </select>
                )}
              </label>
            </div>
            {kind === "reuniao" ? (
              <>
                <label>
                  Endereço completo
                  <div className="address-locate-row">
                    <input required value={meeting.address || ""} onChange={(e) => setMeeting({ ...meeting, address: e.target.value, latitude: undefined, longitude: undefined })} placeholder="Rua, número, bairro, cidade e CEP"/>
                    <button type="button" onClick={() => void locateMeeting()} disabled={meetingLocating}>{meetingLocating ? "Localizando…" : "Localizar no mapa"}</button>
                  </div>
                </label>
                {meetingMapError && <p className="map-error">{meetingMapError}</p>}
                {Number.isFinite(meeting.latitude) && Number.isFinite(meeting.longitude) && <MeetingLocationMap latitude={Number(meeting.latitude)} longitude={Number(meeting.longitude)} label={meeting.locationLabel || meeting.address || "Local da reunião"} onChange={(latitude, longitude) => setMeeting((current) => ({ ...current, latitude, longitude }))}/>} 
                <label>
                  Local
                  <input
                    required
                    value={meeting.place}
                    onChange={(e) =>
                      setMeeting({ ...meeting, place: e.target.value })
                    }
                    placeholder="Ex.: Salão comunitário"
                  />
                </label>
                <label>
                  Observações
                  <textarea
                    required
                    value={meeting.notes}
                    onChange={(e) =>
                      setMeeting({ ...meeting, notes: e.target.value })
                    }
                    placeholder="Pauta, participantes ou orientações importantes"
                  />
                </label>
              </>
            ) : (
              addressFields
            )}
          </form>
        )}
        <footer>
          <button onClick={close}>Cancelar</button>
          <button
            className="primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving
              ? "Salvando…"
              : kind === "cadastro" || kind === "cadastro_lideranca"
                ? "Salvar e fixar no mapa"
                : kind === "reuniao"
                  ? "Agendar reunião"
                  : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
