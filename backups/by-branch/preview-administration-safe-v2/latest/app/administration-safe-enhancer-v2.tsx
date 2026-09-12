"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type User = {
  id: number;
  email: string;
  name: string;
  accessRole: string;
  status: string;
  municipalityIds?: number[];
};

type Municipality = {
  id: number;
  name: string;
  state: string;
  status?: string;
};

const PAGE_SIZE = 5;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "VF";
}

export default function AdministrationSafeEnhancerV2() {
  const [gestorHost, setGestorHost] = useState<HTMLElement | null>(null);
  const [municipalityPanel, setMunicipalityPanel] = useState<HTMLElement | null>(null);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [drafts, setDrafts] = useState<Record<number, number[]>>({});
  const [selectedGestorId, setSelectedGestorId] = useState<number | null>(null);
  const [permissionQuery, setPermissionQuery] = useState("");
  const [municipalityQuery, setMunicipalityQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [matchCount, setMatchCount] = useState(0);
  const [shownCount, setShownCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadAccessData = useCallback(async () => {
    try {
      const response = await apiFetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;

      const nextUsers = Array.isArray(data.users) ? data.users as User[] : [];
      const nextMunicipalities = Array.isArray(data.municipalities) ? data.municipalities as Municipality[] : [];
      setUsers(nextUsers);
      setMunicipalities(nextMunicipalities);
      setDrafts(Object.fromEntries(nextUsers.map((user) => [
        user.id,
        Array.from(new Set((user.municipalityIds || []).map(Number))).filter(Boolean),
      ])));
    } catch {
      // Se a leitura auxiliar falhar, a interface original permanece disponível.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;

    const sync = () => {
      frame = 0;
      if (cancelled) return;

      const hierarchy = document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      const legacyGestor = hierarchy?.querySelector<HTMLElement>(".vf-gestor-municipality-admin") || null;

      if (legacyGestor && hierarchy) {
        legacyGestor.dataset.vfSafeReplaced = "true";
        let host = hierarchy.querySelector<HTMLElement>(":scope > [data-vf-safe-gestor-host]");
        if (!host) {
          host = document.createElement("div");
          host.dataset.vfSafeGestorHost = "true";
          legacyGestor.insertAdjacentElement("afterend", host);
        }
        setGestorHost((current) => current === host ? current : host);
      } else {
        setGestorHost((current) => current ? null : current);
      }

      const panel = document.querySelector<HTMLElement>(".vf-admin-municipalities-panel");
      const grid = panel?.querySelector<HTMLElement>(".vf-municipality-management-grid") || null;

      if (panel && grid) {
        panel.dataset.vfSafeAdmin = "true";
        let toolbar = panel.querySelector<HTMLElement>("[data-vf-safe-municipality-toolbar]");
        if (!toolbar) {
          toolbar = document.createElement("div");
          toolbar.dataset.vfSafeMunicipalityToolbar = "true";
          grid.insertAdjacentElement("beforebegin", toolbar);
        }
        let actions = panel.querySelector<HTMLElement>("[data-vf-safe-municipality-actions]");
        if (!actions) {
          actions = document.createElement("div");
          actions.dataset.vfSafeMunicipalityActions = "true";
          grid.insertAdjacentElement("afterend", actions);
        }
        setMunicipalityPanel((current) => current === panel ? current : panel);
        setToolbarHost((current) => current === toolbar ? current : toolbar);
        setActionsHost((current) => current === actions ? current : actions);
      } else {
        setMunicipalityPanel((current) => current ? null : current);
        setToolbarHost((current) => current ? null : current);
        setActionsHost((current) => current ? null : current);
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (gestorHost) void loadAccessData();
  }, [gestorHost, loadAccessData]);

  useEffect(() => {
    if (!municipalityPanel) return;
    const grid = municipalityPanel.querySelector<HTMLElement>(".vf-municipality-management-grid");
    if (!grid) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .vf-municipality-management-card"));
      const q = normalize(municipalityQuery);
      const matching = cards.filter((card) => !q || normalize(card.textContent || "").includes(q));
      const limit = q ? matching.length : Math.min(visibleCount, matching.length);
      const allowed = new Set(matching.slice(0, limit));

      cards.forEach((card) => {
        card.style.display = allowed.has(card) ? "" : "none";
      });

      setMatchCount(matching.length);
      setShownCount(limit);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(grid, { childList: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      grid.querySelectorAll<HTMLElement>(":scope > .vf-municipality-management-card").forEach((card) => {
        card.style.display = "";
      });
    };
  }, [municipalityPanel, municipalityQuery, visibleCount]);

  const gestorUsers = useMemo(() => users
    .filter((user) => user.accessRole === "gestor" && user.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [users]);

  const activeMunicipalities = useMemo(() => municipalities
    .filter((item) => !item.status || item.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [municipalities]);

  const selectedGestor = useMemo(
    () => gestorUsers.find((user) => user.id === selectedGestorId) || null,
    [gestorUsers, selectedGestorId],
  );

  const filteredPermissionMunicipalities = useMemo(() => {
    const q = normalize(permissionQuery);
    return activeMunicipalities.filter((item) => !q || normalize(`${item.name} ${item.state}`).includes(q));
  }, [activeMunicipalities, permissionQuery]);

  function selectedNames(user: User) {
    const ids = new Set(drafts[user.id] || user.municipalityIds || []);
    return activeMunicipalities.filter((item) => ids.has(item.id)).map((item) => item.name);
  }

  function toggleMunicipality(userId: number, municipalityId: number) {
    setDrafts((current) => {
      const selected = new Set(current[userId] || []);
      if (selected.has(municipalityId)) selected.delete(municipalityId);
      else selected.add(municipalityId);
      return { ...current, [userId]: Array.from(selected) };
    });
  }

  async function saveMunicipalities(user: User) {
    const municipalityIds = drafts[user.id] || [];
    if (!municipalityIds.length) {
      setMessage(`Selecione pelo menos um município para ${user.name}.`);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, municipalityIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar os municípios.");
      setMessage(`Permissões de ${user.name} atualizadas.`);
      setSelectedGestorId(null);
      setPermissionQuery("");
      await loadAccessData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar os municípios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {gestorHost ? createPortal(
        <section className="vf-safe-gestor-admin" aria-label="Permissões dos Gestores">
          <header>
            <div>
              <small>GESTÃO DE CONFIANÇA</small>
              <h3>Gestores multimunicipais</h3>
              <p>Defina os municípios autorizados sem carregar centenas de opções na tela principal.</p>
            </div>
            <span>{gestorUsers.length}</span>
          </header>

          {message ? <div className="vf-safe-admin-message" role="status">{message}</div> : null}

          <div className="vf-safe-gestor-list">
            {gestorUsers.map((user) => {
              const names = selectedNames(user);
              return (
                <article key={user.id}>
                  <div className="vf-safe-avatar">{initials(user.name)}</div>
                  <div className="vf-safe-gestor-copy">
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    <div className="vf-safe-city-chips">
                      {names.slice(0, 3).map((name) => <span key={name}>{name}</span>)}
                      {names.length > 3 ? <span>+{names.length - 3}</span> : null}
                      {!names.length ? <em>Nenhum município definido</em> : null}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedGestorId(user.id); setPermissionQuery(""); setMessage(""); }}>
                    Gerenciar <b>{names.length}</b>
                  </button>
                </article>
              );
            })}
            {!gestorUsers.length ? <p className="vf-safe-empty">Nenhum Gestor ativo encontrado.</p> : null}
          </div>
        </section>,
        gestorHost,
      ) : null}

      {toolbarHost ? createPortal(
        <div className="vf-safe-municipality-toolbar">
          <input
            value={municipalityQuery}
            onChange={(event) => { setMunicipalityQuery(event.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder="Buscar município, status ou responsável"
            aria-label="Buscar município"
          />
          <small>{municipalityQuery.trim()
            ? `${matchCount} resultado${matchCount === 1 ? "" : "s"}`
            : `Exibindo ${shownCount} de ${matchCount} municípios`}</small>
        </div>,
        toolbarHost,
      ) : null}

      {actionsHost && !municipalityQuery.trim() && matchCount > PAGE_SIZE ? createPortal(
        <div className="vf-safe-municipality-actions">
          {shownCount < matchCount ? (
            <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + PAGE_SIZE, matchCount))}>
              Ver mais 5
            </button>
          ) : null}
          {visibleCount > PAGE_SIZE ? (
            <button type="button" className="secondary" onClick={() => setVisibleCount(PAGE_SIZE)}>
              Mostrar menos
            </button>
          ) : null}
        </div>,
        actionsHost,
      ) : null}

      {selectedGestor ? createPortal(
        <div className="vf-safe-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelectedGestorId(null); }}>
          <section className="vf-safe-permission-modal">
            <header>
              <div><small>PERMISSÕES TERRITORIAIS</small><h3>{selectedGestor.name}</h3><p>{selectedGestor.email}</p></div>
              <button type="button" onClick={() => setSelectedGestorId(null)} disabled={saving}>×</button>
            </header>
            <div className="vf-safe-selected-count"><b>{(drafts[selectedGestor.id] || []).length}</b> município{(drafts[selectedGestor.id] || []).length === 1 ? "" : "s"} selecionado{(drafts[selectedGestor.id] || []).length === 1 ? "" : "s"}</div>
            <input className="vf-safe-permission-search" value={permissionQuery} onChange={(event) => setPermissionQuery(event.target.value)} placeholder="Buscar município" aria-label="Buscar município para permissão" />
            <div className="vf-safe-permission-grid">
              {filteredPermissionMunicipalities.map((municipality) => (
                <label key={municipality.id}>
                  <input type="checkbox" checked={(drafts[selectedGestor.id] || []).includes(municipality.id)} onChange={() => toggleMunicipality(selectedGestor.id, municipality.id)} />
                  <span><b>{municipality.name}</b><small>{municipality.state}</small></span>
                </label>
              ))}
            </div>
            <footer>
              <button type="button" onClick={() => setSelectedGestorId(null)} disabled={saving}>Cancelar</button>
              <button type="button" className="primary" onClick={() => void saveMunicipalities(selectedGestor)} disabled={saving}>{saving ? "Salvando…" : "Salvar municípios"}</button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}

      <style jsx global>{`
        .vf-gestor-municipality-admin[data-vf-safe-replaced="true"] { display: none !important; }
        [data-vf-safe-gestor-host] { grid-column: 1 / -1 !important; width: 100% !important; min-width: 0 !important; }

        .vf-safe-gestor-admin {
          box-sizing: border-box;
          width: 100%;
          margin-top: 14px;
          padding: 17px;
          border: 1px solid rgba(56,189,248,.18);
          border-radius: 17px;
          background: linear-gradient(180deg,#0d2747,#091f39);
          color: #f8fafc;
        }
        .vf-safe-gestor-admin > header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:11px; }
        .vf-safe-gestor-admin > header small,.vf-safe-permission-modal > header small { color:#efbd43; font-size:9px; font-weight:900; letter-spacing:.13em; }
        .vf-safe-gestor-admin > header h3 { margin:5px 0 4px; color:#fff; font-size:21px; }
        .vf-safe-gestor-admin > header p { margin:0; color:#9fb3c9; font-size:10px; line-height:1.45; }
        .vf-safe-gestor-admin > header > span { min-width:34px; height:34px; display:grid; place-items:center; border-radius:999px; background:#123858; color:#fff; font-weight:900; }
        .vf-safe-admin-message { margin-bottom:9px; padding:9px 10px; border:1px solid rgba(239,189,67,.2); border-radius:9px; background:rgba(239,189,67,.08); color:#efd487; font-size:10px; }
        .vf-safe-gestor-list { display:grid; gap:8px; }
        .vf-safe-gestor-list > article { display:grid; grid-template-columns:41px minmax(0,1fr) auto; align-items:center; gap:10px; padding:10px 11px; border:1px solid rgba(56,189,248,.13); border-radius:12px; background:#091f38; }
        .vf-safe-avatar { width:41px; height:41px; display:grid; place-items:center; border-radius:50%; background:linear-gradient(135deg,#1f6ca4,#143f6d); color:#fff; font-size:10px; font-weight:900; }
        .vf-safe-gestor-copy { min-width:0; }
        .vf-safe-gestor-copy > strong { display:block; color:#fff; font-size:12px; }
        .vf-safe-gestor-copy > small { display:block; margin-top:2px; overflow:hidden; color:#8fa7bf; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
        .vf-safe-city-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
        .vf-safe-city-chips span { padding:4px 7px; border-radius:999px; background:#143552; color:#cbe6ff; font-size:8px; font-weight:750; }
        .vf-safe-city-chips em { color:#7f95aa; font-size:9px; font-style:normal; }
        .vf-safe-gestor-list > article > button { min-height:35px; padding:0 10px; border:1px solid rgba(56,189,248,.25); border-radius:9px; background:#123b61; color:#edf8ff; font:inherit; font-size:10px; font-weight:850; cursor:pointer; }
        .vf-safe-gestor-list > article > button b { margin-left:4px; }
        .vf-safe-empty { margin:0; padding:14px; color:#8fa7bf; font-size:10px; text-align:center; }

        .vf-safe-municipality-toolbar { display:flex; align-items:center; gap:9px; margin:12px 0 10px; }
        .vf-safe-municipality-toolbar input { flex:1 1 auto; min-width:0; min-height:42px; padding:0 12px; border:1px solid rgba(56,189,248,.22); border-radius:10px; outline:0; background:#071a30; color:#fff; font:inherit; font-size:11px; }
        .vf-safe-municipality-toolbar input:focus { border-color:rgba(56,189,248,.58); }
        .vf-safe-municipality-toolbar small { flex:0 0 auto; color:#8299b1; font-size:9px; }
        .vf-safe-municipality-actions { display:flex; justify-content:center; gap:8px; padding:12px 0 2px; }
        .vf-safe-municipality-actions button { min-height:38px; padding:0 15px; border:1px solid rgba(56,189,248,.28); border-radius:10px; background:#155f38; color:#fff; font:inherit; font-size:10px; font-weight:850; cursor:pointer; }
        .vf-safe-municipality-actions button.secondary { background:#123b61; }

        .vf-safe-modal-backdrop { position:fixed; inset:0; z-index:25000; display:grid; place-items:center; padding:18px; background:rgba(2,8,23,.8); backdrop-filter:blur(7px); }
        .vf-safe-permission-modal { width:min(620px,100%); max-height:min(88vh,780px); overflow:hidden; display:grid; grid-template-rows:auto auto auto minmax(0,1fr) auto; gap:10px; padding:16px; border:1px solid rgba(56,189,248,.24); border-radius:18px; background:#071a2d; color:#f8fafc; box-shadow:0 28px 80px rgba(0,0,0,.48); }
        .vf-safe-permission-modal > header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:10px; border-bottom:1px solid rgba(56,189,248,.12); }
        .vf-safe-permission-modal > header h3 { margin:4px 0 2px; color:#fff; font-size:19px; }
        .vf-safe-permission-modal > header p { margin:0; color:#8fa7bf; font-size:10px; }
        .vf-safe-permission-modal > header > button { width:36px; height:36px; flex:0 0 36px; border:1px solid rgba(56,189,248,.18); border-radius:10px; background:#0d2747; color:#fff; font-size:20px; }
        .vf-safe-selected-count { padding:9px 11px; border-radius:10px; background:#0a203a; color:#9fb3c9; font-size:10px; }
        .vf-safe-selected-count b { color:#fff; }
        .vf-safe-permission-search { width:100%; min-height:41px; padding:0 12px; border:1px solid rgba(56,189,248,.2); border-radius:10px; outline:0; background:#071a30; color:#fff; font:inherit; font-size:11px; }
        .vf-safe-permission-grid { min-height:0; overflow-y:auto; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; align-content:start; padding:1px; }
        .vf-safe-permission-grid label { display:flex; align-items:center; gap:8px; min-height:47px; padding:8px 10px; border:1px solid rgba(56,189,248,.12); border-radius:10px; background:#091f38; cursor:pointer; }
        .vf-safe-permission-grid input { width:17px; height:17px; accent-color:#168ee0; }
        .vf-safe-permission-grid span { display:grid; gap:2px; min-width:0; }
        .vf-safe-permission-grid b { overflow:hidden; color:#fff; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
        .vf-safe-permission-grid small { color:#8097ad; font-size:8px; }
        .vf-safe-permission-modal > footer { display:flex; justify-content:flex-end; gap:8px; padding-top:10px; border-top:1px solid rgba(56,189,248,.1); }
        .vf-safe-permission-modal > footer button { min-height:39px; padding:0 13px; border:1px solid rgba(56,189,248,.2); border-radius:10px; background:#123b61; color:#fff; font:inherit; font-size:10px; font-weight:850; }
        .vf-safe-permission-modal > footer button.primary { border-color:rgba(34,197,94,.34); background:#155f38; }

        @media (max-width:760px) {
          .vf-safe-gestor-admin { margin-top:10px; padding:13px; border-radius:15px; }
          .vf-safe-gestor-admin > header h3 { font-size:19px; }
          .vf-safe-gestor-list > article { grid-template-columns:39px minmax(0,1fr); gap:9px; padding:10px; }
          .vf-safe-avatar { width:39px; height:39px; }
          .vf-safe-gestor-list > article > button { grid-column:2; justify-self:end; min-height:34px; }
          .vf-safe-municipality-toolbar { display:grid; grid-template-columns:1fr; }
          .vf-safe-municipality-toolbar small { text-align:right; }
          .vf-safe-modal-backdrop { align-items:end; padding:0; }
          .vf-safe-permission-modal { width:100%; max-height:90vh; border-radius:18px 18px 0 0; border-bottom:0; padding:14px; }
          .vf-safe-permission-grid { grid-template-columns:1fr; }
          .vf-safe-permission-modal > footer { padding-bottom:max(0px,env(safe-area-inset-bottom)); }
        }
      `}</style>
    </>
  );
}
