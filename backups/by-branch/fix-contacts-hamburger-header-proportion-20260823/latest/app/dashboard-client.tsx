"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, supabase } from "./supabase-client";
  

import ElectoralPanelClient from "./electoral-panel/electoral-panel-client";
import { Icons } from "./ui-icons";

type View =
  | "Visão Geral"
  | "Contatos"
  | "Agenda Inteligente"
  | "Mapa Eleitoral"
  | "Painel Eleitoral"
  | "WhatsApp"
  | "Administração";
type Modal =
  | null
  | "cadastro"
  | "cadastro_lideranca"
  | "reuniao"
  | "filtros"
  | "perfil";

const menu: { label: View; iconRender: (props: { size?: number }) => React.ReactNode; badge?: string }[] = [
  { label: "Visão Geral", iconRender: (p) => <Icons.Overview {...p} /> },
  { label: "Contatos", iconRender: (p) => <Icons.Contacts {...p} /> },
  { label: "Mapa Eleitoral", iconRender: (p) => <Icons.ElectoralMap {...p} /> },
  { label: "Painel Eleitoral", iconRender: (p) => <Icons.ElectoralPanel {...p} /> },
  { label: "WhatsApp", iconRender: (p) => <Icons.WhatsApp {...p} /> },
];

function Brand() {
  return (
    <div className="brand-lockup">
      <div className="brand-icons">
        <img
          className="parana-icon"
          src="/voto-forte-bandeira-icon.jpg"
          alt="Bandeira do Estado do Paraná - Voto Forte"
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
};

type Meeting = {
  title: string;
  date: string;
  time?: string;
  place?: string;
  leader?: string;
  notes?: string;
  done?: boolean;
};

type Draft = {
  title: string;
  body: string;
};

type OwnedRecord = {
  id: number;
  ownerEmail: string;
  kind: "contact" | "meeting" | "draft";
  payload: Contact | Meeting | Draft;
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

function initials(value: string) {
  return (
    value
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
  const [notice, setNotice] = useState("");
  const [collapsed, setCollapsed] = useState(false);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view") as View | null;
    const allowedViews = new Set<View>([
      "Visão Geral",
      "Mapa Eleitoral",
      "Painel Eleitoral",
      "WhatsApp",
      "Administração",
    ]);
    if (requestedView && allowedViews.has(requestedView)) {
      if (requestedView !== "Administração" || isAdmin) setView(requestedView);
      params.delete("view");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
      );
    }
  }, [isAdmin]);

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

  const toggleMobileSidebar = useCallback(() => {
    closeMapPopup();
    setCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleCloseMobile = () => {
      setCollapsed(false);
    };
    const handleNavigateOverview = () => {
      setView("Visão Geral");
    };
    const handleNavigateElectoral = () => {
      setView("Painel Eleitoral");
    };
    const handleMeetingQuickView = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; date?: string; place?: string; leader?: string; notes?: string }>).detail;
      if (detail?.title) {
        setNotice(`📅 Reunião: ${detail.title} • Local: ${detail.place || "Arapongas"} • Responsável: ${detail.leader || "Coordenação"}`);
      }
    };
    window.addEventListener("voto-forte:close-mobile-sidebar", handleCloseMobile);
    window.addEventListener("voto-forte:navigate-overview", handleNavigateOverview);
    window.addEventListener("voto-forte:navigate-electoral-panel", handleNavigateElectoral);
    window.addEventListener("voto-forte:open-meeting-quick-view", handleMeetingQuickView);
    return () => {
      window.removeEventListener("voto-forte:close-mobile-sidebar", handleCloseMobile);
      window.removeEventListener("voto-forte:navigate-overview", handleNavigateOverview);
      window.removeEventListener("voto-forte:navigate-electoral-panel", handleNavigateElectoral);
      window.removeEventListener("voto-forte:open-meeting-quick-view", handleMeetingQuickView);
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

      let localEvents: any[] = [];
      try {
        const rawLocal = typeof window !== "undefined" ? localStorage.getItem("agenda-eleitoral-parana-2026-v1") : null;
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            localEvents = parsed;
          }
        }
      } catch {}

      const convertedLocal = localEvents
        .filter((ev: any) => !ev.done)
        .map((ev: any) => {
          const timeMatch = ev.desc?.match(/(\d{2}h\d{2}|\d{2}:\d{2})/);
          const timeStr = timeMatch ? timeMatch[1].replace("h", ":") : "";
          return {
            id: `local-${ev.id}`,
            title: ev.title,
            date: ev.date,
            time: timeStr,
            place: ev.location || "Arapongas",
            category: ev.category,
            done: Boolean(ev.done),
          };
        });

      const apiMeetings = previewRecords.map((record) => ({
        id: String(record.id),
        ownerEmail: record.ownerEmail,
        ...(record.payload as Meeting),
      }));

      const allCombined = [...convertedLocal, ...apiMeetings];
      allCombined.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

      setOverviewMeetings(allCombined);
      setOverviewSummary({
        total: Number(summaryData.total || 0),
        voters: Number(summaryData.voters || 0),
        leaders: Number(summaryData.leaders || 0),
        meetings: allCombined.length || Number(summaryData.meetings || 0),
        districtsReached: Number(summaryData.districtsReached || 0),
      });
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
    <InstitutionalCommunicationClient onBackToDashboard={() => setView("Visão Geral")} />
  ) : view === "Mapa Eleitoral" ? (
    loadingContacts && contactsLoadedScope !== scope ? (
      <div className="loading-state">Carregando mapa eleitoral…</div>
    ) : (
      <MapPage open={setModal} contacts={contacts} meetings={meetings} />
    )
  ) : view === "Painel Eleitoral" ? (
    <ElectoralPanelClient onBackToDashboard={() => setView("Visão Geral")} />
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
                <span className="nav-icon">{item.iconRender({ size: 17 })}</span>
                <span className="nav-name">{item.label}</span>
                {item.badge && <em>{item.badge}</em>}
              </button>
              {item.label === "WhatsApp" && (
                <button
                  type="button"
                  className="whaticket-broadcast-sidebar-btn"
                  onClick={() => {
                    closeMobileSidebar();
                    window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"));
                  }}
                  title="Disparo em Massa"
                >
                  <span className="nav-icon" style={{ color: "#2ddd7f", display: "inline-flex", alignItems: "center" }}>
                    <Icons.Lightning size={17} color="#2ddd7f" />
                  </span>
                  <span className="nav-name">Disparo em Massa</span>
                </button>
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
              <span className="nav-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                <Icons.Admin size={17} />
              </span>
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
      <main className="main">
        <header className="topbar">
          <div className="page-id">
            <button
              type="button"
              className="mobile-menu"
              onClick={toggleMobileSidebar}
              aria-label="Abrir menu lateral"
              title="Abrir menu"
            >
              ☰
            </button>
            <div>
              <small>VOTO FORTE PARANÁ</small>
              <h1>{view}</h1>
            </div>
          </div>
          <div className="top-actions">
            {isAdmin && (
              <label className="scope-picker">
                <span>Visualizando</span>
                <select aria-label="Visualizando registros por" value={scope} onChange={(event) => setScope(event.target.value)}>
                  <option value="all">Todos os usuários</option>
                  {availableUsers.map((user) => (
                    <option key={user.email} value={user.email}>{user.name}</option>
                  ))}
                </select>
              </label>
            )}
            <button className="profile" type="button" onClick={() => setModal("perfil")}>
              <span>{initials(currentUser.name)}</span>
              <div><b>{currentUser.name}</b><small>{roleLabel(currentUser.role)}</small></div>
              <i>⌄</i>
            </button>
          </div>
        </header>
        <section className="workspace">{content}</section>
      </main>
    </div>
  );
}
