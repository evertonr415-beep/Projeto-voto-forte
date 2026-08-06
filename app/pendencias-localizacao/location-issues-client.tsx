"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../supabase-client";
import "./location-issues.css";

type CurrentUser = { email: string; name: string; role: string };

const CATEGORY_LABELS: Record<string, string> = {
  duplicate_phone: "Telefone duplicado",
  invalid_phone: "Telefone inválido",
  missing_name: "Sem nome completo",
  incomplete_name: "Nome incompleto",
  missing_district: "Sem bairro",
  missing_street: "Sem rua",
  location_divergence: "Bairro divergente",
  rural_location: "Zona rural / localidade",
};

const CATEGORY_HELP: Record<string, string> = {
  missing_name: "Contato sem nome informado.",
  incomplete_name: "Nome precisa ter nome e sobrenome.",
  missing_district: "Bairro ou localidade não informado.",
  missing_street: "Rua de residência não informada.",
};

export default function LocationIssuesClient({ currentUser }: { currentUser: CurrentUser }) {
  const [data, setData] = useState<any>({ categoryCounts: {}, severityCounts: {}, issues: [], totalPages: 1, page: 1, total: 0 });
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [street, setStreet] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), owner: "all" });
    if (category) params.set("category", category);
    const response = await apiFetch(`/api/location-issues?${params}`);
    const payload = await response.json();
    setData(payload);
    setLoading(false);
  }, [category, page]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!editing) return;
    const response = await apiFetch("/api/location-issues", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordId: editing.record_id, name, district, street }),
    });
    if (response.ok) {
      setEditing(null);
      await load();
    }
  }

  return <main className="issues-shell">
    <header className="issues-header">
      <div><small>CAMADA INTELIGENTE DE DADOS</small><h1>Central de qualidade dos contatos</h1><p>Agora focada nos campos essenciais: nome completo, bairro e rua.</p></div>
    </header>
    <section className="issues-category-cards">
      {Object.entries(CATEGORY_LABELS).map(([key, label]) => <button key={key} className={category === key ? "active" : ""} onClick={() => { setCategory(category === key ? "" : key); setPage(1); }}><b>{data.categoryCounts[key] ?? 0}</b><span>{label}</span><small>{CATEGORY_HELP[key] ?? "Revisar cadastro."}</small></button>)}
    </section>
    <section className="issues-panel">
      <h2>Contatos para analisar</h2>
      {loading ? <p>Analisando...</p> : data.issues.map((issue: any) => <article key={issue.record_id}><b>{issue.contact_name}</b><p>{issue.district_original || "Sem bairro"} · {issue.street || "Sem rua"}</p><button onClick={() => { setEditing(issue); setName(issue.contact_name); setDistrict(issue.district_original); setStreet(issue.street); }}>Analisar</button></article>)}
    </section>
    {editing && <div className="issues-modal-backdrop"><section className="issues-modal"><h2>Corrigir cadastro</h2><label>Nome completo<input value={name} onChange={e => setName(e.target.value)} /></label><label>Bairro<input value={district} onChange={e => setDistrict(e.target.value)} /></label><label>Rua<input value={street} onChange={e => setStreet(e.target.value)} /></label><button onClick={() => void save()}>Salvar</button></section></div>}
  </main>;
}
