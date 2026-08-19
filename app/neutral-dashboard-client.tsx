"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";
import "./optimized-dashboard.css";

type CurrentAccount = {
  email: string;
  name: string;
  role: string;
};

type Contact = {
  id: number;
  ownerEmail: string;
  name?: string;
  phone?: string;
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
};

type Summary = {
  total: number;
  voters: number;
  leaders: number;
  meetings: number;
  districtsReached: number;
};

type ContactPage = {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type VisibleUser = {
  email: string;
  name: string;
  status?: string;
};

const PAGE_SIZE = 25;
const EMPTY_SUMMARY: Summary = {
  total: 0,
  voters: 0,
  leaders: 0,
  meetings: 0,
  districtsReached: 0,
};
const EMPTY_PAGE: ContactPage = {
  contacts: [],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 1,
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const ADMIN_ROLES = new Set(["master", "gestor", "lider"]);

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(Math.max(0, value)));
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "VF"
  );
}

export default function NeutralDashboardClient({
  currentUser,
}: {
  currentUser: CurrentAccount;
}) {
  const isAdmin = ADMIN_ROLES.has(String(currentUser.role || "").toLowerCase());
  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [users, setUsers] = useState<VisibleUser[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [pageData, setPageData] = useState<ContactPage>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [contactsRequested, setContactsRequested] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<number | null>(null);
  const summaryVersion = useRef(0);
  const contactsVersion = useRef(0);
  const contactActionInFlight = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    apiFetch("/api/users", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok || controller.signal.aborted) return;
        setUsers(
          ((data.users ?? []) as VisibleUser[])
            .filter((user) => user.status === "active")
            .map((user) => ({
              email: String(user.email || "").trim().toLowerCase(),
              name: String(user.name || user.email || "").trim(),
              status: user.status,
            })),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isAdmin]);

  const loadSummary = useCallback(async () => {
    const version = ++summaryVersion.current;
    setLoadingSummary(true);
    try {
      const response = await apiFetch(
        `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar resumo");
      if (version !== summaryVersion.current) return;
      setSummary({
        total: finiteNumber(data.total),
        voters: finiteNumber(data.voters),
        leaders: finiteNumber(data.leaders),
        meetings: finiteNumber(data.meetings),
        districtsReached: finiteNumber(data.districtsReached),
      });
    } catch (error) {
      if (version === summaryVersion.current)
        setMessage(error instanceof Error ? error.message : "Falha ao carregar resumo");
    } finally {
      if (version === summaryVersion.current) setLoadingSummary(false);
    }
  }, [scope]);

  const loadContacts = useCallback(async () => {
    if (!contactsRequested) return;
    const version = ++contactsVersion.current;
    setLoadingContacts(true);
    try {
      const params = new URLSearchParams({
        owner: scope,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (query) params.set("q", query);
      if (profile) params.set("profile", profile);
      if (districtFilter) params.set("district", districtFilter);

      const response = await apiFetch(`/api/contacts?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar contatos");
      if (version !== contactsVersion.current) return;

      setPageData({
        contacts: Array.isArray(data.contacts) ? data.contacts : [],
        total: finiteNumber(data.total),
        page: Math.max(1, finiteNumber(data.page) || 1),
        pageSize: Math.max(1, finiteNumber(data.pageSize) || PAGE_SIZE),
        totalPages: Math.max(1, finiteNumber(data.totalPages) || 1),
      });
    } catch (error) {
      if (version === contactsVersion.current)
        setMessage(error instanceof Error ? error.message : "Falha ao carregar contatos");
    } finally {
      if (version === contactsVersion.current) setLoadingContacts(false);
    }
  }, [contactsRequested, districtFilter, page, profile, query, scope]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!contactsRequested) return;
    void loadContacts();
  }, [contactsRequested, loadContacts]);

  useEffect(() => {
    const handleDistrictFilter = (event: Event) => {
      const district = String(
        (event as CustomEvent<{ district?: string }>).detail?.district || "",
      ).trim();
      if (!district) return;
      setPage(1);
      setQueryInput("");
      setQuery("");
      setProfile("");
      setDistrictFilter(district);
      setContactsRequested(false);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".contacts-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };
    window.addEventListener("voto-forte:filter-district-contacts", handleDistrictFilter);
    return () =>
      window.removeEventListener("voto-forte:filter-district-contacts", handleDistrictFilter);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextQuery = queryInput.trim();
      setPage(1);
      setQuery(nextQuery);
      if (nextQuery) setContactsRequested(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    const refresh = () => {
      void loadSummary();
      if (contactsRequested) void loadContacts();
    };
    window.addEventListener("voto-forte:records-changed", refresh);
    window.addEventListener("voto-forte:contacts-imported", refresh);
    window.addEventListener("voto-forte:refresh-dashboard", refresh);
    return () => {
      window.removeEventListener("voto-forte:records-changed", refresh);
      window.removeEventListener("voto-forte:contacts-imported", refresh);
      window.removeEventListener("voto-forte:refresh-dashboard", refresh);
    };
  }, [contactsRequested, loadContacts, loadSummary]);

  const scopeName = useMemo(() => {
    if (scope === "all") return "Todos os usuários";
    return users.find((user) => user.email === scope)?.name || currentUser.name;
  }, [currentUser.name, scope, users]);

  const firstItem = pageData.total
    ? (pageData.page - 1) * pageData.pageSize + 1
    : 0;
  const lastItem = Math.min(pageData.page * pageData.pageSize, pageData.total);
  const hasFilters = Boolean(queryInput.trim() || query || profile || districtFilter);

  function requestContacts() {
    setPage(1);
    setContactsRequested(true);
  }

  function resetContactList() {
    contactsVersion.current += 1;
    setLoadingContacts(false);
    setContactsRequested(false);
    setPageData(EMPTY_PAGE);
    setPage(1);
  }

  function changeScope(nextScope: string) {
    setScope(nextScope);
    setQueryInput("");
    setQuery("");
    setProfile("");
    setDistrictFilter("");
    resetContactList();
  }

  function clearFilters() {
    setQueryInput("");
    setQuery("");
    setProfile("");
    setDistrictFilter("");
    setPage(1);
    if (!contactsRequested) setPageData(EMPTY_PAGE);
  }

  async function deleteContact(contact: Contact) {
    if (contactActionInFlight.current) return;
    if (!window.confirm(`Excluir o contato ${contact.name || "selecionado"}?`)) return;

    contactActionInFlight.current = true;
    setDeletingContactId(contact.id);
    try {
      const response = await apiFetch(`/api/records?id=${contact.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Não foi possível excluir o contato.");
        return;
      }
      setMessage("Contato excluído.");
      window.dispatchEvent(new Event("voto-forte:records-changed"));
    } catch {
      setMessage("Não foi possível excluir o contato agora. Verifique sua conexão e tente novamente.");
    } finally {
      contactActionInFlight.current = false;
      setDeletingContactId(null);
    }
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || contactActionInFlight.current) return;

    const contact = editing;
    contactActionInFlight.current = true;
    setSavingContact(true);
    try {
      const response = await apiFetch("/api/records", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          payload: {
            name: String(contact.name || "").trim(),
            phone: String(contact.phone || "").trim(),
            phoneNormalized: String(contact.phone || "").replace(/\D/g, ""),
            district: String(contact.district || "").trim(),
            leader: String(contact.leader || "").trim(),
            kind: contact.kind === "Liderança" ? "Liderança" : "Eleitor",
            cep: String(contact.cep || "").trim(),
            street: String(contact.street || "").trim(),
            number: String(contact.number || "").trim(),
            city: String(contact.city || "").trim(),
            state: String(contact.state || "").trim(),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Não foi possível atualizar o contato.");
        return;
      }
      setEditing(null);
      setMessage("Contato atualizado.");
      window.dispatchEvent(new Event("voto-forte:records-changed"));
    } catch {
      setMessage("Não foi possível atualizar o contato agora. Verifique sua conexão e tente novamente.");
    } finally {
      contactActionInFlight.current = false;
      setSavingContact(false);
    }
  }

  return (
    <main className="optimized-shell">
      <header className="optimized-topbar">
        <div className="optimized-brand-row">
          <span className="optimized-brand-mark" aria-hidden="true">VF</span>
          <div>
            <small>VOTO FORTE PARANÁ</small>
            <h1>Painel de contatos</h1>
            <p>Indicadores, bairros e contatos carregados somente quando necessários.</p>
          </div>
        </div>
        <div className="optimized-hero-controls">
          {isAdmin ? (
            <label className="optimized-scope-control">
              <span>Visualizando</span>
              <select value={scope} onChange={(event) => changeScope(event.target.value)}>
                <option value="all">Todos os usuários</option>
                {users.map((user) => (
                  <option key={user.email} value={user.email}>{user.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="optimized-scope-badge">
              <span>Visualizando</span>
              <b>{scopeName}</b>
            </div>
          )}
        </div>
      </header>

      <nav className="optimized-quick-actions" aria-label="Ações rápidas">
        <a className="primary" href="/importar-contatos">
          <span className="optimized-action-icon" aria-hidden="true">＋</span>
          <span><b>Importar contatos</b><small>Adicionar ou atualizar a base</small></span>
        </a>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("voto-forte:open-whatsapp-district-modal"))}
          style={{ cursor: "pointer", textAlign: "left" }}
        >
          <span className="optimized-action-icon" aria-hidden="true" style={{ color: "#16a34a", background: "#dcfce7" }}>📲</span>
          <span><b>Disparo por Bairros</b><small>WhatsApp em massa por região</small></span>
        </button>
        <a href="/pendencias-localizacao">
          <span className="optimized-action-icon" aria-hidden="true">!</span>
          <span><b>Central de Qualidade</b><small>Revisar dados incompletos</small></span>
        </a>
        <button
          type="button"
          onClick={() => {
            void loadSummary();
            if (contactsRequested) void loadContacts();
          }}
          disabled={loadingSummary || loadingContacts}
        >
          <span className="optimized-action-icon" aria-hidden="true">↻</span>
          <span><b>Atualizar painel</b><small>Buscar os dados mais recentes</small></span>
        </button>
      </nav>

      <section className="optimized-overview" aria-busy={loadingSummary}>
        <div className="optimized-section-heading">
          <div><small>VISÃO GERAL</small><h2>{scopeName}</h2></div>
          <span>{loadingSummary ? "Atualizando indicadores…" : "Totais calculados sobre toda a base"}</span>
        </div>
        <div className="optimized-kpis">
          <article className="is-primary">
            <span className="optimized-kpi-label">Total de contatos</span>
            <b>{loadingSummary ? "—" : formatNumber(summary.total)}</b>
            <small>cadastros disponíveis neste escopo</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Eleitores</span>
            <b>{loadingSummary ? "—" : formatNumber(summary.voters)}</b>
            <small>total oficial agregado</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Lideranças</span>
            <b>{loadingSummary ? "—" : formatNumber(summary.leaders)}</b>
            <small>total oficial agregado</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Bairros alcançados</span>
            <b>{loadingSummary ? "—" : formatNumber(summary.districtsReached)}</b>
            <small>bairros com cadastros</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Reuniões</span>
            <b>{loadingSummary ? "—" : formatNumber(summary.meetings)}</b>
            <small>registros consolidados</small>
          </article>
        </div>
      </section>

      <section className="optimized-content" style={{ gridTemplateColumns: "1fr" }}>
        <article className="optimized-panel contacts-panel">
          <div className="optimized-panel-head">
            <div>
              <small>BASE DE CONTATOS</small>
              <h2>{contactsRequested ? "Contatos selecionados" : districtFilter ? `Bairro: ${districtFilter}` : "Base de contatos"}</h2>
              <p>
                {contactsRequested
                  ? `Exibindo ${formatNumber(firstItem)}–${formatNumber(lastItem)} de ${formatNumber(pageData.total)}`
                  : districtFilter
                    ? `Bairro ${districtFilter} selecionado. Clique em "Ver lista" para abrir os contatos.`
                    : "A lista completa está recolhida. Clique em \"Ver lista\" ou selecione um bairro."}
              </p>
            </div>
            <div className="optimized-contact-load-actions">
              {!contactsRequested ? (
                <button className="primary" type="button" onClick={requestContacts}>
                  Ver lista
                </button>
              ) : (
                <button type="button" onClick={resetContactList} disabled={loadingContacts}>
                  Ocultar lista
                </button>
              )}
            </div>
          </div>

          {districtFilter && (
            <div
              className="optimized-active-district"
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                padding: "10px 14px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ color: "#166534", fontWeight: 700 }}>
                  Bairro: <b style={{ color: "#14532d", fontSize: "15px" }}>{districtFilter}</b>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDistrictFilter("");
                    setPage(1);
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Remover filtro ×
                </button>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("voto-forte:open-neighborhood-electoral-drawer", {
                        detail: { district: districtFilter },
                      }),
                    )
                  }
                  style={{
                    padding: "8px 13px",
                    borderRadius: "8px",
                    background: "#0284c7",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "12px",
                    border: 0,
                    cursor: "pointer",
                    boxShadow: "0 3px 10px rgba(2, 132, 199, 0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  🏫 Colégios & Dados TSE
                </button>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("voto-forte:open-whatsapp-district-modal", {
                        detail: { district: districtFilter },
                      }),
                    )
                  }
                  style={{
                    padding: "8px 13px",
                    borderRadius: "8px",
                    background: "#16a34a",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "12px",
                    border: 0,
                    cursor: "pointer",
                    boxShadow: "0 3px 10px rgba(22, 163, 74, 0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  📲 WhatsApp
                </button>
              </div>
            </div>
          )}

          <div className="optimized-filters is-open">
            <label className="optimized-search-field">
              <span>Buscar contato</span>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Nome, telefone, bairro ou responsável"
                inputMode="search"
              />
            </label>
            <label>
              <span>Perfil</span>
              <select
                value={profile}
                onChange={(event) => {
                  setPage(1);
                  setProfile(event.target.value);
                  setContactsRequested(true);
                }}
              >
                <option value="">Todos os perfis</option>
                <option value="Eleitor">Eleitores</option>
                <option value="Liderança">Lideranças</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!hasFilters}>
              Limpar filtros
            </button>
          </div>

          {!contactsRequested ? (
            <div className="optimized-contact-idle" role="status" style={{ textAlign: "center", padding: "28px 16px" }}>
              <b>{districtFilter ? `Bairro ${districtFilter} selecionado` : "Lista de contatos recolhida"}</b>
              <p style={{ margin: "6px 0 14px", color: "#64748b" }}>
                {districtFilter
                  ? `Os dados do bairro ${districtFilter} foram identificados. Clique no botão abaixo para abrir a lista.`
                  : "A lista completa está oculta para otimizar o espaço e a navegação no celular. Clique para abrir."}
              </p>
              <button
                className="primary"
                type="button"
                onClick={requestContacts}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "#17345c",
                  color: "#fff",
                  fontWeight: 800,
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Ver lista
              </button>
            </div>
          ) : loadingContacts ? (
            <div className="optimized-loading">
              <span className="optimized-spinner" /> Carregando contatos…
            </div>
          ) : (
            <div className="optimized-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Telefone</th>
                    <th>Perfil</th>
                    <th>Bairro</th>
                    {isAdmin && <th>Responsável</th>}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td data-label="Contato" className="optimized-contact-cell">
                        <span className="optimized-avatar">{initials(contact.name || "")}</span>
                        <span>
                          <b>{contact.name || "Sem nome"}</b>
                          {contact.leader && <small>{contact.leader}</small>}
                        </span>
                      </td>
                      <td data-label="Telefone">
                        {contact.phone ? (
                          <a className="optimized-phone" href={`tel:${contact.phone.replace(/\D/g, "")}`}>
                            {contact.phone}
                          </a>
                        ) : "—"}
                      </td>
                      <td data-label="Perfil">
                        <span className={`optimized-profile-badge${contact.kind === "Liderança" ? " is-leader" : ""}`}>
                          {contact.kind || "Eleitor"}
                        </span>
                      </td>
                      <td data-label="Bairro">{contact.district || "—"}</td>
                      {isAdmin && <td data-label="Responsável">{contact.ownerEmail}</td>}
                      <td data-label="Ações" className="optimized-row-actions">
                        <button type="button" disabled={deletingContactId !== null} onClick={() => setEditing(contact)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={deletingContactId !== null}
                          onClick={() => void deleteContact(contact)}
                        >
                          {deletingContactId === contact.id ? "Excluindo…" : "Excluir"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pageData.contacts.length && (
                <div className="optimized-empty">
                  <b>Nenhum contato encontrado</b>
                  <p>Revise a busca ou os filtros aplicados.</p>
                </div>
              )}
            </div>
          )}

          {contactsRequested && !loadingContacts && (
            <footer className="optimized-pagination">
              <span>
                Mostrando {formatNumber(firstItem)}–{formatNumber(lastItem)} de {formatNumber(pageData.total)}
              </span>
              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Anterior
                </button>
                <b>Página {formatNumber(pageData.page)} de {formatNumber(pageData.totalPages)}</b>
                <button
                  type="button"
                  disabled={page >= pageData.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Próxima
                </button>
              </div>
            </footer>
          )}
        </article>
      </section>

      {message && (
        <div className="optimized-toast" role="status" onClick={() => setMessage("")}>{message}</div>
      )}

      {editing && (
        <div
          className="optimized-modal-backdrop"
          onMouseDown={() => {
            if (!savingContact) setEditing(null);
          }}
        >
          <form
            className="optimized-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Editar contato"
            aria-busy={savingContact}
            onSubmit={saveContact}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2>Editar contato</h2>
              <button type="button" aria-label="Fechar" disabled={savingContact} onClick={() => setEditing(null)}>×</button>
            </header>
            <label>
              Nome
              <input
                required
                disabled={savingContact}
                value={editing.name || ""}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </label>
            <label>
              Telefone
              <input
                required
                disabled={savingContact}
                value={editing.phone || ""}
                onChange={(event) => setEditing({ ...editing, phone: event.target.value })}
              />
            </label>
            <label>
              Perfil
              <select
                disabled={savingContact}
                value={editing.kind || "Eleitor"}
                onChange={(event) => setEditing({ ...editing, kind: event.target.value as Contact["kind"] })}
              >
                <option value="Eleitor">Eleitor</option>
                <option value="Liderança">Liderança</option>
              </select>
            </label>
            <label>
              Bairro
              <input
                disabled={savingContact}
                value={editing.district || ""}
                onChange={(event) => setEditing({ ...editing, district: event.target.value })}
              />
            </label>
            <label>
              Liderança relacionada
              <input
                disabled={savingContact}
                value={editing.leader || ""}
                onChange={(event) => setEditing({ ...editing, leader: event.target.value })}
              />
            </label>
            <div className="optimized-modal-actions">
              <button type="button" disabled={savingContact} onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="primary" disabled={savingContact}>
                {savingContact ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
