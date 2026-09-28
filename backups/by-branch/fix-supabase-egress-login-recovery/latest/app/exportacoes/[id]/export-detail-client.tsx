"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../supabase-client";

type ContactPayload = {
  name?: string;
  phone?: string;
  kind?: string;
  district?: string;
  cep?: string;
  street?: string;
  number?: string;
  leader?: string;
  city?: string;
  state?: string;
};

type ExportItem = {
  id: number;
  recordId: number;
  ownerEmail: string;
  snapshot: ContactPayload;
  available: boolean;
  current: ContactPayload | null;
};

type ExportInfo = {
  id: string;
  actorEmail: string;
  ownerScope: string;
  format: string;
  itemCount: number;
  createdAt: string;
};

type DetailResponse = {
  export: ExportInfo;
  items: ExportItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function formatLabel(value: string) {
  return value === "xlsx" ? "Excel" : value.toUpperCase();
}

export default function ExportDetailClient() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const exportId = String(params?.id ?? "");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<ExportItem | null>(null);
  const [form, setForm] = useState<ContactPayload>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!exportId) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch(
        `/api/contact-exports/${encodeURIComponent(exportId)}?page=${page}&pageSize=50`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/contatos");
        return;
      }
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível carregar este lote.");
      setData(payload as DetailResponse);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar este lote.",
      );
    } finally {
      setLoading(false);
    }
  }, [exportId, page, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const unavailable = useMemo(
    () => data?.items.filter((item) => !item.available).length ?? 0,
    [data],
  );

  function openEditor(item: ExportItem) {
    if (!item.available || !item.current) return;
    setEditing(item);
    setForm({ ...item.current });
    setMessage("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/records", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editing.recordId,
          payload: {
            name: text(form.name),
            phone: text(form.phone),
            kind: text(form.kind) === "Liderança" ? "Liderança" : "Eleitor",
            district: text(form.district),
            cep: text(form.cep),
            street: text(form.street),
            number: text(form.number),
            leader: text(form.leader),
            city: text(form.city),
            state: text(form.state),
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível atualizar o contato.");
      setEditing(null);
      setMessage("Contato atualizado. O snapshot da exportação foi preservado.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o contato.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(item: ExportItem) {
    const current = item.current ?? item.snapshot;
    if (!item.available) return;
    if (!window.confirm(`Excluir permanentemente o contato ${text(current.name) || `#${item.recordId}`} da base? O histórico da exportação será preservado.`)) return;

    setMessage("");
    try {
      const response = await apiFetch(`/api/records?id=${item.recordId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível excluir o contato.");
      setMessage("Contato excluído da base. Ele continua visível neste histórico como snapshot.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o contato.",
      );
    }
  }

  async function downloadAgain() {
    const response = await apiFetch(
      `/api/contact-exports/${encodeURIComponent(exportId)}/download`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error || "Não foi possível baixar o lote.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const disposition = response.headers.get("content-disposition") || "";
    const name = disposition.match(/filename="([^"]+)"/)?.[1];
    anchor.download = name || `exportacao-${exportId}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const exportInfo = data?.export;

  return (
    <main className="vf-export-page">
      <header className="vf-export-page-head">
        <div>
          <small>DETALHE DA EXPORTAÇÃO</small>
          <h1>{exportInfo ? `${formatLabel(exportInfo.format)} · ${exportInfo.itemCount.toLocaleString("pt-BR")} contatos` : "Carregando lote"}</h1>
          <p>
            {exportInfo
              ? `${exportInfo.actorEmail} · ${new Date(exportInfo.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
              : "Consultando o histórico protegido."}
          </p>
        </div>
        <div className="vf-export-page-actions">
          <button type="button" onClick={() => router.push("/exportacoes")}>
            Histórico
          </button>
          <button type="button" onClick={() => void downloadAgain()} disabled={!exportInfo}>
            Baixar novamente
          </button>
        </div>
      </header>

      {message ? <div className="vf-export-message" role="status">{message}</div> : null}

      <section className="vf-export-summary-grid" aria-label="Resumo do lote">
        <article>
          <small>RESPONSÁVEL PELA EXPORTAÇÃO</small>
          <b>{exportInfo?.actorEmail || "—"}</b>
        </article>
        <article>
          <small>ESCOPO</small>
          <b>{exportInfo?.ownerScope === "all" ? "Todos permitidos" : exportInfo?.ownerScope || "—"}</b>
        </article>
        <article>
          <small>CONTATOS NO LOTE</small>
          <b>{exportInfo?.itemCount.toLocaleString("pt-BR") || "—"}</b>
        </article>
        <article>
          <small>NÃO DISPONÍVEIS NESTA PÁGINA</small>
          <b>{unavailable.toLocaleString("pt-BR")}</b>
        </article>
      </section>

      <section className="vf-export-history-card" aria-busy={loading}>
        <div className="vf-export-section-title">
          <div>
            <small>CONTATOS EXPORTADOS</small>
            <h2>Itens deste lote</h2>
          </div>
          <span>{data ? `Página ${data.page} de ${data.totalPages}` : "Carregando"}</span>
        </div>

        {loading && !data ? (
          <p className="vf-export-empty">Carregando contatos…</p>
        ) : data?.items.length ? (
          <div className="vf-export-contact-list">
            {data.items.map((item) => {
              const contact = item.current ?? item.snapshot;
              const phone = text(contact.phone || item.snapshot.phone);
              return (
                <article className="vf-export-contact" key={item.id}>
                  <div className="vf-export-contact-main">
                    <div>
                      <b>{text(contact.name) || "Contato sem nome"}</b>
                      <span>{phone || "Sem telefone"}</span>
                    </div>
                    <small>
                      {text(contact.kind) || "Eleitor"} · {text(contact.district) || "Sem bairro"} · {item.ownerEmail}
                    </small>
                    {!item.available ? (
                      <em>Removido da base ou fora do seu escopo atual · snapshot preservado</em>
                    ) : null}
                  </div>
                  <div className="vf-export-contact-actions">
                    {phone ? (
                      <a
                        href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openEditor(item)}
                      disabled={!item.available}
                    >
                      Abrir / editar
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void deleteContact(item)}
                      disabled={!item.available}
                    >
                      Excluir da base
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="vf-export-empty">Nenhum contato encontrado neste lote.</p>
        )}

        {data && data.totalPages > 1 ? (
          <div className="vf-export-pagination">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              ← Anterior
            </button>
            <span>{data.total.toLocaleString("pt-BR")} contato(s)</span>
            <button type="button" disabled={page >= data.totalPages || loading} onClick={() => setPage((value) => value + 1)}>
              Próxima →
            </button>
          </div>
        ) : null}
      </section>

      {editing ? (
        <div className="vf-export-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditing(null);
        }}>
          <form className="vf-export-modal" onSubmit={saveEdit}>
            <header>
              <div>
                <small>CONTATO ATUAL</small>
                <h2>Abrir / editar contato</h2>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setEditing(null)} disabled={saving}>×</button>
            </header>
            <div className="vf-export-form-grid">
              <label>Nome<input required value={text(form.name)} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>WhatsApp<input required value={text(form.phone)} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label>Perfil<select value={text(form.kind) === "Liderança" ? "Liderança" : "Eleitor"} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}><option>Eleitor</option><option>Liderança</option></select></label>
              <label>Bairro<input value={text(form.district)} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} /></label>
              <label>CEP<input value={text(form.cep)} onChange={(event) => setForm((current) => ({ ...current, cep: event.target.value }))} /></label>
              <label>Rua<input value={text(form.street)} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} /></label>
              <label>Número<input value={text(form.number)} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} /></label>
              <label>Liderança<input value={text(form.leader)} onChange={(event) => setForm((current) => ({ ...current, leader: event.target.value }))} /></label>
              <label>Cidade<input value={text(form.city)} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></label>
              <label>Estado<input value={text(form.state)} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} /></label>
            </div>
            <footer>
              <p>Editar a base não altera o snapshot histórico deste lote.</p>
              <div>
                <button type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                <button type="submit" className="primary" disabled={saving}>{saving ? "Salvando…" : "Salvar contato"}</button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </main>
  );
}
