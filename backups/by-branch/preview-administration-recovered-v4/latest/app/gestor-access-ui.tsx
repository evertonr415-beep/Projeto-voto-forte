"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type SessionPayload = { user?: { accessRole?: string } };
type Municipality = { id:number; name:string; state:string; status:string };
type GestorUser = { id:number; name:string; email:string; accessRole:string; status:string; municipalityIds?:number[] };
type UsersPayload = { users?:GestorUser[]; municipalities?:Municipality[] };
type FilterMode = "selected" | "all";

export default function GestorAccessUi() {
  const [accessRole,setAccessRole]=useState("");
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [users,setUsers]=useState<GestorUser[]>([]);
  const [municipalities,setMunicipalities]=useState<Municipality[]>([]);
  const [drafts,setDrafts]=useState<Record<number,number[]>>({});
  const [busyId,setBusyId]=useState<number|null>(null);
  const [message,setMessage]=useState("");
  const [editingUserId,setEditingUserId]=useState<number|null>(null);
  const [search,setSearch]=useState("");
  const [filterMode,setFilterMode]=useState<FilterMode>("selected");

  const loadAdministration=useCallback(async()=>{
    if(accessRole!=="adm") return;
    const response=await apiFetch("/api/users",{cache:"no-store"});
    const data=(await response.json()) as UsersPayload & {error?:string};
    if(!response.ok) throw new Error(data.error||"Não foi possível carregar os Gestores.");
    const gestores=(data.users||[]).filter(user=>user.accessRole==="gestor"&&user.status==="active");
    setUsers(gestores);
    setMunicipalities((data.municipalities||[]).filter(item=>item.status==="active"));
    setDrafts(Object.fromEntries(gestores.map(user=>[user.id,Array.from(new Set((user.municipalityIds||[]).map(Number))).filter(Boolean)])));
  },[accessRole]);

  useEffect(()=>{
    let cancelled=false;
    apiFetch("/api/session",{cache:"no-store"})
      .then(async response=>({response,data:(await response.json()) as SessionPayload}))
      .then(({response,data})=>{if(!cancelled&&response.ok)setAccessRole(String(data.user?.accessRole||""))})
      .catch(()=>undefined);
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    if(!accessRole)return;
    const decorate=()=>{
      if(accessRole==="gestor"){
        document.querySelectorAll<HTMLElement>(".profile small").forEach(node=>{if(node.textContent!=="Gestor Multimunicipal")node.textContent="Gestor Multimunicipal"});
        document.querySelectorAll<HTMLButtonElement>(".management-filter button").forEach(button=>{if(button.textContent?.includes("Banco de Dados e Backup"))button.hidden=true});
        document.querySelectorAll<HTMLElement>(".admin-kpis > article").forEach(card=>{const label=card.querySelector("small")?.textContent?.trim().toUpperCase();if(label==="ADMINISTRADORES")card.hidden=true});
        const hierarchyPanel=document.querySelector<HTMLElement>(".vf-hierarchy-panel");
        if(hierarchyPanel){
          const hierarchyDescription=hierarchyPanel.querySelector<HTMLElement>("header p");
          const gestorHierarchy="Gestor → Master → Liderança → Liderado → Eleitor.";
          if(hierarchyDescription&&hierarchyDescription.textContent!==gestorHierarchy)hierarchyDescription.textContent=gestorHierarchy;
          hierarchyPanel.querySelectorAll<HTMLElement>(".vf-hierarchy-summary > article").forEach(card=>{const label=card.querySelector("small")?.textContent?.trim().toUpperCase();if(label==="ADM")card.hidden=true});
          hierarchyPanel.querySelectorAll<HTMLElement>(".vf-hierarchy-help").forEach(node=>{node.hidden=true});
          hierarchyPanel.querySelectorAll<HTMLElement>(".vf-hierarchy-user.role-adm").forEach(node=>{node.hidden=true});
        }
      }
      if(accessRole==="adm"){
        const panel=document.querySelector<HTMLElement>(".vf-hierarchy-panel");
        if(panel){
          let node=panel.querySelector<HTMLElement>(":scope > [data-vf-gestor-municipalities-host]");
          if(!node){node=document.createElement("div");node.dataset.vfGestorMunicipalitiesHost="true";const tabs=panel.querySelector(".vf-access-tabs");tabs?.insertAdjacentElement("afterend",node)}
          setHost(current=>current===node?current:node);
        }
      }
    };
    decorate();
    const observer=new MutationObserver(decorate);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[accessRole]);

  useEffect(()=>{if(accessRole!=="adm")return;void loadAdministration().catch(error=>setMessage(error instanceof Error?error.message:"Não foi possível carregar os Gestores."))},[accessRole,loadAdministration]);

  const activeMunicipalities=useMemo(()=>municipalities.slice().sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),[municipalities]);
  const municipalityById=useMemo(()=>new Map(activeMunicipalities.map(item=>[item.id,item])),[activeMunicipalities]);
  const editingUser=useMemo(()=>users.find(user=>user.id===editingUserId)||null,[users,editingUserId]);
  const selectedIds=editingUserId?drafts[editingUserId]||[]:[];
  const filteredMunicipalities=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("pt-BR");
    const selected=new Set(selectedIds);
    return activeMunicipalities.filter(item=>(filterMode==="all"||selected.has(item.id))&&(!q||`${item.name} ${item.state}`.toLocaleLowerCase("pt-BR").includes(q)));
  },[activeMunicipalities,filterMode,search,selectedIds]);

  function toggleMunicipality(userId:number,municipalityId:number){
    setDrafts(current=>{const selected=new Set(current[userId]||[]);if(selected.has(municipalityId))selected.delete(municipalityId);else selected.add(municipalityId);return{...current,[userId]:Array.from(selected)}});
  }
  function openManager(user:GestorUser){setDrafts(current=>({...current,[user.id]:Array.from(new Set((user.municipalityIds||current[user.id]||[]).map(Number))).filter(Boolean)}));setEditingUserId(user.id);setSearch("");setFilterMode("selected");setMessage("")}
  function closeManager(){if(editingUser){setDrafts(current=>({...current,[editingUser.id]:Array.from(new Set((editingUser.municipalityIds||[]).map(Number))).filter(Boolean)}))}setEditingUserId(null);setSearch("");setFilterMode("selected")}

  async function saveMunicipalities(user:GestorUser){
    const municipalityIds=drafts[user.id]||[];
    if(!municipalityIds.length){setMessage(`Selecione pelo menos um município para ${user.name}.`);return}
    setBusyId(user.id);setMessage("");
    try{
      const response=await apiFetch("/api/users",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:user.id,municipalityIds})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Não foi possível salvar os municípios.");
      setMessage(`Permissões de ${user.name} atualizadas com sucesso.`);setEditingUserId(null);await loadAdministration();
    }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível salvar os municípios.")}
    finally{setBusyId(null)}
  }

  if(accessRole!=="adm"||!host)return null;

  const manager=createPortal(
    <section className="vf-gestor-municipality-admin" aria-label="Permissões por município">
      <header>
        <div><small>PERMISSÕES TERRITORIAIS</small><h4>Gestores e municípios</h4><p>Controle quais municípios cada Gestor pode visualizar e administrar. A lista completa só abre quando você precisa editar.</p></div>
        <span>{users.length}</span>
      </header>
      {message&&<div className="vf-gestor-municipality-message" role="status">{message}</div>}
      {users.length?(
        <div className="vf-gestor-municipality-list">
          {users.map(user=>{
            const ids=drafts[user.id]||[];
            const selected=ids.map(id=>municipalityById.get(id)).filter((item):item is Municipality=>Boolean(item));
            return <article key={user.id}>
              <div className="vf-gestor-card-top">
                <div className="vf-gestor-avatar">{user.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()}</div>
                <div className="vf-gestor-identity"><b>{user.name}</b><small>{user.email}</small><div><span>GESTOR</span><i>ATIVO</i></div></div>
                <strong className="vf-gestor-count">{ids.length}<small>{ids.length===1?"município":"municípios"}</small></strong>
              </div>
              <div className="vf-gestor-selected-preview">
                {selected.length?selected.slice(0,4).map(item=><span key={item.id}>{item.name}</span>):<em>Nenhum município definido</em>}
                {selected.length>4?<span className="more">+{selected.length-4}</span>:null}
              </div>
              <button type="button" className="vf-manage-municipalities" onClick={()=>openManager(user)}>Gerenciar municípios <span>›</span></button>
            </article>
          })}
        </div>
      ):<p className="vf-gestor-empty">Nenhum Gestor ativo. Use “+ Novo acesso” para cadastrar o primeiro Gestor.</p>}
    </section>,host);

  const modal=editingUser?createPortal(
    <div className="vf-municipality-permission-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&busyId!==editingUser.id)closeManager()}}>
      <section className="vf-municipality-permission-modal" role="dialog" aria-modal="true" aria-label={`Municípios de ${editingUser.name}`}>
        <header>
          <button type="button" className="vf-permission-back" onClick={closeManager} disabled={busyId===editingUser.id}>←</button>
          <div><small>PERMISSÕES DO GESTOR</small><h3>Municípios de {editingUser.name}</h3><p>{selectedIds.length} de {activeMunicipalities.length} municípios autorizados</p></div>
          <button type="button" className="vf-permission-close" onClick={closeManager} disabled={busyId===editingUser.id}>×</button>
        </header>
        <div className="vf-permission-search"><span>⌕</span><input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar município..."/><button type="button" onClick={()=>setSearch("")} hidden={!search}>Limpar</button></div>
        <div className="vf-permission-filter" role="tablist">
          <button type="button" className={filterMode==="selected"?"active":""} onClick={()=>setFilterMode("selected")}>Selecionados <b>{selectedIds.length}</b></button>
          <button type="button" className={filterMode==="all"?"active":""} onClick={()=>setFilterMode("all")}>Todos <b>{activeMunicipalities.length}</b></button>
        </div>
        <div className="vf-permission-results">
          {filteredMunicipalities.length?filteredMunicipalities.map(item=>{
            const checked=selectedIds.includes(item.id);
            return <label key={item.id} className={checked?"selected":""}><input type="checkbox" checked={checked} onChange={()=>toggleMunicipality(editingUser.id,item.id)}/><span><b>{item.name}</b><small>{item.state}</small></span><i>{checked?"✓":"+"}</i></label>
          }):<div className="vf-permission-empty"><b>{search?"Nenhum município encontrado":"Nenhum município selecionado"}</b><p>{search?"Tente outro termo de busca.":"Abra a opção “Todos” para adicionar municípios a este Gestor."}</p></div>}
        </div>
        {message&&<div className="vf-permission-modal-message">{message}</div>}
        <footer><button type="button" onClick={closeManager} disabled={busyId===editingUser.id}>Cancelar</button><button type="button" onClick={()=>void saveMunicipalities(editingUser)} disabled={busyId===editingUser.id||!selectedIds.length}>{busyId===editingUser.id?"Salvando…":`Salvar ${selectedIds.length} ${selectedIds.length===1?"município":"municípios"}`}</button></footer>
      </section>
    </div>,document.body):null;

  return <>{manager}{modal}</>;
}
