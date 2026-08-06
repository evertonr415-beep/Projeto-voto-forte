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
  rural_location: "Zona rural / localidade",
};

const FILTER_CATEGORY_LABELS = Object.entries(CATEGORY_LABELS).filter(
  ([value]) => value !== "duplicate_phone",
);

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
        setUsers(
          (payload.users ?? [])
            .filter((user: { status: string }) => user.status === "active")
            .map((user: { email: string; name: string }) => ({ email: user.email, name: user.name })),
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
        setDistricts(
          (payload.districts ?? [])
            .map((item: { district: string }) => item.district)
            .filter((district: string) => district && district !== "Zona rural")
            .sort((a: string, b: string) => a.localeCompare(b, "pt-BR")),
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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar pendências");
      if (signal?.aborted) return;
      setData(payload);
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

  const allPageSelected = data.issues.length > 0
    && data.issues.every((issue) => selectedIds.has(issue.record_id));
  const canSaveRequiredFields = editName.trim().split(/\s+/).filter(Boolean).length >= 2
    && Boolean(editDistrict.trim())
    && Boolean(editStreet.trim());
  const nameReviewCount = Number(data.categoryCounts.missing_name ?? 0)
    + Number(data.categoryCounts.incomplete_name ?? 0);

  function selectCategory(value: string) {
    setCategory(value);
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
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível corrigir o cadastro.");
      closeEdit();
      setMessage("Nome, bairro e rua atualizados. O contato foi reanalisado automaticamente.");
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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir os contatos.");
      setMessage(`${Number(payload.deleted || 0).toLocaleString("pt-BR")} contato(s) excluído(s).`);
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
        <div>
          <small>CADASTRO ESSENCIAL PARA O TRABALHO DE CAMPO</small>
          <h1>Central de qualidade dos contatos</h1>
          <p>Prioriza nome completo e bairro/localidade. Rua, telefone e duplicidades ficam disponíveis na análise detalhada.</p>
        </div>
        <div className="issues-actions">
          <a href="/contatos">Voltar ao painel</a>
          {isAdmin && (
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
          )}
        </div>
      </header>

      <section className="issues-kpis">
        <article className="critical"><b>{nameReviewCount.toLocaleString("pt-BR")}</b><span>Nomes para revisar</span></article>
        <article className="warning"><b>{Number(data.categoryCounts.missing_district ?? 0).toLocaleString("pt-BR")}</b><span>Sem bairro/localidade</span></article>
        <article className="warning"><b>{Number(data.categoryCounts.location_divergence ?? 0).toLocaleString("pt-BR")}</b><span>Bairros divergentes</span></article>
        <article><b>{Number(data.categoryCounts.rural_location ?? 0).toLocaleString("pt-BR")}</b><span>Zona rural/localidade</span></article>
      </section>

      <section className="issues-panel">
        <div className="issues-toolbar">
          <div>
            <h2>Contatos para analisar</h2>
            <p>{data.total.toLocaleString("pt-BR")} registro(s) no filtro atual. Nenhuma exclusão ocorre sem confirmação.</p>
          </div>
          <div className="issues-toolbar-controls">
            <input
              aria-label="Buscar contato"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Buscar nome, telefone, bairro ou rua"
            />
            <select aria-label="Filtrar por gravidade" value={severity} onChange={(event) => selectSeverity(event.target.value)}>
              <option value="">Todas as gravidades</option>
              <option value="critical">Críticas</option>
              <option value="warning">Atenção</option>
              <option value="info">Informativas</option>
            </select>
            <select aria-label="Filtrar por categoria" value={category} onChange={(event) => selectCategory(event.target.value)}>
              <option value="">Todas as categorias</option>
              {FILTER_CATEGORY_LABELS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={clearFilters}>Limpar</button>
          </div>
        </div>

        <div className="issues-bulkbar">
          <label><input type="checkbox" checked={allPageSelected} onChange={togglePage} /> Selecionar página</label>
          <span>{selectedIds.size.toLocaleString("pt-BR")} selecionado(s)</span>
          <button className="danger" disabled={!selectedIds.size || deleting} onClick={() => void deleteSelected()}>
            {deleting ? "Excluindo…" : "Excluir selecionados"}
          </button>
        </div>

        {loading ? <div className="issues-loading">Analisando a qualidade da base…</div> : (
          <div className="issues-table-wrap">
            <table>
              <thead><tr><th></th><th>Contato</th><th>Telefone</th><th>Bairro e rua</th><th>Problemas encontrados</th><th>Gravidade</th>{isAdmin && <th>Responsável</th>}<th>Ação</th></tr></thead>
              <tbody>
                {data.issues.map((issue) => (
                  <tr key={issue.record_id}>
                    <td><input type="checkbox" checked={selectedIds.has(issue.record_id)} onChange={() => toggleIssue(issue.record_id)} aria-label={`Selecionar ${issue.contact_name || `registro ${issue.record_id}`}`} /></td>
                    <td data-label="Contato"><b>{issue.contact_name || "Sem nome"}</b><small>Registro {issue.record_id}</small></td>
                    <td data-label="Telefone">{issue.phone || "—"}</td>
                    <td data-label="Bairro e rua"><b>{issue.district_original || "Sem bairro/localidade"}</b><small>{[issue.street || "Sem rua", issue.street_number, issue.city, issue.state, issue.cep].filter(Boolean).join(" · ")}</small></td>
                    <td data-label="Problemas"><div className="issue-tags">{issue.issue_codes.map((code) => <span key={code} className={`issue-tag ${code}`}>{CATEGORY_LABELS[code] || code}</span>)}</div></td>
                    <td data-label="Gravidade"><span className={`severity-badge ${issue.severity}`}>{severityLabel(issue.severity)}</span></td>
                    {isAdmin && <td data-label="Responsável">{issue.owner_email}</td>}
                    <td data-label="Ação"><button onClick={() => startEdit(issue)}>Analisar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.issues.length && <p className="issues-empty">Nenhuma pendência neste filtro.</p>}
          </div>
        )}

        <footer className="issues-pagination">
          <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</button>
          <span>Página {data.page} de {data.totalPages}</span>
          <button disabled={page >= data.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Próxima</button>
        </footer>
      </section>

      {message && (
        <div className="issues-toast" role="status">
          <span>{message}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setMessage("")}>×</button>
        </div>
      )}
      {editing && (
        <div className="issues-modal-backdrop" onMouseDown={closeEdit}>
          <section className="issues-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><small>CADASTRO ESSENCIAL</small><h2>{editing.contact_name || "Contato sem nome"}</h2></div>
              <button aria-label="Fechar análise" disabled={saving} onClick={closeEdit}>×</button>
            </header>
            <div className="issues-review-summary">
              <p><span>Telefone</span><strong>{editing.phone || "Não informado"}</strong></p>
              <p><span>Problemas</span><strong>{editing.issue_codes.map((code) => CATEGORY_LABELS[code] || code).join(", ")}</strong></p>
            </div>
            <div className="issues-required-grid">
              <label>
                Nome completo
                <input
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
                  placeholder="Bairro, distrito ou localidade"
                />
                <datalist id="district-options">
                  {districts.map((district) => <option key={district} value={district} />)}
                </datalist>
              </label>
              <label>
                Rua onde mora
                <input
                  autoComplete="street-address"
                  value={editStreet}
                  onChange={(event) => setEditStreet(event.target.value)}
                  placeholder="Rua, avenida, estrada ou rodovia"
                />
              </label>
            </div>
            <footer>
              <button disabled={saving} onClick={closeEdit}>Fechar</button>
              <button
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