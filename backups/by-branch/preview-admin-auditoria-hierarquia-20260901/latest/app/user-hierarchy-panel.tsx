"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type AccessRole = "adm" | "gestor" | "master" | "lideranca" | "liderado" | "eleitor";
type Status = "active" | "blocked";
type SectionKey = "users" | "create" | "invitations" | "audit";

type User = {
  id: number;
  email: string;
  name: string;
  accessRole: AccessRole;
  status: Status;
  parentUserId: number | null;
  lastSeenAt: string | null;
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
  sections: { key: SectionKey; label: string }[];
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

type AuditLog = {
  id: number;
  actorEmail: string;
  action: string;
  detail: string;
  createdAt: string;
};

const labels: Record<AccessRole, string> = {
  adm: "ADM",
  gestor: "Gestor",
  master: "Master",
  lideranca: "Liderança",
  liderado: "Liderado",
  eleitor: "Eleitor",
};

const roleOrder: AccessRole[] = ["adm", "gestor", "master", "lideranca", "liderado", "eleitor"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

export default function UserHierarchyPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [options, setOptions] = useState<AdministrationOptions | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [activeSection, setActiveSection] = useState<SectionKey>("users");
  const [selectedDirectoryRole, setSelectedDirectoryRole] = useState<AccessRole>("gestor");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<{
    name: string;
    email: string;
    accessRole: AccessRole | "";
    parentUserId: number | "";
  }>({ name: "", email: "", accessRole: "", parentUserId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/users");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar Administração");
      setUsers(data.users || []);
      setOptions(data.administrationOptions || null);
      setInvitations(data.invitations || []);
      setLogs(data.logs || []);
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

  const visibleRoleOrder = useMemo(
    () =>
      options?.currentUser.accessRole === "gestor"
        ? roleOrder.filter((role) => role !== "adm")
        : roleOrder,
    [options?.currentUser.accessRole],
  );

  useEffect(() => {
    if (!visibleRoleOrder.includes(selectedDirectoryRole)) {
      setSelectedDirectoryRole("gestor");
    }
  }, [visibleRoleOrder, selectedDirectoryRole]);

  const directoryUsers = useMemo(
    () =>
      users
        .filter((user) => user.accessRole === selectedDirectoryRole)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users, selectedDirectoryRole],
  );

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
          name: form.name,
          email: form.email,
          accessRole: form.accessRole,
          parentUserId: form.parentUserId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o convite.");
      setMessage("Acesso preparado. A pessoa deve criar a conta com exatamente esse e-mail e confirmar o endereço.");
      setForm((current) => ({ ...current, name: "", email: "" }));
      await load();
      setActiveSection("invitations");
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
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  function renderDirectoryUser(user: User) {
    const canChangeStatus =
      Boolean(options?.canOpenAdministration) &&
      options?.currentUser.id !== user.id &&
      user.accessRole !== "adm" &&
      !(options?.currentUser.accessRole === "gestor" && user.accessRole === "gestor");

    return (
      <article className={`vf-hierarchy-user role-${user.accessRole}`} key={user.id}>
        <div className="vf-hierarchy-avatar">{initials(user.name)}</div>
        <div className="vf-hierarchy-main">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
          <div className="vf-hierarchy-tags">
            <span>{labels[user.accessRole]}</span>
            <i className={user.status === "active" ? "active" : "blocked"}>
              {user.status === "active" ? "Ativo" : "Bloqueado"}
            </i>
            {user.lastSeenAt && <em>Último acesso: {dateTime(user.lastSeenAt)}</em>}
          </div>
        </div>
        {canChangeStatus && (
          <button
            className="vf-access-status-button"
            type="button"
            disabled={saving}
            onClick={() => void setStatus(user)}
          >
            {user.status === "active" ? "Bloquear" : "Reativar"}
          </button>
        )}
      </article>
    );
  }

  if (!target) return null;

  const isGestorView = options?.currentUser.accessRole === "gestor";

  return createPortal(
    <section className="vf-hierarchy-panel">
      <header>
        <div>
          <small>ADMINISTRAÇÃO DE ACESSOS</small>
          <h3>Usuários, convites e hierarquia</h3>
          <p>
            {isGestorView
              ? "Gestor → Master → Liderança → Liderado → Eleitor."
              : "ADM → Gestor → Master → Liderança → Liderado → Eleitor."}
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {options?.sections?.length ? (
        <nav className="vf-access-tabs" aria-label="Opções de Administração">
          {options.sections.map((section) => (
            <button
              type="button"
              key={section.key}
              className={activeSection === section.key ? "active" : ""}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>
      ) : null}

      {message && <div className="vf-hierarchy-message" role="status">{message}</div>}

      {activeSection === "users" && (
        <>
          <div className="vf-hierarchy-summary" role="tablist" aria-label="Níveis de acesso">
            {visibleRoleOrder.map((role) => {
              const total = users.filter((user) => user.accessRole === role).length;
              const active = selectedDirectoryRole === role;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`vf-hierarchy-role-tab${active ? " active" : ""}`}
                  key={role}
                  onClick={() => setSelectedDirectoryRole(role)}
                >
                  <small>{labels[role].toUpperCase()}</small>
                  <b>{total}</b>
                  <span>{total === 1 ? "usuário" : "usuários"}</span>
                </button>
              );
            })}
          </div>

          <div className="vf-role-directory">
            <header className="vf-role-directory-header">
              <div>
                <small>NÍVEL SELECIONADO</small>
                <h4>{labels[selectedDirectoryRole]}</h4>
              </div>
              <span>{directoryUsers.length}</span>
            </header>

            <div className="vf-hierarchy-help">
              <b>{labels[selectedDirectoryRole]}:</b> toque nos cards acima para alternar entre os níveis e visualizar quem está em cada grupo.
            </div>

            <div className="vf-role-directory-list">
              {directoryUsers.length
                ? directoryUsers.map((user) => renderDirectoryUser(user))
                : !loading && <p>Nenhum usuário encontrado neste nível.</p>}
            </div>
          </div>
        </>
      )}

      {activeSection === "create" && (
        <article className="vf-access-create-card">
          <div>
            <small>NOVO ACESSO</small>
            <h4>Cadastrar acesso</h4>
            <p>Escolha o nível correto. O vínculo com o superior imediato será validado também pelo banco de dados.</p>
          </div>
          {options?.canCreateAccess && options.roleOptions.length ? (
            <form onSubmit={createAccess}>
              <label>
                Nome completo
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label>
                E-mail de acesso
                <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </label>
              <label>
                Nível de acesso
                <select required value={form.accessRole} onChange={(event) => selectRole(event.target.value as AccessRole)}>
                  {options.roleOptions.map((role) => <option value={role.value} key={role.value}>{role.label}</option>)}
                </select>
              </label>
              {selectedRole?.parentRequired ? (
                <label>
                  Superior imediato
                  <select required value={form.parentUserId} onChange={(event) => setForm({ ...form, parentUserId: Number(event.target.value) || "" })}>
                    <option value="">Selecione</option>
                    {validParents.map((parent) => (
                      <option value={parent.id} key={parent.id}>{parent.name} — {labels[parent.accessRole]}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="vf-access-parent-note">
                  <span>Superior imediato</span>
                  <b>{validParents[0]?.name || options.currentUser.name} — {labels[validParents[0]?.accessRole || options.currentUser.accessRole]}</b>
                </div>
              )}
              <button type="submit" disabled={saving || (selectedRole?.parentRequired && !validParents.length)}>
                {saving ? "Salvando..." : "Criar convite de acesso"}
              </button>
              {selectedRole?.parentRequired && !validParents.length && (
                <p className="vf-access-warning">Cadastre primeiro o nível superior necessário para poder criar este acesso.</p>
              )}
            </form>
          ) : (
            <p>Seu perfil não possui permissão para cadastrar novos acessos.</p>
          )}
          <div className="vf-access-onboarding-note">
            Depois do convite, a pessoa usa <b>exatamente o e-mail informado</b> em “Criar conta”, confirma o e-mail e o vínculo hierárquico é ativado automaticamente.
          </div>
        </article>
      )}

      {activeSection === "invitations" && (
        <article className="vf-access-list-card">
          <header><div><small>CONVITES</small><h4>Acessos preparados</h4></div><span>{invitations.length}</span></header>
          {invitations.length ? (
            <div className="vf-access-invitations">
              {invitations.map((invitation) => (
                <div key={invitation.id}>
                  <div><strong>{invitation.name}</strong><small>{invitation.email}</small></div>
                  <span>{labels[invitation.accessRole]}</span>
                  <i className={`status-${invitation.status}`}>{invitation.status === "pending" ? "Pendente" : invitation.status === "claimed" ? "Ativado" : invitation.status === "expired" ? "Expirado" : "Revogado"}</i>
                  <time>{invitation.status === "pending" ? `Expira: ${dateTime(invitation.expiresAt)}` : dateTime(invitation.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : <p>Nenhum convite cadastrado.</p>}
        </article>
      )}

      {activeSection === "audit" && (
        <article className="vf-access-list-card">
          <header><div><small>AUDITORIA</small><h4>Atividades recentes</h4></div><span>{logs.length}</span></header>
          {logs.length ? (
            <div className="vf-access-audit-list">
              {logs.slice(0, 30).map((log) => (
                <div key={log.id}>
                  <strong>{log.action}</strong>
                  <small>{log.actorEmail} · {log.detail}</small>
                  <time>{dateTime(log.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : <p>Nenhuma atividade disponível.</p>}
        </article>
      )}
    </section>,
    target,
  );
}
