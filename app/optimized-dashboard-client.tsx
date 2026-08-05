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
  const isAdmin = currentUser.role === "master" || currentUser.role === "admin";
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
    const response = await apiFetch(`/api/records?id=${contact.id}`, {
      method: "DELETE",
    });
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
    await loadContacts();
  }

  const firstItem = pageData.total ? (pageData.page - 1) * pageData.pageSize + 1 : 0;
  const lastItem = Math.min(pageData.page * pageData.pageSize, pageData.total);
  const scopeName = useMemo(
    () =>
      scope === "all"
        ? "Todos os usuários"
        : users.find((user) => user.email === scope)?.name || currentUser.name,
    [currentUser.name, scope, users],
  );

  return (
    <main className="optimized-shell">
      <header className="optimized-topbar">
        <div>
          <small>VOTO FORTE PARANÁ · BASE OTIMIZADA</small>
          <h1>Painel de contatos</h1>
          <p>{scopeName} · dados completos, carregamento paginado</p>
        </div>
        <div className="optimized-top-actions">
          {isAdmin && (
            <select
              value={scope}
              onChange={(event) => {
                setPage(1);
                setScope(event.target.value);
              }}
            >
              <option value="all">Todos os usuários</option>
              {users.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.name}
                </option>
              ))}
            </select>
          )}
          <a href="/importar-contatos">Importar contatos</a>
          <a className="secondary" href="/sistema-completo">
            Sistema completo
          </a>
          <button onClick={() => void supabase.auth.signOut()}>Sair</button>
        </div>
      </header>

      <section className="optimized-kpis" aria-busy={loadingSummary}>
        <article><b>{summary.total.toLocaleString("pt-BR")}</b><span>Contatos totais</span></article>
        <article><b>{summary.voters.toLocaleString("pt-BR")}</b><span>Eleitores</span></article>
        <article><b>{summary.leaders.toLocaleString("pt-BR")}</b><span>Lideranças</span></article>
        <article><b>{summary.districtsReached.toLocaleString("pt-BR")}</b><span>Bairros alcançados</span></article>
        <article><b>{summary.meetings.toLocaleString("pt-BR")}</b><span>Reuniões</span></article>
      </section>

      <section className="optimized-content">
        <article className="optimized-panel contacts-panel">
          <div className="optimized-panel-head">
            <div>
              <h2>Contatos cadastrados</h2>
              <p>
                Exibindo {firstItem.toLocaleString("pt-BR")}–{lastItem.toLocaleString("pt-BR")} de {pageData.total.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="optimized-filters">
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Buscar nome, telefone, bairro ou responsável"
              />
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
            </div>
          </div>

          {loadingContacts ? (
            <div className="optimized-loading">Carregando página…</div>
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
                      <td><span className="optimized-avatar">{initials(contact.name)}</span><b>{contact.name}</b></td>
                      <td>{contact.phone}</td>
                      <td>{contact.kind || "Eleitor"}</td>
                      <td>{contact.district || "—"}</td>
                      {isAdmin && <td>{contact.ownerEmail}</td>}
                      <td className="optimized-row-actions">
                        <a target="_blank" rel="noreferrer" href={`https://wa.me/${contact.phone.replace(/\D/g, "")}`}>WhatsApp</a>
                        <button onClick={() => setEditing(contact)}>Editar</button>
                        <button className="danger" onClick={() => void deleteContact(contact)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pageData.contacts.length && <p className="optimized-empty">Nenhum contato encontrado.</p>}
            </div>
          )}

          <footer className="optimized-pagination">
            <button disabled={page <= 1 || loadingContacts} onClick={() => setPage((value) => value - 1)}>Anterior</button>
            <span>Página {pageData.page.toLocaleString("pt-BR")} de {pageData.totalPages.toLocaleString("pt-BR")}</span>
            <button disabled={page >= pageData.totalPages || loadingContacts} onClick={() => setPage((value) => value + 1)}>Próxima</button>
          </footer>
        </article>

        <aside className="optimized-panel district-panel">
          <h2>Bairros com mais contatos</h2>
          <p>Resumo calculado sobre toda a base.</p>
          <ol>
            {summary.districts.slice(0, 15).map((item) => (
              <li key={item.district}><span>{item.district}</span><b>{item.total.toLocaleString("pt-BR")}</b></li>
            ))}
          </ol>
        </aside>
      </section>

      {message && <div className="optimized-toast" onClick={() => setMessage("")}>{message}</div>}

      {editing && (
        <div className="optimized-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form className="optimized-modal" onSubmit={saveContact} onMouseDown={(event) => event.stopPropagation()}>
            <header><h2>Editar contato</h2><button type="button" onClick={() => setEditing(null)}>×</button></header>
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
