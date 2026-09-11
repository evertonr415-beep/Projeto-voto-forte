"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type AccessRole = "adm" | "master" | "lideranca" | "liderado" | "eleitor";
type ParentOption = { id: number; name: string; email: string; accessRole: AccessRole };
type RequestItem = {
  id: string;
  email: string;
  name: string;
  municipalityName: string;
  state: string;
  requestedAt: string;
  municipalityId?: number | null;
  parentOptions?: ParentOption[];
};

type Draft = { accessRole: Exclude<AccessRole, "adm">; parentUserId: number | "" };

const roleLabels: Record<Exclude<AccessRole, "adm">, string> = {
  master: "Master municipal",
  lideranca: "Liderança",
  liderado: "Liderado",
  eleitor: "Eleitor",
};

function requiredParentRole(role: Draft["accessRole"]): AccessRole | null {
  if (role === "lideranca") return "master";
  if (role === "liderado") return "lideranca";
  if (role === "eleitor") return "liderado";
  return null;
}

export default function MunicipalityAdministrationEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [accessRole, setAccessRole] = useState<AccessRole | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/municipality-applications");
      if (response.status === 403) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as solicitações.");
      const next = (data.requests || []) as RequestItem[];
      const actorRole = data.currentUser?.accessRole as AccessRole;
      setAccessRole(actorRole);
      setRequests(next);
      setDrafts((current) => {
        const updated = { ...current };
        for (const item of next) {
          if (!updated[item.id]) {
            updated[item.id] = {
              accessRole: actorRole === "master" ? "lideranca" : "master",
              parentUserId: "",
            };
          }
        }
        return updated;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar solicitações.");
    }
  }, []);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const detect = () => {
      const panel = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      if (!panel) return false;
      let node = panel.querySelector<HTMLElement>("[data-vf-municipality-applications]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.vfMunicipalityApplications = "true";
        const header = panel.querySelector(":scope > header");
        header?.insertAdjacentElement("afterend", node);
        if (!header) panel.prepend(node);
      }
      setHost(node);
      observer?.disconnect();
      void load();
      return true;
    };
    if (!detect()) {
      observer = new MutationObserver(detect);
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, [load]);

  const pendingCount = requests.length;
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    [],
  );

  async function decide(item: RequestItem, action: "approve" | "reject") {
    const draft = drafts[item.id] || { accessRole: "master" as const, parentUserId: "" };
    const needed = requiredParentRole(draft.accessRole);
    const validParents = (item.parentOptions || []).filter((parent) => parent.accessRole === needed);
    if (action === "approve" && accessRole === "adm" && needed && !draft.parentUserId) {
      setMessage(`Selecione o superior imediato para ${item.name}.`);
      return;
    }
    if (action === "approve" && accessRole === "adm" && needed && !validParents.length) {
      setMessage(`Ainda não existe ${needed === "master" ? "Master" : needed === "lideranca" ? "Liderança" : "Liderado"} ativo em ${item.municipalityName}.`);
      return;
    }

    setBusyId(item.id);
    setMessage("");
    try {
      const response = await apiFetch("/api/municipality-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          requestId: item.id,
          accessRole: draft.accessRole,
          parentUserId: draft.parentUserId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível processar a solicitação.");
      setMessage(action === "approve" ? `${item.name} foi aprovado em ${item.municipalityName}.` : `Solicitação de ${item.name} recusada.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível processar a solicitação.");
    } finally {
      setBusyId(null);
    }
  }

  if (!host || !accessRole) return null;

  return createPortal(
    <section className="vf-municipality-applications">
      <header>
        <div>
          <small>ENTRADA POR MUNICÍPIO</small>
          <h4>Solicitações de acesso</h4>
          <p>{accessRole === "adm" ? "Aprove novos municípios e defina a hierarquia inicial." : "Aprove novas lideranças somente do seu município."}</p>
        </div>
        <span>{pendingCount}</span>
      </header>
      {message && <div className="vf-municipality-message" role="status">{message}</div>}
      {requests.length ? (
        <div className="vf-municipality-request-list">
          {requests.map((item) => {
            const draft = drafts[item.id] || { accessRole: accessRole === "master" ? "lideranca" : "master", parentUserId: "" };
            const needed = requiredParentRole(draft.accessRole);
            const parents = (item.parentOptions || []).filter((parent) => parent.accessRole === needed);
            return (
              <article key={item.id}>
                <div className="vf-municipality-request-person">
                  <strong>{item.name}</strong>
                  <small>{item.email}</small>
                  <b>{item.municipalityName} - {item.state}</b>
                  <time>{dateFormatter.format(new Date(item.requestedAt))}</time>
                </div>
                {accessRole === "adm" ? (
                  <div className="vf-municipality-request-controls">
                    <label>
                      Perfil
                      <select
                        value={draft.accessRole}
                        onChange={(event) => setDrafts((current) => ({
                          ...current,
                          [item.id]: { accessRole: event.target.value as Draft["accessRole"], parentUserId: "" },
                        }))}
                      >
                        {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    {needed && (
                      <label>
                        Superior imediato
                        <select
                          value={draft.parentUserId}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [item.id]: { ...draft, parentUserId: Number(event.target.value) || "" },
                          }))}
                        >
                          <option value="">Selecione</option>
                          {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                ) : <div className="vf-municipality-master-role">Entrada como <b>Liderança</b></div>}
                <div className="vf-municipality-request-actions">
                  <button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "approve")}>Aprovar</button>
                  <button type="button" className="secondary" disabled={busyId === item.id} onClick={() => void decide(item, "reject")}>Recusar</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="vf-municipality-empty">Nenhuma solicitação pendente.</p>}
    </section>,
    host,
  );
}
