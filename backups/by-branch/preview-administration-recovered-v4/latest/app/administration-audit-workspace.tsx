"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type Role = "adm" | "gestor" | "master" | "lideranca" | "liderado" | "eleitor";
type Category = "all" | "create" | "import" | "export" | "edit" | "delete" | "whatsapp" | "access" | "other";
type Activity = {
  id: string | number;
  actorEmail: string;
  actorName?: string;
  actorRole?: Role;
  action: string;
  detail: string;
  createdAt: string;
  category?: Exclude<Category, "all">;
  subjectName?: string | null;
  subjectKind?: string | null;
  district?: string | null;
  itemCount?: number;
};
type Feed = { logs?: Activity[]; imports?: Activity[]; exports?: Activity[] };

const filters: Array<{ key: Category; label: string }> = [
  { key: "all", label: "Tudo" },
  { key: "create", label: "Cadastros" },
  { key: "edit", label: "Edições" },
  { key: "import", label: "Importações" },
  { key: "export", label: "Exportações" },
  { key: "delete", label: "Exclusões" },
  { key: "whatsapp", label: "WhatsApp" },
];

const roleLabels: Record<Role, string> = {
  adm: "ADM",
  gestor: "Gestor",
  master: "Master",
  lideranca: "Liderança",
  liderado: "Liderado",
  eleitor: "Eleitor",
};

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "VF";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function actionLabel(activity: Activity) {
  if (activity.category === "create") return activity.subjectName ? `Cadastrou ${activity.subjectName}` : "Novo cadastro";
  if (activity.category === "import") return `Importou ${Number(activity.itemCount || 0).toLocaleString("pt-BR")} contatos`;
  if (activity.category === "export") return `Exportou ${Number(activity.itemCount || 0).toLocaleString("pt-BR")} contatos`;
  if (activity.category === "edit") return activity.subjectName ? `Editou ${activity.subjectName}` : "Cadastro editado";
  if (activity.category === "delete") return activity.subjectName ? `Excluiu ${activity.subjectName}` : "Cadastro excluído";
  return activity.action || "Atividade registrada";
}

export default function AdministrationAuditWorkspace() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [feed, setFeed] = useState<Feed>({});
  const [category, setCategory] = useState<Category>("all");
  const [actor, setActor] = useState("all");
  const [period, setPeriod] = useState("7d");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/administration/activity?limit=300", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a auditoria.");
      setFeed(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a auditoria.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let current: HTMLElement | null = null;
    const detect = () => {
      const next = document.querySelector<HTMLElement>(".audit-panel");
      if (next === current) return;
      current = next;
      setHost(next);
      if (next) {
        next.dataset.vfAuditWorkspace = "true";
        void load();
      }
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [load]);

  const activities = useMemo(() => {
    const map = new Map<string, Activity>();
    [...(feed.logs || []), ...(feed.imports || []), ...(feed.exports || [])].forEach((item) => map.set(String(item.id), item));
    return [...map.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [feed]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach((item) => map.set(item.actorEmail, item.actorName || item.actorEmail));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [activities]);

  const filtered = useMemo(() => {
    const maxAge = period === "24h" ? 86_400_000 : period === "7d" ? 604_800_000 : period === "30d" ? 2_592_000_000 : Infinity;
    const q = normalize(query);
    return activities.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (actor !== "all" && item.actorEmail !== actor) return false;
      if (Number.isFinite(maxAge) && Date.now() - +new Date(item.createdAt) > maxAge) return false;
      if (q && !normalize([item.actorName, item.actorEmail, item.action, item.detail, item.subjectName, item.subjectKind, item.district].filter(Boolean).join(" ")).includes(q)) return false;
      return true;
    });
  }, [activities, actor, category, period, query]);

  const today = useMemo(() => {
    const day = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const items = activities.filter((item) => new Date(item.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === day);
    return {
      total: items.length,
      creates: items.filter((item) => item.category === "create").length,
      edits: items.filter((item) => item.category === "edit").length,
      deletes: items.filter((item) => item.category === "delete").length,
    };
  }, [activities]);

  if (!host) return null;

  return createPortal(
    <section className="vf-audit-workspace">
      <header>
        <div><small>RASTREABILIDADE</small><h2>Atividades / Auditoria</h2><p>Veja o que aconteceu, quem realizou a ação e quando. Use os filtros para localizar rapidamente um evento.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}</button>
      </header>

      <div className="vf-audit-summary">
        <span><b>{today.total}</b> hoje</span>
        <span><b>{today.creates}</b> cadastros</span>
        <span><b>{today.edits}</b> edições</span>
        <span><b>{today.deletes}</b> exclusões</span>
      </div>

      {message ? <div className="vf-audit-message" role="status">{message}</div> : null}

      <div className="vf-audit-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa, ação, bairro ou detalhe" aria-label="Buscar atividades" />
        <select value={actor} onChange={(event) => setActor(event.target.value)}><option value="all">Todos os usuários</option>{actors.map(([email, name]) => <option key={email} value={email}>{name}</option>)}</select>
        <select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="24h">Últimas 24h</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="all">Todo o histórico</option></select>
      </div>

      <div className="vf-audit-category-tabs" role="tablist" aria-label="Tipos de atividade">
        {filters.map((filter) => <button type="button" key={filter.key} className={category === filter.key ? "active" : ""} onClick={() => setCategory(filter.key)}>{filter.label}</button>)}
      </div>

      <div className="vf-audit-list-v2">
        {filtered.map((activity) => (
          <article key={String(activity.id)}>
            <div className="vf-audit-avatar">{initials(activity.actorName || activity.actorEmail)}</div>
            <div className="vf-audit-main">
              <header><div><strong>{actionLabel(activity)}</strong><small>{activity.actorName || activity.actorEmail} · {roleLabels[activity.actorRole || "gestor"]}</small></div><time>{formatDate(activity.createdAt)}</time></header>
              {activity.subjectName || activity.district ? <p className="vf-audit-subject">{activity.subjectName ? <b>{activity.subjectName}</b> : null}{activity.subjectKind ? <span>{activity.subjectKind}</span> : null}{activity.district ? <span>{activity.district}</span> : null}</p> : null}
              {activity.detail ? <p>{activity.detail}</p> : null}
            </div>
          </article>
        ))}
        {!filtered.length && !loading ? <p className="vf-audit-empty">Nenhuma atividade encontrada com estes filtros.</p> : null}
      </div>
    </section>,
    host,
  );
}
