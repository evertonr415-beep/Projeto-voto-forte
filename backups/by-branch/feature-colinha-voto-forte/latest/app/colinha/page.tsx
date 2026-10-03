"use client";

import { useMemo, useRef, useState } from "react";
import "./styles.css";

type Cargo = "Deputado Federal" | "Deputado Estadual" | "Senador 1" | "Senador 2" | "Governador" | "Presidente";
type Escolha = { cargo: Cargo; nome: string; numero: string; partido?: string };

const cargos: Cargo[] = ["Deputado Federal", "Deputado Estadual", "Senador 1", "Senador 2", "Governador", "Presidente"];
const iniciais: Record<Cargo, Escolha> = {
  "Deputado Federal": { cargo: "Deputado Federal", nome: "Pedro Lupion", numero: "1000" },
  "Deputado Estadual": { cargo: "Deputado Estadual", nome: "Sergio Onofre", numero: "55633" },
  "Senador 1": { cargo: "Senador 1", nome: "Alexandre Curi", numero: "100" },
  "Senador 2": { cargo: "Senador 2", nome: "", numero: "" },
  Governador: { cargo: "Governador", nome: "", numero: "" },
  Presidente: { cargo: "Presidente", nome: "", numero: "" },
};

// Candidaturas do Paraná exibidas em ordem numérica, sem ranking, recomendação ou pré-seleção.
// Conferir situação atual do registro no DivulgaCandContas/TSE.
const senadores: Escolha[] = [
  { cargo:"Senador 2", nome:"Gleisi", numero:"131", partido:"PT" },
  { cargo:"Senador 2", nome:"Dr Rosinha", numero:"132", partido:"PT" },
  { cargo:"Senador 2", nome:"Karen Guerreiro", numero:"144", partido:"MISSÃO" },
  { cargo:"Senador 2", nome:"Filipe Barros", numero:"222", partido:"PL" },
  { cargo:"Senador 2", nome:"Marcelo Marcelino", numero:"290", partido:"PCO" },
  { cargo:"Senador 2", nome:"Deltan Dallagnol", numero:"300", partido:"NOVO" },
  { cargo:"Senador 2", nome:"Cristina Graeml", numero:"555", partido:"PSD" },
  { cargo:"Senador 2", nome:"Joaquim do MLB", numero:"800", partido:"UP" },
];

const governadores: Escolha[] = [
  { cargo:"Governador", nome:"Adriano Funileiro", numero:"29", partido:"PCO" },
  { cargo:"Governador", nome:"Doutor Alexandre Salomão", numero:"33", partido:"Mobiliza" },
  { cargo:"Governador", nome:"Luiz França", numero:"14", partido:"Missão" },
  { cargo:"Governador", nome:"Requião Filho", numero:"12", partido:"PDT" },
  { cargo:"Governador", nome:"Samuel de Mattos", numero:"16", partido:"PSTU" },
  { cargo:"Governador", nome:"Sandro Alex", numero:"55", partido:"PSD" },
  { cargo:"Governador", nome:"Sergio Moro", numero:"22", partido:"PL" },
  { cargo:"Governador", nome:"Tayná Miessa", numero:"80", partido:"UP" },
];
const presidentes: Escolha[] = [
  { cargo:"Presidente", nome:"Clariana Barão", numero:"27", partido:"DC" },
  { cargo:"Presidente", nome:"Edmilson Costa", numero:"21", partido:"PCB" },
  { cargo:"Presidente", nome:"Escritor Augusto Cury", numero:"70", partido:"Avante" },
  { cargo:"Presidente", nome:"Flavio Bolsonaro", numero:"22", partido:"PL" },
  { cargo:"Presidente", nome:"Hertz Dias", numero:"16", partido:"PSTU" },
  { cargo:"Presidente", nome:"Lula", numero:"13", partido:"PT" },
  { cargo:"Presidente", nome:"Renan Santos", numero:"14", partido:"Missão" },
  { cargo:"Presidente", nome:"Ronaldo Caiado", numero:"55", partido:"PSD" },
  { cargo:"Presidente", nome:"Rui Costa Pimenta", numero:"29", partido:"PCO" },
  { cargo:"Presidente", nome:"Samara", numero:"80", partido:"UP" },
  { cargo:"Presidente", nome:"Veterinário Wilson Grassi", numero:"35", partido:"Democrata" },
  { cargo:"Presidente", nome:"Zema", numero:"30", partido:"Novo" },
];

export default function ColinhaPage() {
  const [escolhas, setEscolhas] = useState(iniciais);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preenchidos = useMemo(() => cargos.filter((c) => escolhas[c].numero.trim()).length, [escolhas]);
  function selecionar(cargo: Cargo, candidato: Escolha) { setEscolhas((a) => ({...a,[cargo]:{...candidato,cargo}})); }

  function desenhar(): HTMLCanvasElement | null {
    const canvas=canvasRef.current;if(!canvas)return null;canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext("2d");if(!ctx)return null;
    const grad=ctx.createLinearGradient(0,0,0,1920);grad.addColorStop(0,"#061c39");grad.addColorStop(1,"#020b19");ctx.fillStyle=grad;ctx.fillRect(0,0,1080,1920);ctx.fillStyle="#d6b451";ctx.fillRect(0,0,1080,12);
    ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="900 78px Arial";ctx.fillText("VOTO FORTE",540,135);ctx.fillStyle="#d6b451";ctx.font="700 34px Arial";ctx.fillText("MINHA COLINHA",540,188);ctx.fillStyle="#b8c4d5";ctx.font="28px Arial";ctx.fillText("Seus números para o dia da votação",540,245);
    cargos.forEach((cargo,i)=>{const y=330+i*235,e=escolhas[cargo];ctx.fillStyle="rgba(255,255,255,.07)";roundRect(ctx,70,y,940,185,28);ctx.fill();ctx.textAlign="left";ctx.fillStyle="#d6b451";ctx.font="700 27px Arial";ctx.fillText(cargo.toUpperCase(),110,y+48);ctx.fillStyle="#fff";ctx.font="800 43px Arial";ctx.fillText((e.nome||"Escolha seu candidato").toUpperCase(),110,y+103);ctx.textAlign="right";ctx.font="900 74px Arial";ctx.fillText(e.numero||"—",955,y+118)});
    ctx.textAlign="center";ctx.fillStyle="#9baabd";ctx.font="25px Arial";ctx.fillText("Voto Forte • Colinha pessoal",540,1810);ctx.font="20px Arial";ctx.fillText("Confira os dados no TSE antes de votar.",540,1850);return canvas;
  }
  function baixar(){const c=desenhar();if(!c)return;const a=document.createElement("a");a.download="colinha-voto-forte.png";a.href=c.toDataURL("image/png");a.click()}
  async function compartilhar(){const c=desenhar();if(!c)return;const blob=await new Promise<Blob|null>(r=>c.toBlob(r,"image/png"));if(!blob)return;const file=new File([blob],"colinha-voto-forte.png",{type:"image/png"});if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({title:"Minha Colinha - Voto Forte",files:[file]});else baixar()}

  return <main className="vf-colinha"><header className="vf-top"><div className="vf-brand"><span className="vf-mark">VF</span><div><strong>VOTO FORTE</strong><small>Gerador de Colinha</small></div></div><a href="/">Voltar ao Voto Forte</a></header>
    <section className="vf-hero"><span className="vf-pill">ELEIÇÕES 2026</span><h1>Monte sua <em>colinha</em></h1><p>Três campos já estão configurados. Nos demais, escolha livremente entre as candidaturas disponíveis. Nenhuma opção é marcada automaticamente.</p></section>
    <section className="vf-workspace"><div className="vf-form"><div className="vf-progress"><strong>{preenchidos} de {cargos.length}</strong><span>cargos preenchidos</span></div>
      {(["Deputado Federal","Deputado Estadual","Senador 1"] as Cargo[]).map(c=><div className="vf-field vf-fixed" key={c}><label>{c}</label><div className="vf-fixed-card"><div><strong>{escolhas[c].nome}</strong><small>Pré-configurado</small></div><b>{escolhas[c].numero}</b></div></div>)}
      <Seletor cargo="Senador 2" atual={escolhas["Senador 2"]} opcoes={senadores} onSelect={c=>selecionar("Senador 2",c)} placeholder="Escolha o segundo candidato ao Senado" />
      <Seletor cargo="Governador" atual={escolhas.Governador} opcoes={governadores} onSelect={c=>selecionar("Governador",c)} placeholder="Escolha entre os candidatos a governador do Paraná" />
      <Seletor cargo="Presidente" atual={escolhas.Presidente} opcoes={presidentes} onSelect={c=>selecionar("Presidente",c)} placeholder="Escolha entre os candidatos a presidente" />
      <p className="vf-source">Dados eleitorais: conferir no DivulgaCandContas/TSE. A situação dos registros pode ser atualizada pela Justiça Eleitoral.</p><div className="vf-actions"><button onClick={baixar} disabled={preenchidos<6}>Gerar minha colinha</button><button className="secondary" onClick={compartilhar} disabled={preenchidos<6}>Compartilhar</button></div></div>
      <div className="vf-preview-wrap"><div className="vf-preview"><div className="preview-head"><span>VOTO FORTE</span><b>MINHA COLINHA</b></div>{cargos.map(c=><div className="preview-row" key={c}><div><small>{c}</small><strong>{escolhas[c].nome||"Escolha um candidato"}</strong></div><b>{escolhas[c].numero||"—"}</b></div>)}<footer>Confira os dados oficiais antes de votar.</footer></div></div>
    </section><canvas ref={canvasRef} className="vf-hidden-canvas" /></main>;
}

function Seletor({cargo,atual,opcoes=[],onSelect,placeholder}:{cargo:Cargo;atual:Escolha;opcoes?:Escolha[];onSelect:(c:Escolha)=>void;placeholder:string}){
 const [busca,setBusca]=useState(""); const filtradas=opcoes.filter(o=>(o.nome+" "+o.numero+" "+(o.partido||"")).toLowerCase().includes(busca.toLowerCase()));
 return <div className="vf-field"><label>{cargo}</label>{atual.numero&&<div className="vf-selected"><span><strong>{atual.nome}</strong><small>{atual.partido||""}</small></span><b>{atual.numero}</b></div>}<input className="vf-search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder={placeholder}/><div className="vf-options">{filtradas.map(o=><button type="button" key={o.numero+o.nome} aria-pressed={atual.numero===o.numero} onClick={()=>{onSelect(o);setBusca("")}}><span><strong>{o.nome}</strong><small>{o.partido}</small></span><b>{o.numero}</b></button>)}</div></div>
}
function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
