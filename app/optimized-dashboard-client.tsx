"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CurrentUser } from "./dashboard-client";
import { apiFetch, supabase } from "./supabase-client";
import "./optimized-dashboard.css";

type Contact = {
  id: number;
  ownerEmail: string;
  name: string;
  phone: string;
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
  districts: { district: string; total: number }[];
};

type ContactPage = {
  contacts: Contact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DistrictView = "priority" | "covered" | "all";

const EMPTY_SUMMARY: Summary = {
  total: 0,
  voters: 0,
  leaders: 0,
  meetings: 0,
  districtsReached: 0,
  districts: [],
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

export default function OptimizedDashboardClient({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  const isAdmin = ["master", "gestor", "lider", "admin"].includes(currentUser.role);
  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [users, setUsers] = useState<{ email: string; name: string }[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [pageData, setPageData] = useState<ContactPage>({
    contacts: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [districtView, setDistrictView] = useState<DistrictView>("priority");
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch("/api/users")
      .then((response) => response.json())
      .then((data) =>
        setUsers(
          (data.users ?? [])
            .filter((user: { status: string }) => user.status === "active")
            .map((user: { email: string; name: string }) => ({
              email: user.email,
              name: user.name,
            })),
        ),
      )
      .catch(() => undefined);
  }, [isAdmin]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await apiFetch(
        `/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar resumo");
      setSummary(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar resumo");
    } finally {
      setLoadingSummary(false);
    }
  }, [scope]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const params = new URLSearchParams({
        owner: scope,
        page: String(page),
        pageSize: "50",
      });
      if (query) params.set("q", query);
      if (profile) params.set("profile", profile);
      const response = await apiFetch(`/api/contacts?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar contatos");
      setPageData(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar contatos");
    } finally {
      setLoadingContacts(false);
    }
  }, [page, profile, query, scope]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadContacts(), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadContacts, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(queryInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  async function deleteContact(contact: Contact) {
    if (!window.confirm(`Excluir o contato ${contact.name}?`)) return;
    const response = await apiFetch(`/api/records?id=${contact.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Não foi possível excluir o contato.");
      return;
    }
    setMessage("Contato excluído.");
    await Promise.all([loadContacts(), loadSummary()]);
  }

  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const response = await apiFetch("/api/records", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        payload: {
          name: editing.name,
          phone: editing.phone,
          district: editing.district || "",
          leader: editing.leader || "",
          kind: editing.kind || "Eleitor",
          cep: editing.cep || "",
          street: editing.street || "",
          number: editing.number || "",
          city: editing.city || "",
          state: editing.state || "",
          phoneNormalized: editing.phone.replace(/\D/g, ""),
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Não foi possível editar o contato.");
      return;
    }
    setEditing(null);
    setMessage("Contato atualizado.");
    await Promise.all([loadContacts(), loadSummary()]);
  }

  function clearFilters() {
    setQueryInput("");
    setQuery("");
    setProfile("");
    setPage(1);
  }

  const firstItem = pageData.total ? (pageData.page - 1) * pageData.pageSize + 1 : 0;
  const lastItem = Math.min(pageData.page * pageData.pageSize, pageData.total);
  const activeFilterCount = Number(Boolean(queryInput.trim() || query)) + Number(Boolean(profile));

  const scopeName = useMemo(
    () =>
      scope === "all"
        ? "Todos os usuários"
        : users.find((user) => user.email === scope)?.name || currentUser.name,
    [currentUser.name, scope, users],
  );

  const analytics = useMemo(() => {
    const coveredDistricts = summary.districts.filter((item) => item.total > 0);
    const emptyDistricts = Math.max(summary.districts.length - coveredDistricts.length, 0);
    const rankedDistricts = [...coveredDistricts].sort(
      (left, right) => right.total - left.total || left.district.localeCompare(right.district, "pt-BR"),
    );
    const topDistrict = rankedDistricts[0] ?? null;
    const coveragePercent = summary.districts.length
      ? Math.round((summary.districtsReached / summary.districts.length) * 100)
      : 0;
    const votersPercent = summary.total ? Math.round((summary.voters / summary.total) * 100) : 0;
    const votersPerLeader = summary.leaders ? Math.round(summary.voters / summary.leaders) : 0;
    const topDistrictShare = summary.total && topDistrict
      ? Math.round((topDistrict.total / summary.total) * 100)
      : 0;
    const maxDistrictTotal = rankedDistricts[0]?.total ?? 1;

    return {
      coveredDistricts,
      emptyDistricts,
      rankedDistricts,
      topDistrict,
      coveragePercent,
      votersPercent,
      votersPerLeader,
      topDistrictShare,
      maxDistrictTotal,
    };
  }, [summary]);

  const recommendation = useMemo(() => {
    if (!summary.total) {
      return {
        label: "Primeiro passo",
        title: "Importe ou cadastre contatos",
        detail: "A visão inteligente será preenchida assim que houver contatos neste escopo.",
      };
    }
    if (!summary.leaders) {
      return {
        label: "Atenção",
        title: "Identifique lideranças na base",
        detail: "Nenhum contato está classificado como liderança. Isso dificulta distribuir e acompanhar a mobilização.",
      };
    }
    if (analytics.coveragePercent < 60 && analytics.emptyDistricts > 0) {
      return {
        label: "Prioridade territorial",
        title: `Avance sobre ${analytics.emptyDistricts.toLocaleString("pt-BR")} bairros sem cobertura`,
        detail: "Use a lista de prioridades para localizar os bairros ainda sem contatos e orientar a próxima ação de campo.",
      };
    }
    if (analytics.votersPerLeader > 250) {
      return {
        label: "Distribuição da equipe",
        title: `${analytics.votersPerLeader.toLocaleString("pt-BR")} eleitores por liderança`,
        detail: "A proporção está alta. Considere ampliar ou redistribuir as lideranças para melhorar o acompanhamento.",
      };
    }
    if (summary.meetings < summary.leaders) {
      return {
        label: "Acompanhamento",
        title: "Registre mais interações com as lideranças",
        detail: `Há ${summary.leaders.toLocaleString("pt-BR")} lideranças e ${summary.meetings.toLocaleString("pt-BR")} reuniões registradas neste escopo.`,
      };
    }
    return {
      label: "Cenário atual",
      title: "Base equilibrada para acompanhamento",
      detail: "A cobertura e a distribuição estão consistentes. Continue acompanhando bairros com menor presença.",
    };
  }, [analytics, summary]);

  const districtRows = useMemo(() => {
    if (districtView === "covered") return analytics.rankedDistricts;
    if (districtView === "all") {
      return [...summary.districts].sort((left, right) =>
        left.district.localeCompare(right.district, "pt-BR"),
      );
    }
    return [...summary.districts].sort(
      (left, right) => left.total - right.total || left.district.localeCompare(right.district, "pt-BR"),
    );
  }, [analytics.rankedDistricts, districtView, summary.districts]);

  const visibleDistricts = showAllDistricts ? districtRows : districtRows.slice(0, 12);
  const metric = (value: number) => loadingSummary ? "—" : value.toLocaleString("pt-BR");

  return (
    <main className="optimized-shell">
      <header className="optimized-topbar">
        <div className="optimized-brand-row">
          <span className="optimized-brand-mark" aria-hidden="true">VF</span>
          <div>
            <small>VOTO FORTE PARANÁ</small>
            <h1>Painel de contatos</h1>
            <p>Informações essenciais, prioridades automáticas e acesso rápido à sua base.</p>
          </div>
        </div>
        <div className="optimized-hero-controls">
          {isAdmin ? (
            <label className="optimized-scope-control">
              <span>Visualizando</span>
              <select
                value={scope}
                onChange={(event) => {
                  setPage(1);
                  setScope(event.target.value);
                }}
              >
                <option value="all">Todos os usuários</option>
                {users.map((user) => (
                  <option key={user.email} value={user.email}>{user.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="optimized-scope-badge"><span>Visualizando</span><b>{scopeName}</b></div>
          )}
          <button className="optimized-logout" onClick={() => void supabase.auth.signOut()}>Sair</button>
        </div>
      </header>

      <nav className="optimized-quick-actions" aria-label="Ações rápidas">
        <a className="primary" href="/importar-contatos">
          <span className="optimized-action-icon" aria-hidden="true">＋</span>
          <span><b>Importar contatos</b><small>Adicionar ou atualizar a base</small></span>
        </a>
        <a href="/pendencias-localizacao">
          <span className="optimized-action-icon" aria-hidden="true">!</span>
          <span><b>Pendências</b><small>Revisar dados de localização</small></span>
        </a>
        <button
          type="button"
          onClick={() => void Promise.all([loadSummary(), loadContacts()])}
          disabled={loadingSummary || loadingContacts}
        >
          <span className="optimized-action-icon" aria-hidden="true">↻</span>
          <span><b>Atualizar painel</b><small>Buscar os dados mais recentes</small></span>
        </button>
        <a className="secondary" href="/sistema-completo">
          <span className="optimized-action-icon" aria-hidden="true">⋯</span>
          <span><b>Sistema completo</b><small>Abrir todas as ferramentas</small></span>
        </a>
      </nav>

      <section className="optimized-overview" aria-busy={loadingSummary}>
        <div className="optimized-section-heading">
          <div><small>VISÃO GERAL</small><h2>{scopeName}</h2></div>
          <span>{loadingSummary ? "Atualizando indicadores…" : "Indicadores calculados sobre toda a base"}</span>
        </div>
        <div className="optimized-kpis">
          <article className="is-primary">
            <span className="optimized-kpi-label">Total da base</span>
            <b>{metric(summary.total)}</b>
            <small>contatos disponíveis neste escopo</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Eleitores</span>
            <b>{metric(summary.voters)}</b>
            <small>{loadingSummary ? "calculando…" : `${analytics.votersPercent}% dos contatos`}</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Lideranças</span>
            <b>{metric(summary.leaders)}</b>
            <small>{loadingSummary ? "calculando…" : analytics.votersPerLeader ? `${analytics.votersPerLeader.toLocaleString("pt-BR")} eleitores por liderança` : "nenhuma liderança identificada"}</small>
          </article>
          <article>
            <span className="optimized-kpi-label">Cobertura territorial</span>
            <b>{metric(summary.districtsReached)}</b>
            <small>{loadingSummary ? "calculando…" : `${analytics.coveragePercent}% dos bairros catalogados`}</small>
          </article>
        </div>
      </section>

      <section className="optimized-insights" aria-busy={loadingSummary}>
        <div className="optimized-section-heading">
          <div><small>INSIGHTS AUTOMÁTICOS</small><h2>O que merece atenção agora</h2></div>
          <span>Leitura baseada nos indicadores atuais</span>
        </div>
        <div className="optimized-insight-grid">
          <article className="optimized-insight-card is-recommendation">
            <span className="optimized-insight-label">{recommendation.label}</span>
            <h3>{loadingSummary ? "Analisando sua base…" : recommendation.title}</h3>
            <p>{loadingSummary ? "Aguarde enquanto os indicadores são calculados." : recommendation.detail}</p>
          </article>
          <article className="optimized-insight-card">
            <span className="optimized-insight-label">Maior concentração</span>
            <h3>{loadingSummary ? "—" : analytics.topDistrict?.district || "Sem bairro informado"}</h3>
            <strong>{loadingSummary ? "—" : (analytics.topDistrict?.total ?? 0).toLocaleString("pt-BR")}</strong>
            <p>{loadingSummary ? "calculando…" : `${analytics.topDistrictShare}% da base está neste bairro`}</p>
          </article>
          <article className="optimized-insight-card">
            <span className="optimized-insight-label">Bairros sem cobertura</span>
            <h3>{metric(analytics.emptyDistricts)}</h3>
            <div className="optimized-progress" aria-label={`${analytics.coveragePercent}% de cobertura`}>
              <span style={{ width: `${analytics.coveragePercent}%` }} />
            </div>
            <p>{loadingSummary ? "calculando…" : `${analytics.coveragePercent}% do território já possui contatos`}</p>
          </article>
          <article className="optimized-insight-card">
            <span className="optimized-insight-label">Reuniões registradas</span>
            <h3>{metric(summary.meetings)}</h3>
            <strong>{loadingSummary ? "—" : summary.leaders ? `${Math.round((summary.meetings / summary.leaders) * 100)}%` : "0%"}</strong>
            <p>relação entre reuniões e lideranças cadastradas</p>
          </article>
        </div>
      </section>

      <section className="optimized-content" id="lista-de-contatos">
        <article className="optimized-panel contacts-panel">
          <div className="optimized-panel-head">
            <div>
              <small>BASE DE CONTATOS</small>
              <h2>Contatos cadastrados</h2>
              <p>Exibindo {firstItem.toLocaleString("pt-BR")}–{lastItem.toLocaleString("pt-BR")} de {pageData.total.toLocaleString("pt-BR")}</p>
            </div>
            <button
              type="button"
              className="optimized-filter-toggle"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
            >
              Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
          </div>

          <div className={`optimized-filters${filtersOpen ? " is-open" : ""}`}>
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
                }}
              >
                <option value="">Todos os perfis</option>
                <option value="Eleitor">Eleitores</option>
                <option value="Liderança">Lideranças</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!activeFilterCount}>Limpar filtros</button>
          </div>

          {activeFilterCount > 0 && (
            <div className="optimized-active-filters" aria-label="Filtros ativos">
              <span>Filtros ativos:</span>
              {(queryInput.trim() || query) && <button type="button" onClick={() => { setQueryInput(""); setQuery(""); setPage(1); }}>Busca: {queryInput.trim() || query} ×</button>}
              {profile && <button type="button" onClick={() => { setProfile(""); setPage(1); }}>Perfil: {profile} ×</button>}
            </div>
          )}

          {loadingContacts ? (
            <div className="optimized-loading"><span className="optimized-spinner" />Carregando contatos…</div>
          ) : (
            <div className="optimized-table-wrap">
              <table>
                <thead>
                  <tr><th>Contato</th><th>Telefone</th><th>Perfil</th><th>Bairro</th>{isAdmin && <th>Responsável</th>}<th>Ações</th></tr>
                </thead>
                <tbody>
                  {pageData.contacts.map((contact) => {
                    const phoneNumber = contact.phone.replace(/\D/g, "");
                    return (
                      <tr key={contact.id}>
                        <td data-label="Contato" className="optimized-contact-cell">
                          <span className="optimized-avatar">{initials(contact.name)}</span>
                          <span><b>{contact.name}</b>{contact.leader && <small>Liderança: {contact.leader}</small>}</span>
                        </td>
                        <td data-label="Telefone"><a className="optimized-phone" href={`tel:${phoneNumber}`}>{contact.phone || "—"}</a></td>
                        <td data-label="Perfil"><span className={`optimized-profile-badge${contact.kind === "Liderança" ? " is-leader" : ""}`}>{contact.kind || "Eleitor"}</span></td>
                        <td data-label="Bairro">{contact.district || "—"}</td>
                        {isAdmin && <td data-label="Responsável">{contact.ownerEmail}</td>}
                        <td data-label="Ações" className="optimized-row-actions">
                          <a className="is-whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/${phoneNumber}`}>WhatsApp</a>
                          <button onClick={() => setEditing(contact)}>Editar</button>
                          <button className="danger" onClick={() => void deleteContact(contact)}>Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!pageData.contacts.length && (
                <div className="optimized-empty">
                  <b>Nenhum contato encontrado</b>
                  <p>Revise a busca ou os filtros aplicados.</p>
                  {activeFilterCount > 0 && <button className="optimized-empty-action" type="button" onClick={clearFilters}>Limpar filtros</button>}
                </div>
              )}
            </div>
          )}

          <footer className="optimized-pagination">
            <span>Mostrando {firstItem.toLocaleString("pt-BR")}–{lastItem.toLocaleString("pt-BR")} de {pageData.total.toLocaleString("pt-BR")}</span>
            <div>
              <button disabled={page <= 1 || loadingContacts} onClick={() => setPage((value) => value - 1)}>Anterior</button>
              <b>Página {pageData.page.toLocaleString("pt-BR")} de {pageData.totalPages.toLocaleString("pt-BR")}</b>
              <button disabled={page >= pageData.totalPages || loadingContacts} onClick={() => setPage((value) => value + 1)}>Próxima</button>
            </div>
          </footer>
        </article>

        <aside className="optimized-panel district-panel">
          <div className="district-panel-head">
            <small>MAPA DE COBERTURA</small>
            <h2>Bairros</h2>
            <p>Encontre rapidamente territórios sem presença ou com maior concentração.</p>
          </div>
          <div className="district-tabs" role="tablist" aria-label="Visualização dos bairros">
            <button className={districtView === "priority" ? "is-active" : ""} onClick={() => { setDistrictView("priority"); setShowAllDistricts(false); }}>Prioridades</button>
            <button className={districtView === "covered" ? "is-active" : ""} onClick={() => { setDistrictView("covered"); setShowAllDistricts(false); }}>Com contatos</button>
            <button className={districtView === "all" ? "is-active" : ""} onClick={() => { setDistrictView("all"); setShowAllDistricts(false); }}>Todos</button>
          </div>
          <ol>
            {visibleDistricts.map((item) => (
              <li key={item.district} className={item.total === 0 ? "is-empty" : undefined}>
                <span className="district-name">
                  <span>{item.district}</span>
                  <span className="district-bar"><i style={{ width: `${item.total ? Math.max((item.total / analytics.maxDistrictTotal) * 100, 4) : 0}%` }} /></span>
                </span>
                <b>{item.total.toLocaleString("pt-BR")}</b>
              </li>
            ))}
          </ol>
          {!visibleDistricts.length && <p className="optimized-empty">Nenhum bairro nesta visualização.</p>}
          {districtRows.length > 12 && (
            <button className="district-show-more" type="button" onClick={() => setShowAllDistricts((value) => !value)}>
              {showAllDistricts ? "Mostrar menos" : `Ver todos (${districtRows.length.toLocaleString("pt-BR")})`}
            </button>
          )}
        </aside>
      </section>

      {message && <div className="optimized-toast" role="status" onClick={() => setMessage("")}>{message}</div>}
      {editing && (
        <div className="optimized-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form className="optimized-modal" role="dialog" aria-modal="true" aria-label="Editar contato" onSubmit={saveContact} onMouseDown={(event) => event.stopPropagation()}>
            <header><h2>Editar contato</h2><button type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button></header>
            <label>Nome<input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label>Telefone<input required value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></label>
            <label>Perfil<select value={editing.kind || "Eleitor"} onChange={(event) => setEditing({ ...editing, kind: event.target.value as Contact["kind"] })}><option>Eleitor</option><option>Liderança</option></select></label>
            <label>Bairro<input value={editing.district || ""} onChange={(event) => setEditing({ ...editing, district: event.target.value })} /></label>
            <label>Liderança responsável<input value={editing.leader || ""} onChange={(event) => setEditing({ ...editing, leader: event.target.value })} /></label>
            <footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Salvar</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}
