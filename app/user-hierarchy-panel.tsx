"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type Role = "master" | "gestor" | "lider" | "liderado";
type Status = "active" | "blocked";
type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: Status;
  parentUserId: number | null;
  lastSeenAt: string | null;
};
type Hierarchy = {
  currentUserId: number;
  currentRole: Role;
  masterCount: number;
  canCreate: Record<Role, boolean>;
};

const labels: Record<Role, string> = {
  master: "Master",
  gestor: "Gestor",
  lider: "Líder",
  liderado: "Liderado",
};

const allowedParents: Record<Role, Role[]> = {
  master: [],
  gestor: ["master"],
  lider: ["master", "gestor"],
  liderado: ["master", "gestor", "lider"],
};

export default function UserHierarchyPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [hierarchy, setHierarchy] = useState<Hierarchy | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/users");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar equipe");
      setUsers(data.users || []);
      setHierarchy(data.hierarchy || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const detect = () => {
      const node = document.querySelector<HTMLElement>(".users-admin-grid");
      if (node && node !== target) {
        node.dataset.vfHierarchyReplaced = "true";
        setTarget(node);
        void load();
      }
    };
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    detect();
    return () => observer.disconnect();
  }, [load, target]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, User[]>();
    for (const user of users) {
      const key = user.parentUserId;
      map.set(key, [...(map.get(key) || []), user]);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [users]);

  async function updateUser(user: User, changes: Partial<Pick<User, "role" | "status" | "parentUserId">>) {
    setMessage("");
    const response = await apiFetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: user.id, ...changes }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Não foi possível atualizar o usuário.");
      return;
    }
    setMessage("Hierarquia atualizada com sucesso.");
    await load();
  }

  function renderBranch(parentId: number | null, depth = 0): React.ReactNode {
    return (childrenByParent.get(parentId) || []).map((user) => {
      const canEdit = hierarchy && user.id !== hierarchy.currentUserId && user.role !== "master";
      const parentOptions = users.filter(
        (candidate) =>
          candidate.id !== user.id &&
          candidate.status === "active" &&
          allowedParents[user.role].includes(candidate.role),
      );
      return (
        <div className="vf-hierarchy-branch" key={user.id} style={{ "--depth": depth } as React.CSSProperties}>
          <article className={`vf-hierarchy-user role-${user.role}`}>
            <div className="vf-hierarchy-avatar">{user.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</div>
            <div className="vf-hierarchy-main">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <div className="vf-hierarchy-tags">
                <span>{labels[user.role]}</span>
                <i className={user.status === "active" ? "active" : "blocked"}>{user.status === "active" ? "Ativo" : "Bloqueado"}</i>
              </div>
            </div>
            {canEdit && (
              <div className="vf-hierarchy-actions">
                <label>
                  Função
                  <select
                    value={user.role}
                    onChange={(event) => void updateUser(user, { role: event.target.value as Role })}
                  >
                    {hierarchy?.canCreate.master && <option value="master">Master</option>}
                    {hierarchy?.canCreate.gestor && <option value="gestor">Gestor</option>}
                    {hierarchy?.canCreate.lider && <option value="lider">Líder</option>}
                    {hierarchy?.canCreate.liderado && <option value="liderado">Liderado</option>}
                  </select>
                </label>
                {user.role !== "master" && (
                  <label>
                    Superior
                    <select
                      value={user.parentUserId || ""}
                      onChange={(event) => void updateUser(user, { parentUserId: Number(event.target.value) })}
                    >
                      <option value="">Selecione</option>
                      {parentOptions.map((parent) => (
                        <option value={parent.id} key={parent.id}>{parent.name} — {labels[parent.role]}</option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => void updateUser(user, { status: user.status === "active" ? "blocked" : "active" })}
                >
                  {user.status === "active" ? "Bloquear" : "Reativar"}
                </button>
              </div>
            )}
          </article>
          {renderBranch(user.id, depth + 1)}
        </div>
      );
    });
  }

  if (!target) return null;

  return createPortal(
    <section className="vf-hierarchy-panel">
      <header>
        <div>
          <small>ESTRUTURA DE ACESSO</small>
          <h3>Equipe e hierarquia</h3>
          <p>Organize quem responde a quem e controle os níveis de acesso.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      <div className="vf-hierarchy-summary">
        {(["master", "gestor", "lider", "liderado"] as Role[]).map((role) => (
          <article key={role}>
            <small>{labels[role].toUpperCase()}</small>
            <b>{users.filter((user) => user.role === role && user.status === "active").length}</b>
          </article>
        ))}
      </div>

      <div className="vf-hierarchy-help">
        <b>Como incluir uma pessoa:</b> ela cria a própria conta na tela de acesso. Depois, um Master, Gestor ou Líder autorizado define a função e o superior nesta tela.
      </div>

      {message && <div className="vf-hierarchy-message">{message}</div>}
      <div className="vf-hierarchy-tree">
        {users.length ? renderBranch(null) : !loading && <p>Nenhum usuário encontrado.</p>}
      </div>
    </section>,
    target,
  );
}
