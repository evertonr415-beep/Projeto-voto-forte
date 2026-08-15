"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type AccessRole = "adm" | "master" | "lideranca" | "liderado" | "eleitor";
type ReconciliationState = "linked" | "unconfirmed" | "pending_invitation" | "confirmed_unlinked";

type AuthAccount = {
  auth_user_id: string;
  email: string;
  display_name: string | null;
  auth_created_at: string;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  current_sessions: number;
  profile_id: number | null;
  pending_invitation: boolean;
  pending_invitation_role: string | null;
  owned_records: number;
  subject_records: number;
  audit_events: number;
  reconciliation_state: ReconciliationState;
  can_reconcile: boolean;
};

type ReconciliableAccessRole = Exclude<AccessRole, "adm">;

type ParentOption = {
  forRole: ReconciliableAccessRole;
  id: number;
  name: string;
  email: string;
  accessRole: AccessRole;
};

type AdministrationOptions = {
  currentUser: { id: number; name: string; email: string; accessRole: AccessRole };
  parentOptions: ParentOption[];
};

type ReconcileForm = {
  authUserId: string;
  name: string;
  accessRole: ReconciliableAccessRole | "";
  parentUserId: number | "";
};

const roleLabels: Record<ReconciliableAccessRole, string> = {
  master: "Master",
  lideranca: "Liderança",
  liderado: "Liderado",
  eleitor: "Eleitor",
};

const stateLabels: Record<ReconciliationState, string> = {
  linked: "Vinculada",
  unconfirmed: "E-mail não confirmado",
  pending_invitation: "Convite ativo",
  confirmed_unlinked: "Aguardando decisão do ADM",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
}

export default function AuthReconciliationEnhancer() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [accounts, setAccounts] = useState<AuthAccount[]>([]);
  const [options, setOptions] = useState<AdministrationOptions | null>(null);
  const [form, setForm] = useState<ReconcileForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let currentTarget: HTMLElement | null = null;

    const syncTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      if (nextTarget === currentTarget) return;
      currentTarget = nextTarget;
      setTarget(nextTarget);
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const response = await apiFetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível consultar as contas Auth.");
      setOptions(data.administrationOptions || null);
      setAccounts(Array.isArray(data.authAccounts) ? data.authAccounts : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar as contas Auth.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (target) void load();
  }, [target]);

  const pending = useMemo(
    () => accounts.filter((account) => account.reconciliation_state !== "linked"),
    [accounts],
  );

  const selectedAccount = form
    ? pending.find((account) => account.auth_user_id === form.authUserId) || null
    : null;
  const validParents = form?.accessRole
    ? options?.parentOptions.filter((parent) => parent.forRole === form.accessRole) || []
    : [];

  function beginReview(account: AuthAccount) {
    if (!account.can_reconcile) return;
    setForm({
      authUserId: account.auth_user_id,
      name: account.display_name?.trim() || "",
      accessRole: "",
      parentUserId: "",
    });
    setMessage("");
  }

  function changeRole(accessRole: ReconciliableAccessRole) {
    const parents = options?.parentOptions.filter((parent) => parent.forRole === accessRole) || [];
    setForm((current) =>
      current
        ? {
            ...current,
            accessRole,
            parentUserId: accessRole === "master" ? "" : parents[0]?.id ?? "",
          }
        : current,
    );
  }

  async function confirmReconciliation(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !selectedAccount) return;
    if (!form.accessRole) {
      setMessage("Selecione explicitamente o nível de acesso antes de confirmar.");
      return;
    }
    if (form.accessRole !== "master" && !form.parentUserId) {
      setMessage("Selecione o superior imediato antes de confirmar.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/users/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authUserId: form.authUserId,
          name: form.name,
          accessRole: form.accessRole,
          parentUserId: form.parentUserId || null,
          confirm: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível habilitar esta conta.");
      setMessage(`Conta ${selectedAccount.email} habilitada com sucesso.`);
      setForm(null);
      await load();
      document.querySelector<HTMLButtonElement>(".vf-hierarchy-panel > header button")?.click();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível habilitar esta conta.");
    } finally {
      setSaving(false);
    }
  }

  if (!target || options?.currentUser.accessRole !== "adm") return null;

  return createPortal(
    <section className="vf-auth-reconciliation">
      <header>
        <div>
          <small>CONTAS AUTH</small>
          <h4>Contas aguardando decisão administrativa</h4>
          <p>
            Esta área não exclui, mescla nem habilita contas automaticamente. O ADM revisa cada conta individualmente.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving}>
          {loading ? "Atualizando…" : "Atualizar contas"}
        </button>
      </header>

      {message && <div className="vf-auth-reconciliation-message" role="status">{message}</div>}

      <div className="vf-auth-reconciliation-summary">
        <span><b>{pending.length}</b> pendente(s)</span>
        <span><b>{pending.filter((item) => item.can_reconcile).length}</b> habilitável(is) pelo ADM</span>
        <span><b>{pending.filter((item) => item.reconciliation_state === "unconfirmed").length}</b> sem confirmação de e-mail</span>
      </div>

      <div className="vf-auth-account-list">
        {pending.map((account) => (
          <article key={account.auth_user_id}>
            <div className="vf-auth-account-main">
              <strong>{account.display_name || "Nome não informado"}</strong>
              <small>{account.email}</small>
              <div>
                <span className={`state-${account.reconciliation_state}`}>
                  {stateLabels[account.reconciliation_state]}
                </span>
                <em>Último login: {formatDate(account.last_sign_in_at)}</em>
              </div>
            </div>
            <dl>
              <div><dt>Sessões</dt><dd>{Number(account.current_sessions || 0)}</dd></div>
              <div><dt>Registros próprios</dt><dd>{Number(account.owned_records || 0)}</dd></div>
              <div><dt>Registros vinculados</dt><dd>{Number(account.subject_records || 0)}</dd></div>
              <div><dt>Auditoria</dt><dd>{Number(account.audit_events || 0)}</dd></div>
            </dl>
            <button
              type="button"
              disabled={!account.can_reconcile || saving}
              onClick={() => beginReview(account)}
            >
              {account.can_reconcile ? "Revisar habilitação" : "Sem ação automática"}
            </button>
          </article>
        ))}
        {!loading && !pending.length && <p>Nenhuma conta Auth pendente.</p>}
      </div>

      {form && selectedAccount && (
        <form className="vf-auth-reconcile-form" onSubmit={confirmReconciliation}>
          <div className="vf-auth-reconcile-warning">
            <b>Revisão manual obrigatória</b>
            <p>
              Você está prestes a criar um perfil Voto Forte ativo para <strong>{selectedAccount.email}</strong>. Confira nome, nível e superior antes de confirmar.
            </p>
          </div>
          <label>
            Nome no Voto Forte
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Nível de acesso
            <select
              required
              value={form.accessRole}
              onChange={(event) => changeRole(event.target.value as ReconciliableAccessRole)}
            >
              <option value="" disabled>Selecione o nível</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {form.accessRole === "master" ? (
            <div className="vf-auth-parent-note">
              <span>Superior imediato</span>
              <b>{options.currentUser.name} — ADM</b>
            </div>
          ) : form.accessRole ? (
            <label>
              Superior imediato
              <select required value={form.parentUserId} onChange={(event) => setForm({ ...form, parentUserId: Number(event.target.value) || "" })}>
                <option value="">Selecione</option>
                {validParents.map((parent) => (
                  <option key={parent.id} value={parent.id}>{parent.name} — {parent.accessRole}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="vf-auth-reconcile-actions">
            <button type="button" onClick={() => setForm(null)} disabled={saving}>Cancelar</button>
            <button
              type="submit"
              disabled={
                saving ||
                !form.name.trim() ||
                !form.accessRole ||
                (form.accessRole !== "master" && !form.parentUserId)
              }
            >
              {saving ? "Habilitando…" : "Confirmar habilitação"}
            </button>
          </div>
        </form>
      )}
    </section>,
    target,
  );
}
