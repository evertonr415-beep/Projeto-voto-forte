"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../supabase-client";
import "./location-issues.css";

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
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  totalPages: number;
  issues: Issue[];
};

const CATEGORY_LABELS: Record<string, string> = {
  duplicate_phone: "Telefone duplicado",
  invalid_phone: "Telefone inválido",
  missing_location: "Sem localização",
  incomplete_location: "Localização incompleta",
  location_divergence: "Localização divergente",
  rural_location: "Zona rural / localidade",
};

const CATEGORY_HELP: Record<string, string> = {
  duplicate_phone: "O telefone já está associado a outro contato da base.",
  invalid_phone: "O número não possui um formato de telefone válido.",
  missing_location: "Não há bairro, cidade, rua nem CEP informado.",
  incomplete_location: "Existe alguma localização, mas faltam campos importantes.",
  location_divergence: "O bairro informado não corresponde ao catálogo reconhecido.",
  rural_location: "Contato identificado em zona rural, estrada, sítio ou localidade.",
};

const LOCATION_CODES = [
  "missing_location",
  "incomplete_location",
  "location_divergence",
];

const EMPTY_PAGE: PageData = {
  page: 1,
  pageSize: 50,
  total: 0,
  totalContacts: 0,
  totalIssues: 0,
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
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Issue | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState("");
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

  const qualityPercent = useMemo(() => {
    if (!data.totalContacts) return "0,00";
    return (((data.totalContacts - data.totalIssues) / data.totalContacts) * 100)
      .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [data.totalContacts, data.totalIssues]);

  const allPageSelected = data.issues.length > 0 && data.issues.every((issue) => selectedIds.has(issue.record_id));
  const canFixDistrict = Boolean(
    editing?.issue_codes.some((code) => LOCATION_CODES.includes(code)),
  );

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
    setSelectedDistrict("");
  }

  async function saveDistrict() {
    if (!editing || !selectedDistrict) return;
    const response = await apiFetch("/api/location-issues", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordId: editing.record_id, district: selectedDistrict }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Não foi possível corrigir o bairro.");
      return;
    }
    setEditing(null);
    setSelectedDistrict("");
    setMessage("Contato atualizado e reanalisado automaticamente.");
    await load();
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
          <small>CAMADA INTELIGENTE DE DADOS</small>
          <h1>Central de qualidade dos contatos</h1>
          <p>Duplicidades, telefones inválidos, localização incompleta, divergências e zona rural em uma única fila.</p>
        </div>
        <div className="issues-actions">
          <a href="/contatos">Voltar ao painel</a>
          {isAdmin && (
            <select aria-label="Selecionar responsável" value={scope} onChange={(event) => { setScope(event.target.value); clearFilters(); }}>
              <option value="all">Todos os usuários</option>
              {users.map((user) => <option key={user.email} value={user.email}>{user.name}</option>)}
            </select>
          )}
        </div>
      </header>

      <section className="issues-kpis">
        <article className="critical"><b>{Number(data.severityCounts.critical ?? 0).toLocaleString("pt-BR")}</b><span>Pendências críticas</span></article>
        <article className="warning"><b>{Number(data.severityCounts.warning ?? 0).toLocaleString("pt-BR")}</b><span>Precisam de atenção</span></article>
        <article className="info"><b>{Number(data.categoryCounts.rural_location ?? 0).toLocaleString("pt-BR")}</b><span>Contatos em zona rural</span></article>
        <article><b>{qualityPercent}%</b><span>Base sem pendências críticas ou de atenção</span></article>
      </section>

      <section className="issues-category-cards" aria-label="Resumo por categoria">
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <button
            key={value}
            className={category === value ? "active" : ""}
            onClick={() => selectCategory(category === value ? "" : value)}
          >
            <b>{Number(data.categoryCounts[value] ?? 0).toLocaleString("pt-BR")}</b>
            <span>{label}</span>
            <small>{CATEGORY_HELP[value]}</small>
          </button>
        ))}
      </section>

      <section className="issues-panel">
        <div className="issues-toolbar">
          <div>
            <h2>Contatos para analisar</h2>
            <p>{data.total.toLocaleString("pt-BR")} registro(s) no filtro atual. Nenhuma exclusão ocorre sem confirmação.</p>
          </div>
          <div className="issues-toolbar-controls">
            <input aria-label="Buscar contato" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar nome, telefone ou local" />
            <select aria-label="Filtrar por gravidade" value={severity} onChange={(event) => selectSeverity(event.target.value)}>
              <option value="">Todas as gravidades</option>
              <option value="critical">Críticas</option>
              <option value="warning">Atenção</option>
              <option value="info">Informativas</option>
            </select>
            <select aria-label="Filtrar por categoria" value={category} onChange={(event) => selectCategory(event.target.value)}>
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
              <thead><tr><th></th><th>Contato</th><th>Telefone</th><th>Localização</th><th>Problemas encontrados</th><th>Gravidade</th>{isAdmin && <th>Responsável</th>}<th>Ação</th></tr></thead>
              <tbody>
                {data.issues.map((issue) => (
                  <tr key={issue.record_id}>
                    <td><input type="checkbox" checked={selectedIds.has(issue.record_id)} onChange={() => toggleIssue(issue.record_id)} aria-label={`Selecionar ${issue.contact_name || `registro ${issue.record_id}`}`} /></td>
                    <td data-label="Contato"><b>{issue.contact_name || "Sem nome"}</b><small>Registro {issue.record_id}</small></td>
                    <td data-label="Telefone">{issue.phone || "—"}</td>
                    <td data-label="Localização"><b>{issue.district_original || "Sem bairro"}</b><small>{[issue.street, issue.street_number, issue.city, issue.state, issue.cep].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}</small></td>
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
        <div className="issues-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <section className="issues-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><small>ANÁLISE DO CONTATO</small><h2>{editing.contact_name || "Sem nome"}</h2></div><button aria-label="Fechar análise" onClick={() => setEditing(null)}>×</button></header>
            <div className="issues-review-summary">
              <p><span>Telefone</span><strong>{editing.phone || "Não informado"}</strong></p>
              <p><span>Bairro/localidade</span><strong>{editing.district_original || "Não informado"}</strong></p>
              <p><span>Problemas</span><strong>{editing.issue_codes.map((code) => CATEGORY_LABELS[code] || code).join(", ")}</strong></p>
            </div>
            {canFixDistrict && (
              <label>Bairro correto<select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}><option value="">Selecione um bairro</option>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
            )}
            <footer>
              <button onClick={() => setEditing(null)}>Fechar</button>
              {canFixDistrict && <button className="primary" disabled={!selectedDistrict} onClick={() => void saveDistrict()}>Salvar e reanalisar</button>}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
