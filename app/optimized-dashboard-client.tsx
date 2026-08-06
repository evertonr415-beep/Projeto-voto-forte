"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CurrentUser } from "./dashboard-client";
import { apiFetch, supabase } from "./supabase-client";
import "./optimized-dashboard.css";

type AddressType = "urban" | "rural";
type QualityFilter = "all" | "attention" | "invalid-phone" | "incomplete";

type Contact = {
  id: number;
  ownerEmail: string;
  name: string;
  phone: string;
  phoneNormalized?: string;
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  addressType?: AddressType;
  ruralLocality?: string;
  ruralReference?: string;
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

type ContactQuality = {
  phoneDigits: string;
  phoneValid: boolean;
  missing: string[];
  needsAttention: boolean;
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

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
}

function isValidBrazilianPhone(value: string) {
  const digits = phoneDigits(value);
  if (!/^[1-9]{2}\d{8,9}$/.test(digits)) return false;
  const subscriber = digits.slice(2);
  return subscriber.length === 9
    ? subscriber.startsWith("9")
    : /^[2-5]/.test(subscriber);
}

function formatPhone(value: string) {
  const digits = phoneDigits(value);
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value.trim() || "Não informado";
}

function qualityFor(contact: Contact): ContactQuality {
  const rural = contact.addressType === "rural";
  const missing: string[] = [];
  if (!contact.name?.trim()) missing.push("nome");
  if (rural) {
    if (!contact.ruralLocality?.trim()) missing.push("localidade rural");
    if (!contact.city?.trim()) missing.push("município");
  } else {
    if (String(contact.cep || "").replace(/\D/g, "").length !== 8) missing.push("CEP");
    if (!contact.street?.trim()) missing.push("rua");
    if (!contact.number?.trim()) missing.push("número");
    if (!contact.district?.trim()) missing.push("bairro");
    if (!contact.city?.trim()) missing.push("município");
  }
  const phoneValid = isValidBrazilianPhone(contact.phone || "");
  return {
    phoneDigits: phoneDigits(contact.phone || ""),
    phoneValid,
    missing,
    needsAttention: !phoneValid || missing.length > 0,
  };
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
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [showDistricts, setShowDistricts] = useState(false);

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

  useEffect(() => { void loadSummary(); }, [loadSummary]);
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
    if (!window.confirm(`Excluir o contato ${contact.name || "sem nome"}?`)) return;
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
    const quality = qualityFor(editing);
    if (!quality.phoneValid) {
      setMessage("Confira o telefone: informe DDD e um celular ou telefone fixo válido.");
      return;
    }
    if (quality.missing.length) {
      setMessage(`Complete antes de salvar: ${quality.missing.join(", ")}.`);
      return;
    }
    const normalized = quality.phoneDigits;
    const response = await apiFetch("/api/records", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        payload: {
          ...editing,
          name: editing.name.trim(),
          phone: formatPhone(normalized),
          phoneNormalized: normalized,
          district: editing.district?.trim() || "",
          leader: editing.leader?.trim() || "",
          kind: editing.kind || "Eleitor",
          addressType: editing.addressType || "urban",
          cep: editing.addressType === "rural" ? "" : editing.cep?.trim() || "",
          street: editing.addressType === "rural" ? "" : editing.street?.trim() || "",
          number: editing.addressType === "rural" ? "" : editing.number?.trim() || "",
          city: editing.city?.trim() || "",
          state: editing.state?.trim() || "PR",
          ruralLocality:
            editing.addressType === "rural" ? editing.ruralLocality?.trim() || "" : "",
          ruralReference:
            editing.addressType === "rural" ? editing.ruralReference?.trim() || "" : "",
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Não foi possível editar o contato.");
      return;
    }
    setEditing(null);
    setMessage("Contato atualizado e validado.");
    await Promise.all([loadContacts(), loadSummary()]);
  }

  const qualityRows = useMemo(
    () => pageData.contacts.map((contact) => ({ contact, quality: qualityFor(contact) })),
    [pageData.contacts],
  );
  const visibleRows = useMemo(
    () =>
      qualityRows.filter(({ quality }) => {
        if (qualityFilter === "attention") return quality.needsAttention;
        if (qualityFilter === "invalid-phone") return !quality.phoneValid;
        if (qualityFilter === "incomplete") return quality.missing.length > 0;
        return true;
      }),
    [qualityFilter, qualityRows],
  );
  const pageIssues = useMemo(
    () => ({
      attention: qualityRows.filter(({ quality }) => quality.needsAttention).length,
      invalidPhone: qualityRows.filter(({ quality }) => !quality.phoneValid).length,
      incomplete: qualityRows.filter(({ quality }) => quality.missing.length > 0).length,
    }),
    [qualityRows],
  );

  const firstItem = pageData.total ? (pageData.page - 1) * pageData.pageSize + 1 : 0;
  const lastItem = Math.min(pageData.page * pageData.pageSize, pageData.total);
  const scopeName = useMemo(
    () =>
      scope === "all"
        ? "Todos os usuários"
        : users.find((user) => user.email === scope)?.name || currentUser.name,
    [currentUser.name, scope, users],
  );

  function beginEdit(contact: Contact) {
    setEditing({
      ...contact,
      addressType: contact.addressType || "urban",
      city: contact.city || "Arapongas",
      state: contact.state || "PR",
    });
  }

  return (
    <main className="optimized-shell">
      <header className="optimized-topbar">
        <div>
          <small>VOTO FORTE PARANÁ</small>
          <h1>Contatos</h1>
          <p>{scopeName} · encontre e corrija cadastros rapidamente</p>
        </div>
        <div className="optimized-top-actions">
          {isAdmin && (
            <select aria-label="Base de contatos" value={scope} onChange={(event) => { setPage(1); setScope(event.target.value); }}>
              <option value="all">Todos os usuários</option>
              {users.map((user) => <option key={user.email} value={user.email}>{user.name}</option>)}
            </select>
          )}
          <a href="/importar-contatos">Importar</a>
          <a href="/pendencias-localizacao">Localização</a>
          <a className="secondary" href="/sistema-completo">Menu completo</a>
          <button onClick={() => void supabase.auth.signOut()}>Sair</button>
        </div>
      </header>

      <section className="optimized-kpis compact" aria-busy={loadingSummary}>
        <article><b>{summary.total.toLocaleString("pt-BR")}</b><span>Contatos</span></article>
        <article><b>{summary.voters.toLocaleString("pt-BR")}</b><span>Eleitores</span></article>
        <article><b>{summary.leaders.toLocaleString("pt-BR")}</b><span>Lideranças</span></article>
        <article className={pageIssues.attention ? "quality-alert" : "quality-ok"}>
          <b>{pageIssues.attention}</b><span>A revisar nesta página</span>
        </article>
      </section>

      <section className="quality-toolbar" aria-label="Filtros de qualidade">
        <button className={qualityFilter === "all" ? "active" : ""} aria-pressed={qualityFilter === "all"} onClick={() => setQualityFilter("all")}>Todos <b>{qualityRows.length}</b></button>
        <button className={qualityFilter === "attention" ? "active" : ""} aria-pressed={qualityFilter === "attention"} onClick={() => setQualityFilter("attention")}>A revisar <b>{pageIssues.attention}</b></button>
        <button className={qualityFilter === "invalid-phone" ? "active" : ""} aria-pressed={qualityFilter === "invalid-phone"} onClick={() => setQualityFilter("invalid-phone")}>Telefone <b>{pageIssues.invalidPhone}</b></button>
        <button className={qualityFilter === "incomplete" ? "active" : ""} aria-pressed={qualityFilter === "incomplete"} onClick={() => setQualityFilter("incomplete")}>Informações <b>{pageIssues.incomplete}</b></button>
      </section>

      <section className="optimized-content">
        <article className="optimized-panel contacts-panel">
          <div className="optimized-panel-head">
            <div><h2>Lista de contatos</h2><p>{firstItem.toLocaleString("pt-BR")}–{lastItem.toLocaleString("pt-BR")} de {pageData.total.toLocaleString("pt-BR")}</p></div>
            <div className="optimized-filters">
              <input aria-label="Buscar contatos" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar nome, telefone, bairro…" />
              <select aria-label="Filtrar por perfil" value={profile} onChange={(event) => { setPage(1); setProfile(event.target.value); }}>
                <option value="">Todos os perfis</option><option value="Eleitor">Eleitores</option><option value="Liderança">Lideranças</option>
              </select>
            </div>
          </div>

          {loadingContacts ? <div className="optimized-loading">Carregando contatos…</div> : (
            <div className="optimized-table-wrap">
              <table>
                <thead><tr><th>Contato</th><th>Telefone</th><th>Endereço</th>{isAdmin && <th>Responsável</th>}<th>Ações</th></tr></thead>
                <tbody>{visibleRows.map(({ contact, quality }) => (
                  <tr key={contact.id} className={quality.needsAttention ? "needs-attention" : undefined}>
                    <td data-label="Contato">
                      <span className="optimized-avatar">{initials(contact.name || "")}</span>
                      <span className="contact-primary"><b>{contact.name || "Sem nome"}</b><small>{contact.kind || "Eleitor"}</small></span>
                    </td>
                    <td data-label="Telefone">
                      <span className={quality.phoneValid ? "quality-value ok" : "quality-value error"}>{formatPhone(contact.phone || "")}</span>
                      {!quality.phoneValid && <small className="quality-hint">Confira DDD e número</small>}
                    </td>
                    <td data-label="Endereço">
                      <span className="address-type">{contact.addressType === "rural" ? "Rural" : "Urbano"}</span>
                      <span>{contact.addressType === "rural" ? contact.ruralLocality || "Localidade não informada" : contact.district || "Bairro não informado"}</span>
                      {!!quality.missing.length && <small className="quality-hint">Falta: {quality.missing.join(", ")}</small>}
                    </td>
                    {isAdmin && <td data-label="Responsável"><small>{contact.ownerEmail}</small></td>}
                    <td data-label="Ações" className="optimized-row-actions">
                      {quality.phoneValid && <a target="_blank" rel="noreferrer" href={`https://wa.me/55${quality.phoneDigits}`}>WhatsApp</a>}
                      <button className={quality.needsAttention ? "primary-action" : ""} onClick={() => beginEdit(contact)}>{quality.needsAttention ? "Corrigir" : "Editar"}</button>
                      <button className="danger" onClick={() => void deleteContact(contact)}>Excluir</button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {!visibleRows.length && <p className="optimized-empty">Nenhum contato neste filtro.</p>}
            </div>
          )}

          <footer className="optimized-pagination"><button disabled={page <= 1 || loadingContacts} onClick={() => setPage((value) => value - 1)}>Anterior</button><span>Página {pageData.page.toLocaleString("pt-BR")} de {pageData.totalPages.toLocaleString("pt-BR")}</span><button disabled={page >= pageData.totalPages || loadingContacts} onClick={() => setPage((value) => value + 1)}>Próxima</button></footer>
        </article>

        <aside className={`optimized-panel district-panel ${showDistricts ? "open" : ""}`}>
          <button className="district-toggle" aria-expanded={showDistricts} onClick={() => setShowDistricts((value) => !value)}>
            <span><b>Bairros alcançados</b><small>{summary.districtsReached.toLocaleString("pt-BR")} com contatos</small></span><i>{showDistricts ? "−" : "+"}</i>
          </button>
          <ol>{summary.districts.map((item) => <li key={item.district} className={item.total === 0 ? "is-empty" : undefined}><span>{item.district}</span><b>{item.total.toLocaleString("pt-BR")}</b></li>)}</ol>
        </aside>
      </section>

      {message && <div className="optimized-toast" role="status" onClick={() => setMessage("")}>{message}</div>}
      {editing && (
        <div className="optimized-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form className="optimized-modal contact-edit-modal" onSubmit={saveContact} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><small>CORRIGIR CADASTRO</small><h2>{editing.name || "Contato"}</h2></div><button type="button" aria-label="Fechar" onClick={() => setEditing(null)}>×</button></header>
            <div className="form-section">
              <h3>Dados principais</h3>
              <label>Nome<input required value={editing.name || ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
              <label>Telefone / WhatsApp<input required inputMode="tel" value={editing.phone || ""} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} placeholder="(43) 99999-9999" /><small className={isValidBrazilianPhone(editing.phone || "") ? "field-ok" : "field-error"}>{isValidBrazilianPhone(editing.phone || "") ? "Número válido" : "Informe DDD e um número válido"}</small></label>
              <label>Perfil<select value={editing.kind || "Eleitor"} onChange={(event) => setEditing({ ...editing, kind: event.target.value as Contact["kind"] })}><option>Eleitor</option><option>Liderança</option></select></label>
            </div>
            <div className="form-section">
              <h3>Tipo de endereço</h3>
              <div className="address-type-selector">
                <button type="button" className={(editing.addressType || "urban") === "urban" ? "active" : ""} aria-pressed={(editing.addressType || "urban") === "urban"} onClick={() => setEditing({ ...editing, addressType: "urban" })}>🏙️ Urbano<small>Rua, número e bairro</small></button>
                <button type="button" className={editing.addressType === "rural" ? "active" : ""} aria-pressed={editing.addressType === "rural"} onClick={() => setEditing({ ...editing, addressType: "rural" })}>🌾 Rural<small>Localidade e referência</small></button>
              </div>
              {editing.addressType === "rural" ? (
                <>
                  <label>Localidade rural<input required value={editing.ruralLocality || ""} onChange={(event) => setEditing({ ...editing, ruralLocality: event.target.value })} placeholder="Ex.: Gleba Orle, Água do Bule" /></label>
                  <label>Ponto de referência<input value={editing.ruralReference || ""} onChange={(event) => setEditing({ ...editing, ruralReference: event.target.value })} placeholder="Estrada, km, propriedade ou referência" /></label>
                  <label>Município<input required value={editing.city || ""} onChange={(event) => setEditing({ ...editing, city: event.target.value })} /></label>
                </>
              ) : (
                <>
                  <div className="edit-grid">
                    <label>CEP<input required inputMode="numeric" value={editing.cep || ""} onChange={(event) => setEditing({ ...editing, cep: event.target.value })} placeholder="00000-000" /></label>
                    <label>Número<input required value={editing.number || ""} onChange={(event) => setEditing({ ...editing, number: event.target.value })} /></label>
                  </div>
                  <label>Rua<input required value={editing.street || ""} onChange={(event) => setEditing({ ...editing, street: event.target.value })} /></label>
                  <div className="edit-grid">
                    <label>Bairro<input required value={editing.district || ""} onChange={(event) => setEditing({ ...editing, district: event.target.value })} /></label>
                    <label>Município<input required value={editing.city || ""} onChange={(event) => setEditing({ ...editing, city: event.target.value })} /></label>
                  </div>
                </>
              )}
              <label>Liderança responsável<input value={editing.leader || ""} onChange={(event) => setEditing({ ...editing, leader: event.target.value })} placeholder="Opcional" /></label>
            </div>
            <footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary">Validar e salvar</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}
