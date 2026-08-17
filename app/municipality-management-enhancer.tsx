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

type InviteDraft = { name: string; email: string };

const statusLabel: Record<Municipality["status"], string> = {
  active: "Ativo",
  configuring: "Em configuração",
  inactive: "Inativo",
};

export default function MunicipalityManagementEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [drafts, setDrafts] = useState<Record<number, InviteDraft>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(false);

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
    const response = await apiFetch("/api/admin-municipalities");
    if (response.status === 401 || response.status === 403) return false;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar os municípios.");
    applyMunicipalities(Array.isArray(data.municipalities) ? data.municipalities : []);
    return true;
  }, [applyMunicipalities]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;

    const detect = () => {
      const filter = document.querySelector<HTMLElement>(".management-filter");
      if (!filter || !filter.textContent?.includes("Usuários e acessos")) return;

      const parent = filter.parentElement;
      if (!parent) return;
      if (parent.dataset.vfMunicipalitiesActive !== "true") setActive(false);

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

    void load()
      .then((authorized) => {
        if (cancelled || !authorized) return;
        observer = new MutationObserver(detect);
        observer.observe(document.body, { childList: true, subtree: true });
        detect();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [load]);

  const totals = useMemo(
    () => municipalities.reduce(
      (acc, item) => ({ users: acc.users + Number(item.users || 0), contacts: acc.contacts + Number(item.contacts || 0) }),
      { users: 0, contacts: 0 },
    ),
    [municipalities],
  );

  async function submit(municipality: Municipality, action: "invite_master" | "activate") {
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
        body: JSON.stringify({
          action,
          municipalityId: municipality.id,
          name: draft.name.trim(),
          email: draft.email.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
      if (Array.isArray(data.municipalities)) applyMunicipalities(data.municipalities);
      else await load();
      setDrafts((current) => ({ ...current, [municipality.id]: { name: "", email: "" } }));
      setMessage(
        action === "activate"
          ? `${municipality.name} foi ativado.`
          : `Convite de Master criado para ${municipality.name}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusyId(null);
    }
  }

  if (!host || !active) return null;

  return createPortal(
    <section className="vf-admin-municipalities" aria-label="Administração de municípios">
      <div className="vf-admin-municipalities-head">
        <div>
          <small>CENTRAL ESTADUAL · ADM GERAL</small>
          <h2>Municípios</h2>
          <p>Cadastre a operação municipal com um único banco, mantendo usuários e dados isolados por município.</p>
        </div>
        <div className="vf-admin-municipalities-kpis">
          <span><b>{municipalities.length}</b><small>municípios</small></span>
          <span><b>{totals.users.toLocaleString("pt-BR")}</b><small>usuários</small></span>
          <span><b>{totals.contacts.toLocaleString("pt-BR")}</b><small>contatos</small></span>
        </div>
      </div>

      {message && <div className="vf-admin-municipalities-message" role="status">{message}</div>}

      <div className="vf-admin-municipalities-list">
        {municipalities.map((municipality) => {
          const draft = drafts[municipality.id] || { name: "", email: "" };
          const configuring = municipality.status === "configuring";
          const canInvite = configuring && !municipality.master && !municipality.pendingMasterInvitation;
          const canActivate = configuring && Boolean(municipality.master);

          return (
            <article key={municipality.id} className={`vf-admin-municipality-card ${municipality.status}`}>
              <header>
                <div>
                  <small>{municipality.state}</small>
                  <h3>{municipality.name}</h3>
                </div>
                <span className={`vf-municipality-status ${municipality.status}`}>{statusLabel[municipality.status]}</span>
              </header>

              <div className="vf-admin-municipality-metrics">
                <span><b>{Number(municipality.users || 0).toLocaleString("pt-BR")}</b><small>usuários</small></span>
                <span><b>{Number(municipality.contacts || 0).toLocaleString("pt-BR")}</b><small>contatos</small></span>
              </div>

              <div className="vf-admin-municipality-master">
                <small>MASTER MUNICIPAL</small>
                {municipality.master ? (
                  <div><b>{municipality.master.name}</b><span>{municipality.master.email}</span></div>
                ) : municipality.pendingMasterInvitation ? (
                  <div><b>{municipality.pendingMasterInvitation.name}</b><span>{municipality.pendingMasterInvitation.email} · convite pendente</span></div>
                ) : (
                  <p>Nenhum Master definido.</p>
                )}
              </div>

              {canInvite && (
                <form
                  className="vf-admin-master-invite"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(municipality, "invite_master");
                  }}
                >
                  <label>
                    Nome do Master
                    <input
                      value={draft.name}
                      onChange={(event) => setDrafts((current) => ({ ...current, [municipality.id]: { ...draft, name: event.target.value } }))}
                      required
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      value={draft.email}
                      onChange={(event) => setDrafts((current) => ({ ...current, [municipality.id]: { ...draft, email: event.target.value } }))}
                      required
                    />
                  </label>
                  <button disabled={busyId === municipality.id}>Convidar Master</button>
                </form>
              )}

              {configuring && (
                <footer>
                  <p>
                    {canActivate
                      ? "Master ativo confirmado. O município já pode ser liberado pelo ADM Geral."
                      : municipality.pendingMasterInvitation
                        ? "Aguardando o Master aceitar o convite. A operação permanece bloqueada."
                        : "Defina o Master antes de liberar a operação municipal."}
                  </p>
                  <button
                    type="button"
                    disabled={!canActivate || busyId === municipality.id}
                    onClick={() => void submit(municipality, "activate")}
                  >
                    Ativar município
                  </button>
                </footer>
              )}
            </article>
          );
        })}
      </div>
    </section>,
    host,
  );
}
