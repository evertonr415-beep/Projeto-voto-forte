"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../supabase-client";
import "./location-issues.css";
import "./required-fields.css";

type CurrentUser = { email: string; name: string; role: string };
type Issue = {
  record_id: number;
  owner_email: string;
  contact_name: string;
  phone: string;
  phone_normalized: string;
  district_original: string;
  city: string;
  state: string;
  street: string;
  street_number: string;
  cep: string;
  is_rural: boolean;
  issue_codes: string[];
  severity: "critical" | "warning" | "info";
};
type PageData = {
  page: number;
  pageSize: number;
  total: number;
  totalContacts: number;
  totalIssues: number;
  requiredIncomplete: number;
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  totalPages: number;
  issues: Issue[];
};

const CATEGORY_LABELS: Record<string, string> = {
  duplicate_phone: "Telefone duplicado",
  invalid_phone: "Telefone inválido",
  missing_name: "Sem nome",
  incomplete_name: "Nome incompleto",
  missing_district: "Sem bairro/localidade",
  missing_street: "Sem rua",
  location_divergence: "Bairro divergente",
};

const FILTER_CATEGORY_KEYS = [
  "invalid_phone",
  "missing_name",
  "incomplete_name",
  "missing_district",
  "location_divergence",
  "missing_street",
] as const;

const EMPTY_PAGE: PageData = {
  page: 1,
  pageSize: 50,
  total: 0,
  totalContacts: 0,
  totalIssues: 0,
  requiredIncomplete: 0,
  categoryCounts: {},
  severityCounts: {},
  totalPages: 1,
  issues: [],
};

function severityLabel(value: Issue["severity"]) {
  if (value === "critical") return "Crítica";
  if (value === "warning") return "Atenção";
  return "Informativa";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeCounts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, count]) => [key, numberValue(count)]),
  );
}

function normalizeIssue(value: unknown): Issue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const recordId = numberValue(row.record_id);
  if (!Number.isInteger(recordId) || recordId <= 0) return null;

  const rawSeverity = stringValue(row.severity);
  const severity: Issue["severity"] = rawSeverity === "critical" || rawSeverity === "warning"
    ? rawSeverity
    : "info";

  return {
    record_id: recordId,
    owner_email: stringValue(row.owner_email),
    contact_name: stringValue(row.contact_name),
    phone: stringValue(row.phone),
    phone_normalized: stringValue(row.phone_normalized),
    district_original: stringValue(row.district_original),
    city: stringValue(row.city),
    state: stringValue(row.state),
    street: stringValue(row.street),
    street_number: stringValue(row.street_number),
    cep: stringValue(row.cep),
    is_rural: Boolean(row.is_rural),
    issue_codes: Array.isArray(row.issue_codes)
      ? row.issue_codes.filter((code): code is string => typeof code === "string")
      : [],
    severity,
  };
}

function normalizePageData(value: unknown): PageData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_PAGE;
  const payload = value as Record<string, unknown>;
  const issues = Array.isArray(payload.issues)
    ? payload.issues.map(normalizeIssue).filter((issue): issue is Issue => Boolean(issue))
    : [];

  return {
    page: Math.max(1, numberValue(payload.page, 1)),
    pageSize: Math.max(1, numberValue(payload.pageSize, 50)),
    total: Math.max(0, numberValue(payload.total)),
    totalContacts: Math.max(0, numberValue(payload.totalContacts)),
    totalIssues: Math.max(0, numberValue(payload.totalIssues)),
    requiredIncomplete: Math.max(0, numberValue(payload.requiredIncomplete)),
    categoryCounts: normalizeCounts(payload.categoryCounts),
    severityCounts: normalizeCounts(payload.severityCounts),
    totalPages: Math.max(1, numberValue(payload.totalPages, 1)),
    issues,
  };
}

function payloadError(value: unknown, fallback: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const error = (value as Record<string, unknown>).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

export default function LocationIssuesClient({ currentUser }: { currentUser: CurrentUser }) {
  const isAdmin = ["master", "gestor", "lider"].includes(currentUser.role);
  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [users, setUsers] = useState<{ email: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PageData>(EMPTY_PAGE);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Issue | null>(null);
  const [editName, setEditName] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    apiFetch("/api/users", { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        if (controller.signal.aborted) return;
        const rawUsers = payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as { users?: unknown }).users
          : [];
        setUsers(
          (Array.isArray(rawUsers) ? rawUsers : [])
            .filter(
              (user): user is { email: string; name: string; status: string } =>
                Boolean(
                  user
                  && typeof user === "object"
                  && !Array.isArray(user)
                  && typeof (user as { email?: unknown }).email === "string"
                  && typeof (user as { name?: unknown }).name === "string"
                  && typeof (user as { status?: unknown }).status === "string",
                ),
            )
            .filter((user) => user.status === "active")
            .map((user) => ({ email: user.email, name: user.name })),
        );
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error("Failed to load users", error);
      });
    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (controller.signal.aborted) return;
        const rawDistricts = payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as { districts?: unknown }).districts
          : [];
        setDistricts(
          (Array.isArray(rawDistricts) ? rawDistricts : [])
            .map((item) =>
              item && typeof item === "object" && !Array.isArray(item)
                ? stringValue((item as { district?: unknown }).district)
                : "",
            )
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "pt-BR")),
        );
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error("Failed to load districts", error);
      });
    return () => controller.abort();
  }, [scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(queryInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ owner: scope, page: String(page) });
      if (category) params.set("category", category);
      if (severity) params.set("severity", severity);
      if (query) params.set("q", query);
      const response = await apiFetch(`/api/location-issues?${params.toString()}`, { signal });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payloadError(payload, "Falha ao carregar pendências"));
      if (signal?.aborted) return;
      setData(normalizePageData(payload));
      setSelectedIds(new Set());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!signal?.aborted)
        setMessage(error instanceof Error ? error.message : "Falha ao carregar pendências");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [category, page, query, scope, severity]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      setEditing(null);
      setEditName("");
      setEditDistrict("");
      setEditStreet("");
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editing, saving]);

  const allPageSelected = data.issues.length > 0
    && data.issues.every((issue) => selectedIds.has(issue.record_id));
  const canSaveRequiredFields = editName.trim().split(/\s+/).filter(Boolean).length >= 2
    && Boolean(editDistrict.trim());
  const nameReviewCount = Number(data.categoryCounts.missing_name ?? 0)
    + Number(data.categoryCounts.incomplete_name ?? 0);
  const hasActiveFilters = Boolean(category || severity || query);

  function selectCategory(value: string) {
    setCategory(value);
    if (value === "missing_street") setSeverity("");
    setPage(1);
  }

  function selectSeverity(value: string) {
    setSeverity(value);
    setPage(1);
  }

  function toggleIssue(recordId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function togglePage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) data.issues.forEach((issue) => next.delete(issue.record_id));
      else data.issues.forEach((issue) => next.add(issue.record_id));
      return next;
    });
  }

  function startEdit(issue: Issue) {
    setMessage("");
    setEditing(issue);
    setEditName(issue.contact_name ?? "");
    setEditDistrict(issue.district_original ?? "");
    setEditStreet(issue.street ?? "");
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setEditName("");
    setEditDistrict("");
    setEditStreet("");
  }

  async function saveRequiredFields() {
    if (!editing || !canSaveRequiredFields) return;
    setSaving(true);
    try {
      const response = await apiFetch("/api/location-issues", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recordId: editing.record_id,
          name: editName,
          district: editDistrict,
          street: editStreet,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payloadError(payload, "Não foi possível corrigir o cadastro."));

      setEditing(null);
      setEditName("");
      setEditDistrict("");
      setEditStreet("");
      setMessage("Nome e bairro/localidade atualizados. A rua foi salva quando informada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar o contato.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const confirmation = window.prompt(
      `Esta ação excluirá permanentemente ${ids.length.toLocaleString("pt-BR")} contato(s). Digite EXCLUIR CONTATOS para confirmar.`,
    );
    if (confirmation !== "EXCLUIR CONTATOS") {
      setMessage("Exclusão cancelada.");
      return;
    }

    setDeleting(true);
    try {
      const response = await apiFetch("/api/location-issues", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recordIds: ids, confirmation }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payloadError(payload, "Não foi possível excluir os contatos."));
      const deleted = payload && typeof payload === "object" && !Array.isArray(payload)
        ? numberValue((payload as { deleted?: unknown }).deleted)
        : 0;
      setMessage(`${deleted.toLocaleString("pt-BR")} contato(s) excluído(s).`);
      setSelectedIds(new Set());
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na exclusão em massa");
    } finally {
      setDeleting(false);
    }
  }

  function clearFilters() {
    setCategory("");
    setSeverity("");
    setQueryInput("");
    setQuery("");
    setPage(1);
  }

  return (
    <main className="issues-shell">
      <header className="issues-header">
        <div className="issues-header-copy">
          <span className="issues-eyebrow">QUALIDADE DOS CONTATOS</span>
          <h1>Central de qualidade</h1>
          <p>
            A qualidade essencial considera telefone, nome completo e bairro/localidade.
            Rua permanece disponível como filtro complementar quando você quiser revisar esse dado.
          </p>
        </div>
        <div className="issues-actions">
          <a href="/contatos">Voltar ao painel</a>
          {isAdmin && (
            <label className="issues-scope-control">
              <span>Responsável</span>
              <select
                aria-label="Selecionar responsável"
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value);
                  clearFilters();
                }}
              >
                <option value="all">Todos os usuários</option>
                {users.map((user) => (
                  <option key={user.email} value={user.email}>{user.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <section className="issues-kpis" aria-label="Indicadores prioritários">
        <article className="critical">
          <span className="issues-kpi-label">Nomes para revisar</span>
          <b>{nameReviewCount.toLocaleString("pt-BR")}</b>
          <small>Sem nome ou com nome incompleto</small>
        </article>
        <article className="warning">
          <span className="issues-kpi-label">Sem bairro/localidade</span>
          <b>{Number(data.categoryCounts.missing_district ?? 0).toLocaleString("pt-BR")}</b>
          <small>Cadastros sem bairro ou localidade</small>
        </article>
        <article className="warning">
          <span className="issues-kpi-label">Bairros divergentes</span>
          <b>{Number(data.categoryCounts.location_divergence ?? 0).toLocaleString("pt-BR")}</b>
          <small>Cadastros fora do catálogo reconhecido</small>
        </article>
        <article className="info">
          <span className="issues-kpi-label">Telefones para revisar</span>
          <b>{Number(data.categoryCounts.invalid_phone ?? 0).toLocaleString("pt-BR")}</b>
          <small>Telefone ausente ou fora do padrão válido</small>
        </article>
      </section>

      <section className="issues-panel" aria-busy={loading}>
        <div className="issues-toolbar">
          <div className="issues-toolbar-heading">
            <span className="issues-section-label">ANÁLISE OPERACIONAL</span>
            <h2>Contatos para revisar</h2>
            <p>
              {data.total.toLocaleString("pt-BR")} registro(s) no filtro atual.
              Nenhuma exclusão ocorre sem confirmação.
            </p>
          </div>
          <div className="issues-toolbar-controls">
            <label className="issues-control issues-control-search">
              <span>Buscar</span>
              <input
                type="search"
                autoComplete="off"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Nome, telefone, bairro ou rua"
              />
            </label>
            <label className="issues-control">
              <span>Prioridade</span>
              <select
                value={severity}
                disabled={category === "missing_street"}
                onChange={(event) => selectSeverity(event.target.value)}
              >
                <option value="">Todas</option>
                <option value="critical">Críticas</option>
                <option value="warning">Atenção</option>
                <option value="info">Informativas</option>
              </select>
            </label>
            <label className="issues-control">
              <span>Categoria</span>
              <select value={category} onChange={(event) => selectCategory(event.target.value)}>
                <option value="">Pendências essenciais</option>
                {FILTER_CATEGORY_KEYS.map((value) => (
                  <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary issues-clear-button"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className={`issues-bulkbar${selectedIds.size ? " active" : ""}`}>
          <label>
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={togglePage}
              aria-label="Selecionar todos os contatos desta página"
            />
            Selecionar página
          </label>
          <span>{selectedIds.size.toLocaleString("pt-BR")} selecionado(s)</span>
          <button
            type="button"
            className="danger"
            disabled={!selectedIds.size || deleting}
            onClick={() => void deleteSelected()}
          >
            {deleting ? "Excluindo…" : "Excluir selecionados"}
          </button>
        </div>

        {loading ? (
          <div className="issues-loading" role="status" aria-live="polite">
            <span className="issues-spinner" aria-hidden="true" />
            <div>
              <b>Analisando a qualidade da base</b>
              <small>Organizando os contatos por qualidade essencial…</small>
            </div>
          </div>
        ) : data.issues.length ? (
          <div className="issues-table-wrap">
            <table>
              <thead>
                <tr>
                  <th aria-label="Seleção" />
                  <th>Contato</th>
                  <th>Telefone</th>
                  <th>Bairro e rua</th>
                  <th>Pendências</th>
                  <th>Prioridade</th>
                  {isAdmin && <th>Responsável</th>}
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.issues.map((issue) => (
                  <tr key={issue.record_id}>
                    <td className="issues-select-cell">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(issue.record_id)}
                        onChange={() => toggleIssue(issue.record_id)}
                        aria-label={`Selecionar ${issue.contact_name || `registro ${issue.record_id}`}`}
                      />
                    </td>
                    <td data-label="Contato">
                      <b>{issue.contact_name || "Sem nome"}</b>
                      <small>Registro {issue.record_id}</small>
                    </td>
                    <td data-label="Telefone">{issue.phone || "Não informado"}</td>
                    <td data-label="Bairro e rua">
                      <b>{issue.district_original || "Sem bairro/localidade"}</b>
                      <small>
                        {[issue.street || "Sem rua", issue.street_number, issue.city, issue.state, issue.cep]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </td>
                    <td data-label="Pendências">
                      <div className="issue-tags">
                        {issue.issue_codes.map((code) => (
                          <span key={code} className={`issue-tag ${code}`}>
                            {CATEGORY_LABELS[code] || code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Prioridade">
                      <span className={`severity-badge ${issue.severity}`}>
                        {severityLabel(issue.severity)}
                      </span>
                    </td>
                    {isAdmin && <td data-label="Responsável">{issue.owner_email}</td>}
                    <td data-label="Ação">
                      <button type="button" onClick={() => startEdit(issue)}>Analisar contato</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="issues-empty" role="status">
            <b>Nenhuma pendência neste filtro</b>
            <p>Altere os filtros ou volte mais tarde para conferir novos registros.</p>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters}>Limpar filtros</button>
            )}
          </div>
        )}

        {data.total > 0 && (
          <nav className="issues-pagination" aria-label="Paginação dos contatos">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </button>
            <span>Página {data.page} de {data.totalPages}</span>
            <button
              type="button"
              disabled={page >= data.totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>

      {message && (
        <div className="issues-toast" role="status" aria-live="polite">
          <span>{message}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setMessage("")}>×</button>
        </div>
      )}

      {editing && (
        <div className="issues-modal-backdrop" onMouseDown={closeEdit}>
          <section
            className="issues-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quality-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="issues-section-label">CADASTRO ESSENCIAL</span>
                <h2 id="quality-dialog-title">{editing.contact_name || "Contato sem nome"}</h2>
              </div>
              <button type="button" aria-label="Fechar análise" disabled={saving} onClick={closeEdit}>×</button>
            </header>
            <div className="issues-review-summary">
              <p><span>Telefone</span><strong>{editing.phone || "Não informado"}</strong></p>
              <p>
                <span>Pendências</span>
                <strong>{editing.issue_codes.map((code) => CATEGORY_LABELS[code] || code).join(", ")}</strong>
              </p>
            </div>
            <div className="issues-required-grid">
              <label>
                Nome completo
                <input
                  autoFocus
                  autoComplete="name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Nome e sobrenome"
                />
                <small>Informe pelo menos nome e sobrenome.</small>
              </label>
              <label>
                Bairro ou localidade
                <input
                  list="district-options"
                  value={editDistrict}
                  onChange={(event) => setEditDistrict(event.target.value)}
                  placeholder="Bairro, zona rural ou localidade"
                />
                <datalist id="district-options">
                  {districts.map((district) => <option key={district} value={district} />)}
                </datalist>
              </label>
              <label>
                Rua (opcional)
                <input
                  autoComplete="street-address"
                  value={editStreet}
                  onChange={(event) => setEditStreet(event.target.value)}
                  placeholder="Rua, avenida, estrada ou rodovia"
                />
              </label>
            </div>
            <footer>
              <button type="button" disabled={saving} onClick={closeEdit}>Cancelar</button>
              <button
                type="button"
                className="primary"
                disabled={!canSaveRequiredFields || saving}
                onClick={() => void saveRequiredFields()}
              >
                {saving ? "Salvando…" : "Salvar e reanalisar"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
