"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function normalized(value:string|undefined|null){return (value||"").trim().toLocaleLowerCase("pt-BR")}

export default function AdministrationUxRedesignEnhancer(){
  const [panel,setPanel]=useState<HTMLElement|null>(null);
  const [tabs,setTabs]=useState<HTMLElement|null>(null);
  const [createButton,setCreateButton]=useState<HTMLButtonElement|null>(null);
  const [usersButton,setUsersButton]=useState<HTMLButtonElement|null>(null);
  const [createActive,setCreateActive]=useState(false);
  const [permissionsActive,setPermissionsActive]=useState(false);
  const [hasPermissions,setHasPermissions]=useState(false);

  useEffect(()=>{
    let stopped=false;
    const decorate=()=>{
      if(stopped)return;
      const nextPanel=document.querySelector<HTMLElement>(".vf-hierarchy-panel");
      const nextTabs=nextPanel?.querySelector<HTMLElement>(".vf-access-tabs")||null;
      setPanel(current=>current===nextPanel?current:nextPanel);
      setTabs(current=>current===nextTabs?current:nextTabs);
      if(!nextPanel||!nextTabs){setCreateButton(null);setUsersButton(null);setHasPermissions(false);return}

      let nextCreate:HTMLButtonElement|null=null;
      let nextUsers:HTMLButtonElement|null=null;
      Array.from(nextTabs.querySelectorAll<HTMLButtonElement>(":scope > button")).forEach(button=>{
        if(button.dataset.vfPermissionsTab==="true")return;
        const text=normalized(button.textContent);
        if(text.includes("gerenciar")||text==="usuários"||text==="usuarios"){
          nextUsers=button;button.dataset.vfUsersTab="true";if(button.hidden)button.hidden=false;
        }else if(text.includes("cadastrar")){
          nextCreate=button;button.dataset.vfCreateTab="true";if(!button.hidden)button.hidden=true;
        }else if(text.includes("convite")){
          button.dataset.vfInvitationsTab="true";if(button.hidden)button.hidden=false;
        }else if(text.includes("auditoria")){
          button.dataset.vfAuditTab="true";if(button.hidden)button.hidden=false;
        }else if(text.includes("desempenho da equipe")){
          button.dataset.vfLegacyPerformanceTab="true";if(!button.hidden)button.hidden=true;
        }
      });
      setCreateButton(current=>current===nextCreate?current:nextCreate);
      setUsersButton(current=>current===nextUsers?current:nextUsers);
      setCreateActive(Boolean(nextCreate?.classList.contains("active")));
      const permissionHost=nextPanel.querySelector<HTMLElement>(":scope > [data-vf-gestor-municipalities-host]");
      setHasPermissions(Boolean(permissionHost));

      const application=nextPanel.querySelector<HTMLElement>(":scope > [data-vf-municipality-applications] .vf-municipality-applications");
      if(application){
        const shouldCompact=normalized(application.textContent).includes("nenhuma solicitação pendente");
        if(application.classList.contains("vf-applications-empty")!==shouldCompact)application.classList.toggle("vf-applications-empty",shouldCompact);
      }
    };
    decorate();
    const observer=new MutationObserver(decorate);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    document.addEventListener("click",decorate,true);
    return()=>{stopped=true;observer.disconnect();document.removeEventListener("click",decorate,true)};
  },[]);

  useEffect(()=>{
    if(!panel)return;
    const shouldShowPermissions=permissionsActive&&hasPermissions;
    if(panel.classList.contains("vf-permissions-active")!==shouldShowPermissions)panel.classList.toggle("vf-permissions-active",shouldShowPermissions);
    if(panel.classList.contains("vf-create-action-active")!==createActive)panel.classList.toggle("vf-create-action-active",createActive);
    return()=>{panel.classList.remove("vf-permissions-active","vf-create-action-active")};
  },[panel,permissionsActive,hasPermissions,createActive]);

  useEffect(()=>{
    if(!tabs)return;
    const deactivate=(event:Event)=>{
      const target=event.target as HTMLElement|null;
      const button=target?.closest<HTMLButtonElement>("button");
      if(button&&button.dataset.vfPermissionsTab!=="true")setPermissionsActive(false);
    };
    tabs.addEventListener("click",deactivate);
    return()=>tabs.removeEventListener("click",deactivate);
  },[tabs]);

  if(!panel||!tabs)return null;
  const header=panel.querySelector<HTMLElement>(":scope > header");

  const permissionsTab=hasPermissions?createPortal(
    <button type="button" data-vf-permissions-tab="true" className={permissionsActive?"active":""} onClick={()=>{
      if(createActive)usersButton?.click();
      setPermissionsActive(true);
    }}>Permissões</button>,tabs):null;

  const primaryAction=header&&createButton?createPortal(
    <button type="button" className={`vf-admin-new-access${createActive?" active":""}`} onClick={()=>{
      setPermissionsActive(false);
      if(createActive)usersButton?.click();else createButton.click();
    }}>{createActive?"← Voltar aos usuários":"+ Novo acesso"}</button>,header):null;

  return <>{permissionsTab}{primaryAction}</>;
}
