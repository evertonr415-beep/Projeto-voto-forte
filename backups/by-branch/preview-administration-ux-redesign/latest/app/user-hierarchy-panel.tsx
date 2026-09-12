"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type AccessRole = "adm" | "gestor" | "master" | "lideranca" | "liderado" | "eleitor";
type DirectoryRole = Exclude<AccessRole, "eleitor">;
type Status = "active" | "blocked";
type ViewMode = "users" | "permissions";

type User = {
  id: number;
  email: string;
  name: string;
  accessRole: AccessRole;
  status: Status;
  parentUserId: number | null;
  lastSeenAt: string | null;
  municipalityIds?: number[];
};

type Municipality = {
  id: number;
  name: string;
  state: string;
  status: string;
};

type LeadershipContact = {
  id: number;
  name: string;
  phone: string;
  email: string;
  district: string;
  city: string;
  ownerEmail: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

type RoleOption = {
  value: AccessRole;
  label: string;
  parentRole: AccessRole;
  parentRequired: boolean;
};

type ParentOption = {
  forRole: AccessRole;
  id: number;
  name: string;
  email: string;
  accessRole: AccessRole;
};

type AdministrationOptions = {
  currentUser: { id: number; name: string; email: string; accessRole: AccessRole };
  canOpenAdministration: boolean;
  canCreateAccess: boolean;
  roleOptions: RoleOption[];
  parentOptions: ParentOption[];
};

type Invitation = {
  id: number;
  email: string;
  name: string;
  accessRole: AccessRole;
  parentUserId: number;
  status: "pending" | "claimed" | "expired" | "revoked";
  expiresAt: string;
  createdAt: string;
};

type EditTarget =
  | { type: "user"; user: User }
  | { type: "contact"; contact: LeadershipContact }
  | null;

const labels: Record<AccessRole, string> = {
  adm: "ADM",
  gestor: "Gestor",
  master: "Master",
  lideranca: "Liderança",
  liderado: "Liderado",
  eleitor: "Eleitor",
};

const allDirectoryRoles: DirectoryRole[] = ["adm", "gestor", "master", "lideranca", "liderado"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "VF";
}

function dateTime(value?: string | null) {
  if (!value) return "Ainda não acessou";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Ainda não acessou" : date.toLocaleString("pt-BR");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export default function UserHierarchyPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leadershipContacts, setLeadershipContacts] = useState<LeadershipContact[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [options, setOptions] = useState<AdministrationOptions | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("users");
  const [roleFilter, setRoleFilter] = useState<"all" | DirectoryRole>("all");
  const [query, setQuery] = useState("");
  const [permissionQuery, setPermissionQuery] = useState("");
  const [municipalityQuery, setMunicipalityQuery] = useState("");
  const [permissionDrafts, setPermissionDrafts] = useState<Record<number, number[]>>({});
  const [selectedGestorId, setSelectedGestorId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [form, setForm] = useState<{
    name: string;
    email: string;
    accessRole: AccessRole | "";
    parentUserId: number | "";
  }>({ name: "", email: "", accessRole: "", parentUserId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, leadershipResponse] = await Promise.all([
        apiFetch("/api/users", { cache: "no-store" }),
        apiFetch("/api/administration/role-directory?role=lideranca&limit=250", { cache: "no-store" }),
      ]);
      const usersData = await usersResponse.json();
      if (!usersResponse.ok) throw new Error(usersData.error || "Falha ao carregar Administração");

      const nextUsers = Array.isArray(usersData.users) ? usersData.users as User[] : [];
      setUsers(nextUsers);
      setOptions(usersData.administrationOptions || null);
      setInvitations(Array.isArray(usersData.invitations) ? usersData.invitations : []);
      setMunicipalities(Array.isArray(usersData.municipalities) ? usersData.municipalities : []);
      setPermissionDrafts(Object.fromEntries(nextUsers.map((user) => [
        user.id,
        Array.from(new Set((user.municipalityIds || []).map(Number))).filter(Boolean),
      ])));

      if (leadershipResponse.ok) {
        const leadershipData = await leadershipResponse.json();
        setLeadershipContacts(Array.isArray(leadershipData.items) ? leadershipData.items : []);
      } else {
        setLeadershipContacts([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a Administração.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let currentTarget: HTMLElement | null = null;
    const detect = () => {
      const nextTarget = document.querySelector<HTMLElement>(".users-admin-grid");
      if (nextTarget === currentTarget) return;
      currentTarget = nextTarget;
      setTarget(nextTarget);
      if (!nextTarget) return;
      nextTarget.dataset.vfHierarchyReplaced = "true";
      void load();
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [load]);

  useEffect(() => {
    if (!options?.roleOptions.length || form.accessRole) return;
    const first = options.roleOptions[0];
    const parents = options.parentOptions.filter((parent) => parent.forRole === first.value);
    setForm((current) => ({
      ...current,
      accessRole: first.value,
      parentUserId: first.parentRequired ? parents[0]?.id ?? "" : "",
    }));
  }, [options, form.accessRole]);

  const currentRole = options?.currentUser.accessRole;
  const canEditPermissions = currentRole === "adm";
  const visibleRoles = useMemo(
    () => allDirectoryRoles.filter((role) => currentRole === "adm" || role !== "adm"),
    [currentRole],
  );

  useEffect(() => {
    if (!canEditPermissions && viewMode === "permissions") setViewMode("users");
  }, [canEditPermissions, viewMode]);

  const roleTotals = useMemo(() => {
    const totals: Record<DirectoryRole, number> = { adm: 0, gestor: 0, master: 0, lideranca: 0, liderado: 0 };
    for (const user of users) {
      if (user.accessRole !== "eleitor") totals[user.accessRole] += 1;
    }
    totals.lideranca += leadershipContacts.length;
    return totals;
  }, [leadershipContacts.length, users]);

  const pendingInvitations = useMemo(
    () => invitations.filter((item) => item.status === "pending"),
    [invitations],
  );

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === "active"),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const q = normalize(query);
    return users
      .filter((user) => user.accessRole !== "eleitor")
      .filter((user) => roleFilter === "all" || user.accessRole === roleFilter)
      .filter((user) => !q || normalize(`${user.name} ${user.email} ${labels[user.accessRole]}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [query, roleFilter, users]);

  const filteredLeadershipContacts = useMemo(() => {
    if (roleFilter !== "all" && roleFilter !== "lideranca") return [];
    const q = normalize(query);
    return leadershipContacts
      .filter((contact) => !q || normalize(`${contact.name} ${contact.phone} ${contact.email} ${contact.district}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [leadershipContacts, query, roleFilter]);

  const gestorUsers = useMemo(() => {
    const q = normalize(permissionQuery);
    return users
      .filter((user) => user.accessRole === "gestor" && user.status === "active")
      .filter((user) => !q || normalize(`${user.name} ${user.email}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [permissionQuery, users]);

  const selectedGestor = useMemo(
    () => users.find((user) => user.id === selectedGestorId && user.accessRole === "gestor") || null,
    [selectedGestorId, users],
  );

  const sortedMunicipalities = useMemo(
    () => municipalities.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [municipalities],
  );

  const filteredMunicipalities = useMemo(() => {
    const q = normalize(municipalityQuery);
    return sortedMunicipalities.filter((item) => !q || normalize(`${item.name} ${item.state}`).includes(q));
  }, [municipalityQuery, sortedMunicipalities]);

  const selectedRole = options?.roleOptions.find((role) => role.value === form.accessRole);
  const validParents = options?.parentOptions.filter((parent) => parent.forRole === form.accessRole) || [];

  function selectRole(value: AccessRole) {
    const role = options?.roleOptions.find((item) => item.value === value);
    const parents = options?.parentOptions.filter((parent) => parent.forRole === value) || [];
    setForm((current) => ({
      ...current,
      accessRole: value,
      parentUserId: role?.parentRequired ? parents[0]?.id ?? "" : "",
    }));
  }

  function canManageDirectoryUser(user: User) {
    if (!options?.canOpenAdministration) return false;
    const actor = options.currentUser;
    if (actor.accessRole === "adm") return actor.id !== user.id;
    if (actor.accessRole === "gestor") {
      return !["adm", "gestor"].includes(user.accessRole) && actor.id !== user.id;
    }
    return false;
  }

  async function createAccess(event: React.FormEvent) {
    event.preventDefault();
    if (!form.accessRole) return;
    if (selectedRole?.parentRequired && !form.parentUserId) {
      setMessage("Selecione o superior imediato para esse nível de acesso.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          accessRole: form.accessRole,
          parentUserId: form.parentUserId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o convite.");
      setMessage("Convite de acesso criado com sucesso.");
      setForm((current) => ({ ...current, name: "", email: "" }));
      setShowCreate(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(user: User) {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, status: user.status === "active" ? "blocked" : "active" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível alterar o acesso.");
      setMessage(user.status === "active" ? "Acesso bloqueado." : "Acesso reativado.");
      setOpenActionsId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  function startUserEdit(user: User) {
    setEditTarget({ type: "user", user });
    setEditName(user.name);
    setEditPhone("");
    setEditDistrict("");
    setOpenActionsId(null);
  }

  function startContactEdit(contact: LeadershipContact) {
    setEditTarget({ type: "contact", contact });
    setEditName(contact.name);
    setEditPhone(contact.phone);
    setEditDistrict(contact.district);
    setOpenActionsId(null);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      if (editTarget.type === "user") {
        const response = await apiFetch("/api/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: editTarget.user.id, action: "edit", name: editName.trim() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível editar o usuário.");
        setMessage("Usuário atualizado com sucesso.");
      } else {
        const contact = editTarget.contact;
        const payload = {
          ...contact.payload,
          name: editName.trim(),
          phone: editPhone.trim(),
          district: editDistrict.trim(),
          kind: "Liderança",
        };
        const response = await apiFetch("/api/records", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: contact.id, payload }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível editar a liderança.");
        setMessage("Liderança atualizada com sucesso.");
      }
      setEditTarget(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a alteração.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user: User) {
    if (!window.confirm(`Excluir o acesso de ${user.name}? O histórico será preservado.`)) return;
    setSaving(true);
    try {
      const response = await apiFetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, action: "remove" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir o acesso.");
      setMessage("Acesso removido. O histórico foi preservado.");
      setOpenActionsId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir o acesso.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLeadershipContact(contact: LeadershipContact) {
    if (!window.confirm(`Excluir a liderança ${contact.name} da base de contatos?`)) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/api/records?id=${contact.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir a liderança.");
      setMessage("Liderança excluída da base de contatos.");
      setOpenActionsId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível excluir a liderança.");
    } finally {
      setSaving(false);
    }
  }

  function toggleMunicipality(userId: number, municipalityId: number) {
    setPermissionDrafts((current) => {
      const selected = new Set(current[userId] || []);
      if (selected.has(municipalityId)) selected.delete(municipalityId);
      else selected.add(municipalityId);
      return { ...current, [userId]: Array.from(selected) };
    });
  }

  async function saveMunicipalities(user: User) {
    const municipalityIds = permissionDrafts[user.id] || [];
    if (!municipalityIds.length) {
      setMessage(`Selecione pelo menos um município para ${user.name}.`);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, municipalityIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar os municípios.");
      setMessage(`Permissões territoriais de ${user.name} atualizadas.`);
      setSelectedGestorId(null);
      setMunicipalityQuery("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar os municípios.");
    } finally {
      setSaving(false);
    }
  }

  function municipalityNames(user: User) {
    const ids = new Set(permissionDrafts[user.id] || user.municipalityIds || []);
    return sortedMunicipalities.filter((item) => ids.has(item.id)).map((item) => item.name);
  }

  if (!target) return null;

  const userEntriesTotal = filteredUsers.length + filteredLeadershipContacts.length;

  return createPortal(
    <>
      <section className="vf-access-workspace" aria-label="Gestão de usuários e permissões">
        <header className="vf-access-workspace-head">
          <div>
            <small>GESTÃO DE ACESSOS</small>
            <h3>Equipe e permissões</h3>
            <p>Controle quem entra no sistema, a hierarquia e o alcance territorial de cada perfil.</p>
          </div>
          <div className="vf-access-head-actions">
            <button type="button" className="secondary" onClick={() => void load()} disabled={loading}>
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
            {options?.canCreateAccess ? (
              <button type="button" className="primary" onClick={() => setShowCreate(true)}>
                + Novo acesso
              </button>
            ) : null}
          </div>
        </header>

        <div className="vf-access-kpi-strip" aria-label="Resumo de acessos">
          <span><b>{activeUsers.length}</b> ativos</span>
          <button type="button" onClick={() => setShowInvitations(true)}><b>{pendingInvitations.length}</b> convites</button>
          <span><b>{roleTotals.gestor}</b> gestores</span>
        </div>

        {message ? <div className="vf-access-message" role="status">{message}</div> : null}

        <nav className="vf-access-mode-tabs" aria-label="Área de gestão de acessos">
          <button type="button" className={viewMode === "users" ? "active" : ""} onClick={() => setViewMode("users")}>Usuários</button>
          {canEditPermissions ? (
            <button type="button" className={viewMode === "permissions" ? "active" : ""} onClick={() => setViewMode("permissions")}>Permissões territoriais</button>
          ) : null}
        </nav>

        {viewMode === "users" ? (
          <section className="vf-access-users-view">
            <div className="vf-access-toolbar">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou e-mail" aria-label="Buscar usuários" />
              <div className="vf-access-role-filters" role="tablist" aria-label="Filtrar por nível">
                <button type="button" className={roleFilter === "all" ? "active" : ""} onClick={() => setRoleFilter("all")}>Todos <b>{users.filter((user) => user.accessRole !== "eleitor").length + leadershipContacts.length}</b></button>
                {visibleRoles.map((role) => (
                  <button type="button" key={role} className={roleFilter === role ? "active" : ""} onClick={() => setRoleFilter(role)}>{labels[role]} <b>{roleTotals[role]}</b></button>
                ))}
              </div>
            </div>

            {pendingInvitations.length ? (
              <button type="button" className="vf-access-invitation-banner" onClick={() => setShowInvitations(true)}>
                <span><b>{pendingInvitations.length}</b> convite{pendingInvitations.length === 1 ? "" : "s"} aguardando ativação</span>
                <em>Ver convites →</em>
              </button>
            ) : null}

            <div className="vf-access-directory-list">
              {filteredUsers.map((user) => {
                const key = `user-${user.id}`;
                const manageable = canManageDirectoryUser(user);
                return (
                  <article className={`vf-access-person role-${user.accessRole}`} key={key}>
                    <div className="vf-access-avatar">{initials(user.name)}</div>
                    <div className="vf-access-person-main">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                      <div className="vf-access-person-meta">
                        <span>{labels[user.accessRole]}</span>
                        <i className={user.status === "active" ? "active" : "blocked"}>{user.status === "active" ? "Ativo" : "Bloqueado"}</i>
                        <em>{dateTime(user.lastSeenAt)}</em>
                      </div>
                    </div>
                    {manageable ? (
                      <div className="vf-access-person-menu">
                        <button type="button" aria-label={`Gerenciar ${user.name}`} onClick={() => setOpenActionsId((current) => current === key ? null : key)}>•••</button>
                        {openActionsId === key ? (
                          <div className="vf-access-action-popover">
                            <button type="button" onClick={() => startUserEdit(user)}>Editar nome</button>
                            <button type="button" onClick={() => void setStatus(user)}>{user.status === "active" ? "Bloquear acesso" : "Reativar acesso"}</button>
                            <button type="button" className="danger" onClick={() => void removeUser(user)}>Excluir acesso</button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {filteredLeadershipContacts.map((contact) => {
                const key = `contact-${contact.id}`;
                return (
                  <article className="vf-access-person role-lideranca" key={key}>
                    <div className="vf-access-avatar">{initials(contact.name)}</div>
                    <div className="vf-access-person-main">
                      <strong>{contact.name}</strong>
                      <small>{contact.phone || contact.email || "Sem telefone"}{contact.district ? ` · ${contact.district}` : ""}</small>
                      <div className="vf-access-person-meta"><span>Liderança</span><i className="registered">Cadastro</i>{contact.ownerEmail ? <em>Responsável: {contact.ownerEmail}</em> : null}</div>
                    </div>
                    <div className="vf-access-person-menu">
                      <button type="button" aria-label={`Gerenciar ${contact.name}`} onClick={() => setOpenActionsId((current) => current === key ? null : key)}>•••</button>
                      {openActionsId === key ? (
                        <div className="vf-access-action-popover">
                          <button type="button" onClick={() => startContactEdit(contact)}>Editar cadastro</button>
                          <button type="button" className="danger" onClick={() => void removeLeadershipContact(contact)}>Excluir cadastro</button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {!userEntriesTotal && !loading ? <p className="vf-access-empty">Nenhuma pessoa encontrada com estes filtros.</p> : null}
            </div>
          </section>
        ) : (
          <section className="vf-access-permissions-view">
            <header>
              <div><small>PERMISSÕES TERRITORIAIS</small><h4>Gestores multimunicipais</h4><p>Defina somente os municípios que cada Gestor poderá visualizar e alternar.</p></div>
              <span>{gestorUsers.length}</span>
            </header>
            <input className="vf-access-permission-search" value={permissionQuery} onChange={(event) => setPermissionQuery(event.target.value)} placeholder="Buscar Gestor" aria-label="Buscar Gestor" />
            <div className="vf-access-permission-list">
              {gestorUsers.map((user) => {
                const names = municipalityNames(user);
                return (
                  <article key={user.id}>
                    <div className="vf-access-avatar">{initials(user.name)}</div>
                    <div className="vf-access-permission-main">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                      <div className="vf-access-municipality-preview">
                        {names.slice(0, 3).map((name) => <span key={name}>{name}</span>)}
                        {names.length > 3 ? <span>+{names.length - 3}</span> : null}
                        {!names.length ? <em>Nenhum município definido</em> : null}
                      </div>
                    </div>
                    <button type="button" className="vf-access-manage-permissions" onClick={() => { setSelectedGestorId(user.id); setMunicipalityQuery(""); }}>Gerenciar <b>{names.length}</b></button>
                  </article>
                );
              })}
              {!gestorUsers.length ? <p className="vf-access-empty">Nenhum Gestor ativo encontrado.</p> : null}
            </div>
          </section>
        )}
      </section>

      {showCreate && createPortal(
        <div className="vf-access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowCreate(false); }}>
          <form className="vf-access-modal vf-access-create-modal" onSubmit={createAccess}>
            <header><div><small>NOVO ACESSO</small><h3>Cadastrar acesso</h3><p>Defina o perfil e o superior imediato. O vínculo será validado pelo sistema.</p></div><button type="button" onClick={() => setShowCreate(false)} disabled={saving}>×</button></header>
            <label>Nome completo<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>E-mail de acesso<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Nível de acesso<select required value={form.accessRole} onChange={(event) => selectRole(event.target.value as AccessRole)}>{options?.roleOptions.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}</select></label>
            {selectedRole?.parentRequired ? (
              <label>Superior imediato<select required value={form.parentUserId} onChange={(event) => setForm({ ...form, parentUserId: Number(event.target.value) || "" })}><option value="">Selecione</option>{validParents.map((parent) => <option value={parent.id} key={parent.id}>{parent.name} — {labels[parent.accessRole]}</option>)}</select></label>
            ) : (
              <div className="vf-access-parent-summary"><span>Superior imediato</span><b>{validParents[0]?.name || options?.currentUser.name || "ADM"}</b></div>
            )}
            {selectedRole?.parentRequired && !validParents.length ? <p className="vf-access-modal-warning">Cadastre primeiro o nível superior necessário.</p> : null}
            <footer><button type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving || (selectedRole?.parentRequired && !validParents.length)}>{saving ? "Salvando…" : "Criar convite"}</button></footer>
          </form>
        </div>,
        document.body,
      )}

      {showInvitations && createPortal(
        <div className="vf-access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInvitations(false); }}>
          <section className="vf-access-modal vf-access-invitations-modal">
            <header><div><small>CONVITES</small><h3>Acessos preparados</h3><p>Acompanhe quem ainda precisa concluir a ativação do acesso.</p></div><button type="button" onClick={() => setShowInvitations(false)}>×</button></header>
            <div className="vf-access-invitations-list">
              {invitations.length ? invitations.map((invitation) => (
                <article key={invitation.id}><div><strong>{invitation.name}</strong><small>{invitation.email}</small></div><span>{labels[invitation.accessRole]}</span><i className={`status-${invitation.status}`}>{invitation.status === "pending" ? "Pendente" : invitation.status === "claimed" ? "Ativado" : invitation.status === "expired" ? "Expirado" : "Revogado"}</i><time>{invitation.status === "pending" ? `Expira: ${dateTime(invitation.expiresAt)}` : dateTime(invitation.createdAt)}</time></article>
              )) : <p className="vf-access-empty">Nenhum convite cadastrado.</p>}
            </div>
          </section>
        </div>,
        document.body,
      )}

      {selectedGestor && createPortal(
        <div className="vf-access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelectedGestorId(null); }}>
          <section className="vf-access-modal vf-access-permissions-modal">
            <header><div><small>PERMISSÕES TERRITORIAIS</small><h3>{selectedGestor.name}</h3><p>{selectedGestor.email}</p></div><button type="button" onClick={() => setSelectedGestorId(null)} disabled={saving}>×</button></header>
            <div className="vf-access-permission-count"><b>{(permissionDrafts[selectedGestor.id] || []).length}</b> município{(permissionDrafts[selectedGestor.id] || []).length === 1 ? "" : "s"} selecionado{(permissionDrafts[selectedGestor.id] || []).length === 1 ? "" : "s"}</div>
            <input className="vf-access-permission-search" value={municipalityQuery} onChange={(event) => setMunicipalityQuery(event.target.value)} placeholder="Buscar município" aria-label="Buscar município" />
            <div className="vf-access-municipality-checks">
              {filteredMunicipalities.map((municipality) => (
                <label key={municipality.id}><input type="checkbox" checked={(permissionDrafts[selectedGestor.id] || []).includes(municipality.id)} onChange={() => toggleMunicipality(selectedGestor.id, municipality.id)} /><span><b>{municipality.name}</b><small>{municipality.state}</small></span></label>
              ))}
            </div>
            <footer><button type="button" onClick={() => setSelectedGestorId(null)} disabled={saving}>Cancelar</button><button type="button" className="primary" onClick={() => void saveMunicipalities(selectedGestor)} disabled={saving}>{saving ? "Salvando…" : "Salvar permissões"}</button></footer>
          </section>
        </div>,
        document.body,
      )}

      {editTarget && createPortal(
        <div className="vf-access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditTarget(null); }}>
          <form className="vf-access-modal vf-access-edit-modal" onSubmit={saveEdit}>
            <header><div><small>EDITAR</small><h3>{editTarget.type === "user" ? "Usuário" : "Liderança"}</h3></div><button type="button" onClick={() => setEditTarget(null)} disabled={saving}>×</button></header>
            <label>Nome<input required value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus /></label>
            {editTarget.type === "contact" ? <><label>Telefone / WhatsApp<input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></label><label>Bairro<input value={editDistrict} onChange={(event) => setEditDistrict(event.target.value)} /></label></> : <p className="vf-access-edit-note">O e-mail e o nível de acesso permanecem protegidos nesta edição.</p>}
            <footer><button type="button" onClick={() => setEditTarget(null)} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button></footer>
          </form>
        </div>,
        document.body,
      )}
    </>,
    target,
  );
}
