"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../supabase-client";
import "./location-issues.css";

type CurrentUser = {
  email: string;
  name: string;
  role: string;
};

type Issue = {
  record_id: number;
  owner_email: string;
  contact_name: string;
  phone: string;
  district_original: string;
  district_key?: string | null;
  category: string;
  suggested_district?: string | null;
};

type PageData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  issues: Issue[];
};

const CATEGORY_LABELS: Record<string, string> = {
  sem_valor_util: "Sem informação útil",
  rural_localidade: "Zona rural / localidade",
  cidade_ou_nao_encontrado: "Cidade ou não encontrado",
  provavel_alias: "Correção sugerida",
  revisao_manual: "Revisão manual",
};

const EMPTY_PAGE: PageData = {
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 1,
  issues: [],
};

export default function LocationIssuesClient({ currentUser }: { currentUser: CurrentUser }) {
  const isAdmin = ["master", "gestor", "lider"].includes(currentUser.role);
  const [scope, setScope] = useState(isAdmin ? "all" : currentUser.email);
  const [users, setUsers] = useState<{ email: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [data, setData] = useState<PageData>(EMPTY_PAGE);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Issue | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch("/api/users")
      .then((response) => response.json())
      .then((payload) =>
        setUsers(
          (payload.users ?? [])
            .filter((user: { status: string }) => user.status === "active")
            .map((user: { email: string; name: string }) => ({
              email: user.email,
              name: user.name,
            })),
        ),
      )
      .catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => {
    apiFetch(`/api/contacts?mode=summary&owner=${encodeURIComponent(scope)}`)
      .then((response) => response.json())
      .then((payload) =>
        setDistricts(
          (payload.districts ?? [])
            .map((item: { district: string }) => item.district)
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, "pt-BR")),
        ),
      )
      .catch(() => undefined);
  }, [scope]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ owner: scope, page: String(page) });
      if (category) params.set("category", category);
      const response = await apiFetch(`/api/location-issues?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar pendências");
      setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar pendências");
    } finally {
      setLoading(false);
    }
  }, [category, page, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const coverage = useMemo(() => {
    const totalContacts = 112882;
    return (((totalContacts - data.total) / totalContacts) * 100).toFixed(2);
  }, [data.total]);

  function startEdit(issue: Issue) {
    setEditing(issue);
    setSelectedDistrict(issue.suggested_district || "");
  }

  async function saveDistrict() {
    if (!editing || !selectedDistrict) return;
    const response = await apiFetch("/api/records", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editing.record_id,
        payload: { district: selectedDistrict },
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Não foi possível corrigir o bairro.");
      return;
    }
    setEditing(null);
    setSelectedDistrict("");
    setMessage("Bairro corrigido. A pendência foi removida automaticamente.");
    await load();
  }

  return (
    <main className="issues-shell">
      <header className="issues-header">
        <div>
          <small>QUALIDADE DA BASE</small>
          <h1>Pendências de localização</h1>
          <p>Revisão segura de contatos cujo bairro ainda não foi reconhecido.</p>
        </div>
        <div className="issues-actions">
          <a href="/contatos">Voltar ao painel</a>
          {isAdmin && (
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value);
                setPage(1);
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
        <article><b>{data.total.toLocaleString("pt-BR")}</b><span>Pendências neste filtro</span></article>
        <article><b>{coverage}%</b><span>Cobertura estimada</span></article>
        <article><b>{districts.length.toLocaleString("pt-BR")}</b><span>Bairros disponíveis</span></article>
      </section>

      <section className="issues-panel">
        <div className="issues-toolbar">
          <div>
            <h2>Contatos para revisar</h2>
            <p>Nenhuma alteração é feita sem confirmação.</p>
          </div>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="issues-loading">Carregando pendências…</div>
        ) : (
          <div className="issues-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contato</th>
                  <th>Telefone</th>
                  <th>Valor importado</th>
                  <th>Motivo</th>
                  <th>Sugestão</th>
                  {isAdmin && <th>Responsável</th>}
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.issues.map((issue) => (
                  <tr key={issue.record_id}>
                    <td>{issue.contact_name || "Sem nome"}</td>
                    <td>{issue.phone}</td>
                    <td>{issue.district_original || "—"}</td>
                    <td><span className={`issue-tag ${issue.category}`}>{CATEGORY_LABELS[issue.category] || issue.category}</span></td>
                    <td>{issue.suggested_district || "—"}</td>
                    {isAdmin && <td>{issue.owner_email}</td>}
                    <td><button onClick={() => startEdit(issue)}>Revisar</button></td>
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

      {message && <div className="issues-toast" onClick={() => setMessage("")}>{message}</div>}

      {editing && (
        <div className="issues-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <section className="issues-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><small>CORRIGIR LOCALIZAÇÃO</small><h2>{editing.contact_name}</h2></div>
              <button onClick={() => setEditing(null)}>×</button>
            </header>
            <p>Valor importado: <strong>{editing.district_original || "sem informação"}</strong></p>
            <label>
              Bairro correto
              <select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)}>
                <option value="">Selecione um bairro</option>
                {districts.map((district) => <option key={district}>{district}</option>)}
              </select>
            </label>
            {editing.suggested_district && (
              <button className="issues-suggestion" onClick={() => setSelectedDistrict(editing.suggested_district || "")}>Usar sugestão: {editing.suggested_district}</button>
            )}
            <footer>
              <button onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary" disabled={!selectedDistrict} onClick={() => void saveDistrict()}>Salvar correção</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
