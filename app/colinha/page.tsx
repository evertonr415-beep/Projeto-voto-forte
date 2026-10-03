"use client";

import { useMemo, useRef, useState } from "react";
import "./styles.css";

type Cargo = "Deputado Federal" | "Deputado Estadual" | "Senador 1" | "Senador 2" | "Governador" | "Presidente";
type Escolha = { cargo: Cargo; nome: string; numero: string };

const cargos: Cargo[] = ["Deputado Federal", "Deputado Estadual", "Senador 1", "Senador 2", "Governador", "Presidente"];
const iniciais: Record<Cargo, Escolha> = {
  "Deputado Federal": { cargo: "Deputado Federal", nome: "", numero: "" },
  "Deputado Estadual": { cargo: "Deputado Estadual", nome: "", numero: "" },
  "Senador 1": { cargo: "Senador 1", nome: "", numero: "" },
  "Senador 2": { cargo: "Senador 2", nome: "", numero: "" },
  Governador: { cargo: "Governador", nome: "", numero: "" },
  Presidente: { cargo: "Presidente", nome: "", numero: "" },
};

export default function ColinhaPage() {
  const [escolhas, setEscolhas] = useState(iniciais);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preenchidos = useMemo(() => cargos.filter((c) => escolhas[c].numero.trim()).length, [escolhas]);

  function atualizar(cargo: Cargo, campo: "nome" | "numero", valor: string) {
    setEscolhas((atual) => ({ ...atual, [cargo]: { ...atual[cargo], [campo]: campo === "numero" ? valor.replace(/\D/g, "").slice(0, 5) : valor } }));
  }

  function desenhar(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d"); if (!ctx) return null;
    const grad = ctx.createLinearGradient(0, 0, 0, 1920); grad.addColorStop(0, "#061c39"); grad.addColorStop(1, "#020b19");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#d6b451"; ctx.fillRect(0, 0, 1080, 12);
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "900 78px Arial"; ctx.fillText("VOTO FORTE", 540, 135);
    ctx.fillStyle = "#d6b451"; ctx.font = "700 34px Arial"; ctx.fillText("MINHA COLINHA", 540, 188);
    ctx.fillStyle = "#b8c4d5"; ctx.font = "28px Arial"; ctx.fillText("Leve seus números com você no dia da votação", 540, 245);
    cargos.forEach((cargo, i) => {
      const y = 330 + i * 235; const e = escolhas[cargo];
      ctx.fillStyle = "rgba(255,255,255,.07)"; roundRect(ctx, 70, y, 940, 185, 28); ctx.fill();
      ctx.textAlign = "left"; ctx.fillStyle = "#d6b451"; ctx.font = "700 27px Arial"; ctx.fillText(cargo.toUpperCase(), 110, y + 48);
      ctx.fillStyle = "#fff"; ctx.font = "800 43px Arial"; ctx.fillText((e.nome || "Escolha seu candidato").toUpperCase(), 110, y + 103);
      ctx.textAlign = "right"; ctx.font = "900 74px Arial"; ctx.fillText(e.numero || "—", 955, y + 118);
    });
    ctx.textAlign = "center"; ctx.fillStyle = "#9baabd"; ctx.font = "25px Arial"; ctx.fillText("Voto Forte • Colinha pessoal", 540, 1810);
    ctx.font = "20px Arial"; ctx.fillText("Confira os números oficiais antes de votar.", 540, 1850);
    return canvas;
  }

  function baixar() { const c = desenhar(); if (!c) return; const a = document.createElement("a"); a.download = "colinha-voto-forte.png"; a.href = c.toDataURL("image/png"); a.click(); }
  async function compartilhar() { const c = desenhar(); if (!c) return; const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png")); if (!blob) return; const file = new File([blob], "colinha-voto-forte.png", { type: "image/png" }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: "Minha Colinha - Voto Forte", files: [file] }); else baixar(); }

  return <main className="vf-colinha">
    <header className="vf-top"><div className="vf-brand"><span className="vf-mark">VF</span><div><strong>VOTO FORTE</strong><small>Gerador de Colinha</small></div></div><a href="/">Voltar ao Voto Forte</a></header>
    <section className="vf-hero"><span className="vf-pill">ELEIÇÕES</span><h1>Monte sua <em>colinha</em></h1><p>Preencha os nomes e números que você deseja lembrar. A prévia é atualizada para você gerar sua imagem.</p></section>
    <section className="vf-workspace">
      <div className="vf-form"><div className="vf-progress"><strong>{preenchidos} de {cargos.length}</strong><span>cargos preenchidos</span></div>{cargos.map((cargo) => <div className="vf-field" key={cargo}><label>{cargo}</label><div className="vf-inputs"><input aria-label={`Nome - ${cargo}`} placeholder="Nome do candidato" value={escolhas[cargo].nome} onChange={(e) => atualizar(cargo, "nome", e.target.value)} /><input className="vf-number" inputMode="numeric" aria-label={`Número - ${cargo}`} placeholder="Número" value={escolhas[cargo].numero} onChange={(e) => atualizar(cargo, "numero", e.target.value)} /></div></div>)}<div className="vf-actions"><button onClick={baixar}>Baixar PNG</button><button className="secondary" onClick={compartilhar}>Compartilhar</button></div></div>
      <div className="vf-preview-wrap"><div className="vf-preview"><div className="preview-head"><span>VOTO FORTE</span><b>MINHA COLINHA</b></div>{cargos.map((cargo) => <div className="preview-row" key={cargo}><div><small>{cargo}</small><strong>{escolhas[cargo].nome || "Seu candidato"}</strong></div><b>{escolhas[cargo].numero || "—"}</b></div>)}<footer>Confira os números oficiais antes de votar.</footer></div></div>
    </section><canvas ref={canvasRef} className="vf-hidden-canvas" />
  </main>;
}

function roundRect(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
