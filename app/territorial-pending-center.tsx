"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type Issue = {
  record_id: number;
  owner_email: string;
  contact_name: string;
  phone: string;
  district_original: string;
  district_key: string | null;
  category: string;
  suggested_district: string | null;
};

type PendingResponse = {
  total: number;
  page: number;
  totalPages: number;
  issues: Issue[];
  districts: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
  provavel_alias: "Provável nome equivalente",
  revisao_manual: "Revisão manual",
  sem_valor_util: "Bairro não informado",
  cidade_ou_nao_encontrado: "Cidade ou não encontrado",
  rural_localidade: "Zona rural / localidade",
};

function currentScope() {
  return document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
}

function installStyles() {
  const id = "vf-territorial-pending-center-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .vf-territorial-center{margin:0 0 14px;border:1px solid rgba(23,52,92,.12);border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,35,65,.08);overflow:hidden;color:#17345c}
    .vf-territorial-center>header{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;background:linear-gradient(135deg,#fff,#f7f9fc)}
    .vf-territorial-center>header div{min-width:0}.vf-territorial-center>header strong{display:block;font:800 14px/1.2 Arial,sans-serif}.vf-territorial-center>header small{display:block;margin-top:3px;color:#64748b;font:600 10px/1.35 Arial,sans-serif}
    .vf-territorial-center>header button{flex:0 0 auto;border:1px solid #d8e1ec;border-radius:10px;background:#fff;color:#17345c;padding:8px 11px;font:800 11px/1 Arial,sans-serif;cursor:pointer}
    .vf-territorial-body{border-top:1px solid #edf1f5;padding:12px 14px 14px}.vf-territorial-intro{margin:0 0 10px;color:#52657f;font:600 11px/1.45 Arial,sans-serif}
    .vf-territorial-list{display:grid;gap:9px}.vf-territorial-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.1fr);gap:12px;align-items:center;border:1px solid #e4eaf1;border-radius:12px;padding:10px;background:#fbfcfe}
    .vf-territorial-person strong{display:block;font:800 12px/1.25 Arial,sans-serif;color:#17345c}.vf-territorial-person span{display:block;margin-top:3px;color:#66758a;font:600 10px/1.35 Arial,sans-serif}.vf-territorial-person em{display:inline-block;margin-top:6px;border-radius:999px;background:#eef3f8;color:#52657f;padding:3px 7px;font:700 9px/1 Arial,sans-serif;font-style:normal}
    .vf-territorial-actions{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.vf-territorial-actions select{min-width:0;border:1px solid #cfd9e5;border-radius:9px;background:#fff;color:#17345c;padding:8px;font:700 10px/1.2 Arial,sans-serif}.vf-territorial-actions button{border:0;border-radius:9px;background:#17345c;color:#fff;padding:8px 10px;font:800 10px/1 Arial,sans-serif;cursor:pointer}.vf-territorial-actions button:disabled{opacity:.55;cursor:wait}.vf-territorial-matching{grid-column:1/-1;display:flex;align-items:center;gap:6px;color:#64748b;font:650 9px/1.25 Arial,sans-serif}.vf-territorial-matching input{margin:0}
    .vf-territorial-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px}.vf-territorial-footer span{color:#64748b;font:650 10px/1 Arial,sans-serif}.vf-territorial-footer div{display:flex;gap:6px}.vf-territorial-footer button{border:1px solid #d8e1ec;border-radius:8px;background:#fff;color:#17345c;padding:7px 9px;font:800 10px/1 Arial,sans-serif;cursor:pointer}.vf-territorial-footer button:disabled{opacity:.4;cursor:not-allowed}.vf-territorial-empty{margin:0;padding:12px;border-radius:10px;background:#f3f8f4;color:#326644;font:750 11px/1.4 Arial,sans-serif}.vf-territorial-error{margin:0;padding:10px;border-radius:10px;background:#fff4f4;color:#9d2f2f;font:700 10px/1.4 Arial,sans-serif}
    @media(max-width:760px){.vf-territorial-center{margin:0 0 12px;border-radius:14px}.vf-territorial-center>header{padding:11px 12px}.vf-territorial-center>header strong{font-size:12px}.vf-territorial-center>header small{font-size:9px}.vf-territorial-body{padding:10px}.vf-territorial-row{grid-template-columns:1fr;gap:9px;padding:9px}.vf-territorial-actions{grid-template-columns:minmax(0,1fr) auto}.vf-territorial-actions select{font-size:9px}.vf-territorial-actions button{padding:8px;font-size:9px}}
  `;
  document.head.appendChild(style);
}

export default function TerritorialPendingCenter() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("");
  const [data, setData] = useState<PendingResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [matching, setMatching] = useState<Record<number, boolean>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    installStyles();
    let timer: number | null = null;
    const attach = () => {
      const fullMap = document.querySelector<HTMLElement>(".full-map");
      if (!fullMap?.parentElement) return false;
      let node = document.querySelector<HTMLElement>(".vf-territorial-center-host");
      if (!node) {
        node = document.createElement("div");
        node.className = "vf-territorial-center-host";
        fullMap.parentElement.insertBefore(node, fullMap);
      }
      setHost(node);
      setScope(currentScope());
      return true;
    };
    if (!attach()) {
      timer = window.setInterval(() => {
        if (attach() && timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      }, 150);
    }

    const handleScope = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.matches(".scope-picker select")) return;
      setScope((target as HTMLSelectElement).value);
      setPage(1);
    };
    document.addEventListener("change", handleScope, true);
    return () => {
      document.removeEventListener("change", handleScope, true);
      if (timer !== null) window.clearInterval(timer);
      document.querySelector(".vf-territorial-center-host")?.remove();
    };
  }, []);

  const load = useCallback(async () => {
    if (!host) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "12" });
      if (scope) params.set("owner", scope);
      const response = await apiFetch(`/api/territorial-pending?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as PendingResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar pendências");
      setData(payload);
      setChoices((current) => {
        const next = { ...current };
        for (const issue of payload.issues) {
          if (!next[issue.record_id] && issue.suggested_district)
            next[issue.record_id] = issue.suggested_district;
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as pendências");
    } finally {
      setLoading(false);
    }
  }, [host, page, scope]);

  useEffect(() => {
    if (host) void load();
  }, [host, load]);

  const districtOptions = useMemo(() => data?.districts ?? [], [data]);

  async function resolveIssue(issue: Issue) {
    const district = choices[issue.record_id] || issue.suggested_district || "";
    if (!district) {
      setError("Selecione o bairro correto antes de confirmar.");
      return;
    }
    setSavingId(issue.record_id);
    setError("");
    try {
      const response = await apiFetch("/api/territorial-pending", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recordId: issue.record_id,
          district,
          applyToMatching: Boolean(matching[issue.record_id]),
          owner: scope || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string; updated?: number };
      if (!response.ok) throw new Error(payload.error || "Não foi possível corrigir a pendência");
      window.dispatchEvent(new CustomEvent("voto-forte:records-changed"));
      window.dispatchEvent(new CustomEvent("voto-forte:geocoding-complete"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível corrigir a pendência");
    } finally {
      setSavingId(null);
    }
  }

  if (!host) return null;

  return createPortal(
    <section className="vf-territorial-center" aria-label="Pendências territoriais">
      <header>
        <div>
          <strong>Pendências territoriais{data ? ` · ${data.total.toLocaleString("pt-BR")}` : ""}</strong>
          <small>Associe contatos sem bairro reconhecido sem inventar uma localização individual.</small>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Fechar" : "Revisar"}
        </button>
      </header>
      {open && (
        <div className="vf-territorial-body">
          <p className="vf-territorial-intro">
            Ao associar um bairro, o contato passa a contribuir para o ponto azul territorial. Ele só recebe pino individual se já possuir coordenadas exatas confiáveis.
          </p>
          {error && <p className="vf-territorial-error">{error}</p>}
          {loading && !data ? (
            <p className="vf-territorial-intro">Carregando pendências…</p>
          ) : data && data.issues.length ? (
            <>
              <div className="vf-territorial-list">
                {data.issues.map((issue) => (
                  <div className="vf-territorial-row" key={issue.record_id}>
                    <div className="vf-territorial-person">
                      <strong>{issue.contact_name || "Contato sem nome"}</strong>
                      <span>
                        Bairro informado: <b>{issue.district_original || "não informado"}</b>
                        {issue.phone ? ` · ${issue.phone}` : ""}
                      </span>
                      <em>{CATEGORY_LABELS[issue.category] || "Revisão territorial"}</em>
                    </div>
                    <div className="vf-territorial-actions">
                      <select
                        value={choices[issue.record_id] || issue.suggested_district || ""}
                        onChange={(event) =>
                          setChoices((current) => ({
                            ...current,
                            [issue.record_id]: event.target.value,
                          }))
                        }
                        aria-label={`Bairro correto de ${issue.contact_name || "contato"}`}
                      >
                        <option value="">Selecionar bairro…</option>
                        {issue.suggested_district &&
                          !districtOptions.includes(issue.suggested_district) && (
                            <option value={issue.suggested_district}>
                              {issue.suggested_district} — sugerido
                            </option>
                          )}
                        {districtOptions.map((district) => (
                          <option value={district} key={district}>
                            {district}
                            {district === issue.suggested_district ? " — sugerido" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={savingId === issue.record_id}
                        onClick={() => void resolveIssue(issue)}
                      >
                        {savingId === issue.record_id ? "Salvando…" : "Associar"}
                      </button>
                      {issue.district_key && (
                        <label className="vf-territorial-matching">
                          <input
                            type="checkbox"
                            checked={Boolean(matching[issue.record_id])}
                            onChange={(event) =>
                              setMatching((current) => ({
                                ...current,
                                [issue.record_id]: event.target.checked,
                              }))
                            }
                          />
                          Aplicar também aos contatos deste ambiente com o mesmo bairro informado
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="vf-territorial-footer">
                <span>
                  Página {data.page} de {data.totalPages}
                </span>
                <div>
                  <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    Anterior
                  </button>
                  <button type="button" disabled={page >= data.totalPages || loading} onClick={() => setPage((value) => value + 1)}>
                    Próxima
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="vf-territorial-empty">Nenhuma pendência territorial neste ambiente.</p>
          )}
        </div>
      )}
    </section>,
    host,
  );
}
