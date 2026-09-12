"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type Master = { id: number; name: string; email: string; status: string };
type PendingMaster = { id: number; name: string; email: string; expiresAt: string };
type Municipality = {
  id: number;
  name: string;
  state: string;
  status: "active" | "configuring" | "inactive";
  users: number;
  contacts: number;
  master?: Master | null;
  pendingMasterInvitation?: PendingMaster | null;
};

type ParentOption = {
  forRole?: string;
  id: number;
  name: string;
  email: string;
  accessRole: string;
};

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

type InviteDraft = { name: string; email: string };
type RequestDraft = { accessRole: "master" | "lideranca" | "liderado" | "eleitor"; parentUserId: number | "" };

const INITIAL_LIMIT = 5;
const STEP = 5;

const statusLabel: Record<Municipality["status"], string> = {
  active: "Ativo",
  configuring: "Em configuração",
  inactive: "Inativo",
};

const roleLabel: Record<RequestDraft["accessRole"], string> = {
  master: "Master municipal",
  lideranca: "Liderança",
  liderado: "Liderado",
  eleitor: "Eleitor",
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function parentRole(role: RequestDraft["accessRole"]) {
  if (role === "lideranca") return "master";
  if (role === "liderado") return "lideranca";
  if (role === "eleitor") return "liderado";
  return null;
}

export default function MunicipalityManagementEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, InviteDraft>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, RequestDraft>>({});
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_LIMIT);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<number | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const applyMunicipalities = useCallback((items: Municipality[]) => {
    setMunicipalities(items);
    setDrafts((current) => {
      const copy = { ...current };
      for (const municipality of items) {
        if (!copy[municipality.id]) copy[municipality.id] = { name: "", email: "" };
      }
      return copy;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [municipalitiesResponse, requestsResponse] = await Promise.all([
        apiFetch("/api/admin-municipalities", { cache: "no-store" }),
        apiFetch("/api/municipality-applications", { cache: "no-store" }),
      ]);
      if (municipalitiesResponse.status === 401 || municipalitiesResponse.status === 403) return false;
      const municipalityData = await municipalitiesResponse.json();
      if (!municipalitiesResponse.ok) throw new Error(municipalityData.error || "Não foi possível carregar os municípios.");
      applyMunicipalities(Array.isArray(municipalityData.municipalities) ? municipalityData.municipalities : []);

      if (requestsResponse.ok) {
        const requestData = await requestsResponse.json();
        const nextRequests = Array.isArray(requestData.requests) ? requestData.requests as RequestItem[] : [];
        setRequests(nextRequests);
        setRequestDrafts((current) => {
          const next = { ...current };
          for (const item of nextRequests) {
            if (!next[item.id]) next[item.id] = { accessRole: "master", parentUserId: "" };
          }
          return next;
        });
      } else {
        setRequests([]);
      }
      return true;
    } finally {
      setLoading(false);
    }
  }, [applyMunicipalities]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;

    const detect = () => {
      const filter = document.querySelector<HTMLElement>('.management-filter[aria-label="Seções administrativas"]');
      if (!filter) return;
      const parent = filter.parentElement;
      if (!parent) return;

      let tab = filter.querySelector<HTMLButtonElement>("[data-vf-municipalities-tab]");
      if (!tab) {
        tab = document.createElement("button");
        tab.type = "button";
        tab.dataset.vfMunicipalitiesTab = "true";
        tab.setAttribute("role", "tab");
        tab.textContent = "Municípios";
        filter.append(tab);
      }

      let node = parent.querySelector<HTMLElement>(":scope > [data-vf-admin-municipalities-host]");
      if (!node) {
        node = document.createElement("div");
        node.dataset.vfAdminMunicipalitiesHost = "true";
        filter.insertAdjacentElement("afterend", node);
      }

      tab.onclick = () => {
        parent.dataset.vfMunicipalitiesActive = "true";
        filter.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
          const selected = button === tab;
          button.classList.toggle("active", selected);
          button.setAttribute("aria-selected", String(selected));
        });
        setActive(true);
        setHost(node);
        setMessage("");
        setQuery("");
        setVisibleLimit(INITIAL_LIMIT);
        void load().catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível carregar os municípios."));
      };

      filter.querySelectorAll<HTMLButtonElement>("button:not([data-vf-municipalities-tab])").forEach((button) => {
        if (button.dataset.vfMunicipalitiesBound === "true") return;
        button.dataset.vfMunicipalitiesBound = "true";
        button.addEventListener("click", () => {
          delete parent.dataset.vfMunicipalitiesActive;
          setActive(false);
        });
      });
      setHost(node);
    };

    void load().then((authorized) => {
      if (cancelled || !authorized) return;
      observer = new MutationObserver(detect);
      observer.observe(document.body, { childList: true, subtree: true });
      detect();
    }).catch(() => undefined);

    return () => { cancelled = true; observer?.disconnect(); };
  }, [load]);

  useEffect(() => {
    setVisibleLimit(INITIAL_LIMIT);
  }, [query]);

  const totals = useMemo(
    () => municipalities.reduce(
      (acc, item) => ({ users: acc.users + Number(item.users || 0), contacts: acc.contacts + Number(item.contacts || 0) }),
      { users: 0, contacts: 0 },
    ),
    [municipalities],
  );

  const filteredMunicipalities = useMemo(() => {
    const q = normalize(query);
    return municipalities
      .filter((item) => !q || normalize(`${item.name} ${item.state} ${statusLabel[item.status]} ${item.master?.name || ""}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [municipalities, query]);

  const visibleMunicipalities = useMemo(
    () => query.trim() ? filteredMunicipalities : filteredMunicipalities.slice(0, visibleLimit),
    [filteredMunicipalities, query, visibleLimit],
  );

  const selectedMunicipality = useMemo(
    () => municipalities.find((item) => item.id === selectedMunicipalityId) || null,
    [municipalities, selectedMunicipalityId],
  );

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  async function municipalityAction(municipality: Municipality, action: "invite_master" | "activate") {
    const draft = drafts[municipality.id] || { name: "", email: "" };
    if (action === "invite_master" && (!draft.name.trim() || !draft.email.trim())) {
      setMessage(`Informe nome e e-mail do Master de ${municipality.name}.`);
      return;
    }
    setBusyId(municipality.id);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin-municipalities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, municipalityId: municipality.id, name: draft.name.trim(), email: draft.email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
      if (Array.isArray(data.municipalities)) applyMunicipalities(data.municipalities); else await load();
      setDrafts((current) => ({ ...current, [municipality.id]: { name: "", email: "" } }));
      setMessage(action === "activate" ? `${municipality.name} foi ativado.` : `Convite de Master criado para ${municipality.name}.`);
      setSelectedMunicipalityId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusyId(null);
    }
  }

  async function decideRequest(item: RequestItem, action: "approve" | "reject") {
    const draft = requestDrafts[item.id] || { accessRole: "master" as const, parentUserId: "" };
    const needed = parentRole(draft.accessRole);
    const parents = (item.parentOptions || []).filter((parent) => parent.accessRole === needed);
    if (action === "approve" && needed && !draft.parentUserId) {
      setMessage(`Selecione o superior imediato para ${item.name}.`);
      return;
    }
    if (action === "approve" && needed && !parents.length) {
      setMessage(`Ainda não existe ${needed === "master" ? "Master" : needed === "lideranca" ? "Liderança" : "Liderado"} disponível em ${item.municipalityName}.`);
      return;
    }
    setBusyId(item.id);
    setMessage("");
    try {
      const response = await apiFetch("/api/municipality-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requestId: item.id, accessRole: draft.accessRole, parentUserId: draft.parentUserId || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível processar a solicitação.");
      setMessage(action === "approve" ? `${item.name} foi aprovado em ${item.municipalityName}.` : `Solicitação de ${item.name} recusada.`);
      setSelectedRequestId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível processar a solicitação.");
    } finally {
      setBusyId(null);
    }
  }

  if (!host || !active) return null;

  const selectedDraft = selectedMunicipality ? drafts[selectedMunicipality.id] || { name: "", email: "" } : null;
  const selectedRequestDraft = selectedRequest ? requestDrafts[selectedRequest.id] || { accessRole: "master" as const, parentUserId: "" } : null;
  const selectedRequestParentRole = selectedRequestDraft ? parentRole(selectedRequestDraft.accessRole) : null;
  const selectedRequestParents = selectedRequest && selectedRequestParentRole
    ? (selectedRequest.parentOptions || []).filter((parent) => parent.accessRole === selectedRequestParentRole)
    : [];
  const canShowMore = !query.trim() && visibleLimit < filteredMunicipalities.length;
  const canShowLess = !query.trim() && visibleLimit > INITIAL_LIMIT;

  return createPortal(
    <>
      <section className="vf-municipality-workspace" aria-label="Administração de municípios">
        <header className="vf-municipality-workspace-head">
          <div><small>REDE TERRITORIAL</small><h2>Municípios</h2><p>Administre a operação municipal, o Master responsável e as novas solicitações de acesso.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Atualizando…" : "Atualizar"}</button>
        </header>

        <div className="vf-municipality-summary">
          <span><b>{municipalities.length}</b> municípios</span>
          <span><b>{totals.users.toLocaleString("pt-BR")}</b> usuários</span>
          <span><b>{totals.contacts.toLocaleString("pt-BR")}</b> contatos</span>
          <span className={requests.length ? "attention" : ""}><b>{requests.length}</b> solicitações</span>
        </div>

        {message ? <div className="vf-municipality-workspace-message" role="status">{message}</div> : null}

        {requests.length ? (
          <section className="vf-municipality-request-queue">
            <header><div><small>PENDÊNCIAS</small><h3>Solicitações de acesso</h3></div><span>{requests.length}</span></header>
            <div>
              {requests.slice(0, 4).map((item) => (
                <button type="button" key={item.id} onClick={() => setSelectedRequestId(item.id)}>
                  <span><b>{item.name}</b><small>{item.email}</small></span>
                  <em>{item.municipalityName} · {item.state}</em>
                  <i>Revisar →</i>
                </button>
              ))}
            </div>
            {requests.length > 4 ? <p className="vf-municipality-request-more">+ {requests.length - 4} solicitação{requests.length - 4 === 1 ? "" : "ões"} pendente{requests.length - 4 === 1 ? "" : "s"}</p> : null}
          </section>
        ) : null}

        <div className="vf-municipality-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar município, status ou responsável" aria-label="Buscar município" />
          <span>{query.trim() ? `${filteredMunicipalities.length} resultado${filteredMunicipalities.length === 1 ? "" : "s"}` : `Exibindo ${visibleMunicipalities.length} de ${filteredMunicipalities.length}`}</span>
        </div>

        <div className="vf-municipality-directory">
          {visibleMunicipalities.map((municipality) => (
            <article key={municipality.id}>
              <div className="vf-municipality-icon">{municipality.state}</div>
              <div className="vf-municipality-directory-main">
                <div><strong>{municipality.name}</strong><span className={`vf-municipality-status ${municipality.status}`}>{statusLabel[municipality.status]}</span></div>
                <small>{municipality.master ? `Master: ${municipality.master.name}` : municipality.pendingMasterInvitation ? `Master convidado: ${municipality.pendingMasterInvitation.name}` : "ADM Geral responsável"}</small>
                <div className="vf-municipality-directory-metrics"><span><b>{Number(municipality.users || 0).toLocaleString("pt-BR")}</b> usuários</span><span><b>{Number(municipality.contacts || 0).toLocaleString("pt-BR")}</b> contatos</span></div>
              </div>
              <button type="button" className="vf-municipality-manage" onClick={() => setSelectedMunicipalityId(municipality.id)}>Gerenciar</button>
            </article>
          ))}
          {!visibleMunicipalities.length && !loading ? <p className="vf-municipality-empty-v2">Nenhum município encontrado.</p> : null}
          {loading && !municipalities.length ? <p className="vf-municipality-empty-v2">Carregando municípios…</p> : null}
        </div>

        {!query.trim() && filteredMunicipalities.length > INITIAL_LIMIT ? (
          <div className="vf-municipality-pagination">
            <span>Exibindo {visibleMunicipalities.length} de {filteredMunicipalities.length} municípios</span>
            <div>
              {canShowMore ? <button type="button" className="vf-municipality-more" onClick={() => setVisibleLimit((current) => Math.min(current + STEP, filteredMunicipalities.length))}>Ver mais {Math.min(STEP, filteredMunicipalities.length - visibleLimit)}</button> : null}
              {canShowLess ? <button type="button" className="vf-municipality-less" onClick={() => setVisibleLimit(INITIAL_LIMIT)}>Mostrar menos</button> : null}
            </div>
          </div>
        ) : null}
      </section>

      {selectedMunicipality && selectedDraft && createPortal(
        <div className="vf-access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId == null) setSelectedMunicipalityId(null); }}>
          <section className="vf-access-modal vf-municipality-detail-modal">
            <header><div><small>{selectedMunicipality.state}</small><h3>{selectedMunicipality.name}</h3><p>Configuração da operação municipal.</p></div><button type="button" onClick={() => setSelectedMunicipalityId(null)}>×</button></header>
            <div className="vf-municipality-modal-status"><span className={`vf-municipality-status ${selectedMunicipality.status}`}>{statusLabel[selectedMunicipality.status]}</span><b>{Number(selectedMunicipality.users || 0).toLocaleString("pt-BR")}</b><small>usuários</small><b>{Number(selectedMunicipality.contacts || 0).toLocaleString("pt-BR")}</b><small>contatos</small></div>
            <section className="vf-municipality-master-box">
              <small>MASTER MUNICIPAL</small>
              {selectedMunicipality.master ? (
                <div><strong>{selectedMunicipality.master.name}</strong><span>{selectedMunicipality.master.email}</span></div>
              ) : selectedMunicipality.pendingMasterInvitation ? (
                <div><strong>{selectedMunicipality.pendingMasterInvitation.name}</strong><span>{selectedMunicipality.pendingMasterInvitation.email}</span><em>Convite pendente</em></div>
              ) : (
                <div><strong>Sem Master definido</strong><span>O ADM Geral permanece responsável.</span></div>
              )}
            </section>
            {!selectedMunicipality.master && !selectedMunicipality.pendingMasterInvitation && selectedMunicipality.status !== "inactive" ? (
              <form className="vf-municipality-master-form" onSubmit={(event) => { event.preventDefault(); void municipalityAction(selectedMunicipality, "invite_master"); }}>
                <label>Nome do Master<input value={selectedDraft.name} onChange={(event) => setDrafts((current) => ({ ...current, [selectedMunicipality.id]: { ...selectedDraft, name: event.target.value } }))} required /></label>
                <label>E-mail<input type="email" value={selectedDraft.email} onChange={(event) => setDrafts((current) => ({ ...current, [selectedMunicipality.id]: { ...selectedDraft, email: event.target.value } }))} required /></label>
                <button type="submit" disabled={busyId === selectedMunicipality.id}>{busyId === selectedMunicipality.id ? "Enviando…" : "Convidar Master"}</button>
              </form>
            ) : null}
            <footer><button type="button" onClick={() => setSelectedMunicipalityId(null)}>Fechar</button>{selectedMunicipality.status === "configuring" ? <button type="button" className="primary" disabled={busyId === selectedMunicipality.id} onClick={() => void municipalityAction(selectedMunicipality, "activate")}>{busyId === selectedMunicipality.id ? "Ativando…" : "Ativar município"}</button> : null}</footer>
          </section>
        </div>,
        document.body,
      )}

      {selectedRequest && selectedRequestDraft && createPortal(
        <div className="vf-access-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId == null) setSelectedRequestId(null); }}>
          <section className="vf-access-modal vf-municipality-request-modal">
            <header><div><small>SOLICITAÇÃO DE ACESSO</small><h3>{selectedRequest.name}</h3><p>{selectedRequest.email} · {selectedRequest.municipalityName}/{selectedRequest.state}</p></div><button type="button" onClick={() => setSelectedRequestId(null)}>×</button></header>
            <label>Perfil de acesso<select value={selectedRequestDraft.accessRole} onChange={(event) => setRequestDrafts((current) => ({ ...current, [selectedRequest.id]: { accessRole: event.target.value as RequestDraft["accessRole"], parentUserId: "" } }))}>{Object.entries(roleLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            {selectedRequestParentRole ? <label>Superior imediato<select value={selectedRequestDraft.parentUserId} onChange={(event) => setRequestDrafts((current) => ({ ...current, [selectedRequest.id]: { ...selectedRequestDraft, parentUserId: Number(event.target.value) || "" } }))}><option value="">Selecione</option>{selectedRequestParents.map((parent) => <option value={parent.id} key={parent.id}>{parent.name} — {parent.email}</option>)}</select></label> : <div className="vf-access-parent-summary"><span>Vínculo</span><b>Gestão municipal inicial</b></div>}
            <footer><button type="button" className="danger" disabled={busyId === selectedRequest.id} onClick={() => void decideRequest(selectedRequest, "reject")}>Recusar</button><button type="button" className="primary" disabled={busyId === selectedRequest.id} onClick={() => void decideRequest(selectedRequest, "approve")}>{busyId === selectedRequest.id ? "Processando…" : "Aprovar acesso"}</button></footer>
          </section>
        </div>,
        document.body,
      )}
    </>,
    host,
  );
}
