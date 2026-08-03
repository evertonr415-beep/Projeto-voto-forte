"use client";

import { useEffect } from "react";

function numberFrom(element: Element | null) {
  const value = Number(element?.textContent?.trim() || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function ReportsSimplifier() {
  useEffect(() => {
    const enhance = () => {
      const grid = document.querySelector<HTMLElement>(".report-grid");
      if (!grid || grid.dataset.vfSimplified === "true") return;

      const coverage = grid.querySelector<HTMLElement>(".coverage-card");
      const chart = grid.querySelector<HTMLElement>(".chart-card");
      if (!coverage || !chart) return;

      const total = numberFrom(coverage.querySelector(".donut b"));
      const values = Array.from(coverage.querySelectorAll("li b")).map((item) =>
        numberFrom(item),
      );
      const voters = values[0] || 0;
      const leaders = values[1] || 0;
      const districts = values[2] || 0;
      const baseTotal = Math.max(1, voters + leaders);
      const voterPercent = Math.round((voters / baseTotal) * 100);
      const leaderPercent = Math.round((leaders / baseTotal) * 100);

      grid.dataset.vfSimplified = "true";
      chart.classList.add("vf-report-summary");
      chart.innerHTML = `
        <div class="vf-report-heading">
          <small>RESUMO DO AMBIENTE</small>
          <h3>Visão rápida da campanha</h3>
          <p>Os números principais, apresentados de forma simples.</p>
        </div>
        <div class="vf-report-kpis">
          <article><span>👥</span><div><small>Total de contatos</small><b>${total}</b></div></article>
          <article><span>●</span><div><small>Eleitores</small><b>${voters}</b></div></article>
          <article><span>★</span><div><small>Lideranças</small><b>${leaders}</b></div></article>
          <article><span>⌖</span><div><small>Bairros alcançados</small><b>${districts}</b></div></article>
        </div>
      `;

      coverage.classList.add("vf-report-composition");
      coverage.innerHTML = `
        <div class="vf-report-heading">
          <small>COMPOSIÇÃO DA BASE</small>
          <h3>Quem faz parte da campanha</h3>
          <p>Comparação direta entre eleitores e lideranças.</p>
        </div>
        <div class="vf-composition-row">
          <div class="vf-composition-label"><span>Eleitores</span><b>${voters}</b></div>
          <div class="vf-progress"><i style="width:${voterPercent}%"></i></div>
          <small>${voterPercent}% da base cadastrada</small>
        </div>
        <div class="vf-composition-row leadership">
          <div class="vf-composition-label"><span>Lideranças</span><b>${leaders}</b></div>
          <div class="vf-progress"><i style="width:${leaderPercent}%"></i></div>
          <small>${leaderPercent}% da base cadastrada</small>
        </div>
        <div class="vf-report-note">
          <b>${districts}</b>
          <span>bairros possuem presença cadastrada neste ambiente.</span>
        </div>
      `;
    };

    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
    return () => observer.disconnect();
  }, []);

  return null;
}
