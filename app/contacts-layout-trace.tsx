"use client";

import { useEffect, useState } from "react";

type BoxSample = {
  x: number;
  width: number;
  paddingLeft: string;
  paddingRight: string;
  marginLeft: string;
  marginRight: string;
};

type TraceSample = {
  frame: number;
  t: number;
  innerWidth: number;
  visualWidth: number | null;
  visualScale: number | null;
  hasWelcome: boolean;
  entering: boolean;
  active: boolean;
  workspace: BoxSample | null;
  portal: BoxSample | null;
  optimized: BoxSample | null;
  hero: BoxSample | null;
  quick: BoxSample | null;
  overview: BoxSample | null;
  kpis: BoxSample | null;
  content: BoxSample | null;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function box(element: Element | null): BoxSample | null {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    x: round(rect.x),
    width: round(rect.width),
    paddingLeft: style.paddingLeft,
    paddingRight: style.paddingRight,
    marginLeft: style.marginLeft,
    marginRight: style.marginRight,
  };
}

function isContactsButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest<HTMLButtonElement>(".sidebar nav button");
  return button?.querySelector(".nav-name")?.textContent?.trim() === "Contatos";
}

function boxChanged(a: BoxSample | null, b: BoxSample | null) {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return (
    Math.abs(a.x - b.x) >= 0.5 ||
    Math.abs(a.width - b.width) >= 0.5 ||
    a.paddingLeft !== b.paddingLeft ||
    a.paddingRight !== b.paddingRight ||
    a.marginLeft !== b.marginLeft ||
    a.marginRight !== b.marginRight
  );
}

function sampleChanged(a: TraceSample, b: TraceSample) {
  return (
    Math.abs((a.visualWidth ?? 0) - (b.visualWidth ?? 0)) >= 0.5 ||
    Math.abs((a.visualScale ?? 0) - (b.visualScale ?? 0)) >= 0.01 ||
    a.entering !== b.entering ||
    a.active !== b.active ||
    a.hasWelcome !== b.hasWelcome ||
    boxChanged(a.workspace, b.workspace) ||
    boxChanged(a.portal, b.portal) ||
    boxChanged(a.optimized, b.optimized) ||
    boxChanged(a.hero, b.hero) ||
    boxChanged(a.quick, b.quick) ||
    boxChanged(a.overview, b.overview) ||
    boxChanged(a.kpis, b.kpis) ||
    boxChanged(a.content, b.content)
  );
}

function formatBox(label: string, value: BoxSample | null) {
  if (!value) return `${label}: --`;
  return `${label}: x${value.x} w${value.width} p${value.paddingLeft}/${value.paddingRight} m${value.marginLeft}/${value.marginRight}`;
}

export default function ContactsLayoutTrace() {
  const [lines, setLines] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("vfdebug") !== "contacts") return;
    setEnabled(true);

    let raf = 0;
    let running = false;

    const startTrace = () => {
      if (running) return;
      running = true;
      const startedAt = performance.now();
      const samples: TraceSample[] = [];
      let frame = 0;

      setLines(["TRACE CONTATOS: capturando elementos internos..."]);

      const sampleFrame = () => {
        const shell = document.querySelector<HTMLElement>(".app-shell");
        const workspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
        const portal = workspace?.querySelector<HTMLElement>(".vf-contacts-optimized-portal") ?? null;
        const optimized = portal?.querySelector<HTMLElement>(".optimized-shell") ?? null;

        const sample: TraceSample = {
          frame,
          t: round(performance.now() - startedAt),
          innerWidth: window.innerWidth,
          visualWidth: window.visualViewport ? round(window.visualViewport.width) : null,
          visualScale: window.visualViewport ? round(window.visualViewport.scale) : null,
          hasWelcome: Boolean(document.querySelector(".welcome-pro")),
          entering: Boolean(shell?.classList.contains("vf-contacts-entering")),
          active: Boolean(shell?.classList.contains("vf-contacts-active")),
          workspace: box(workspace),
          portal: box(portal),
          optimized: box(optimized),
          hero: box(portal?.querySelector(".optimized-topbar") ?? null),
          quick: box(portal?.querySelector(".optimized-quick-actions") ?? null),
          overview: box(portal?.querySelector(".optimized-overview") ?? null),
          kpis: box(portal?.querySelector(".optimized-kpis") ?? null),
          content: box(portal?.querySelector(".optimized-content") ?? null),
        };
        samples.push(sample);

        frame += 1;
        if (frame < 180) {
          raf = window.requestAnimationFrame(sampleFrame);
          return;
        }

        const changes = samples.filter((item, index) => {
          if (index === 0) return true;
          return sampleChanged(samples[index - 1], item);
        });

        const portalFirst = samples.find((item) => item.portal);
        const final = samples.at(-1)!;
        const compact = [samples[0], portalFirst, ...changes.slice(-6), final].filter(Boolean) as TraceSample[];
        const unique = compact.filter((item, index, array) => index === array.findIndex((other) => other.frame === item.frame));

        const output = [
          `TRACE INTERNO | viewport ${final.innerWidth} | vv ${final.visualWidth ?? "--"} | scale ${final.visualScale ?? "--"}`,
          ...unique.flatMap((item) => [
            `f${item.frame} ${item.t}ms E${item.entering ? 1 : 0} A${item.active ? 1 : 0} V${item.hasWelcome ? 1 : 0}`,
            formatBox("ws", item.workspace),
            formatBox("shell", item.optimized),
            formatBox("hero", item.hero),
            formatBox("quick", item.quick),
            formatBox("kpis", item.kpis),
            formatBox("content", item.content),
          ]),
        ];
        setLines(output.slice(-34));
        running = false;
      };

      sampleFrame();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isContactsButton(event.target)) startTrace();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <pre
      aria-label="Diagnóstico interno de geometria de Contatos"
      style={{
        position: "fixed",
        left: 6,
        right: 6,
        bottom: 72,
        zIndex: 2147483647,
        maxHeight: "46vh",
        overflow: "auto",
        margin: 0,
        padding: "8px 9px",
        borderRadius: 8,
        border: "1px solid rgba(56,189,248,.55)",
        background: "rgba(2,8,20,.93)",
        color: "#dff6ff",
        fontSize: 8,
        lineHeight: 1.22,
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {lines.length ? lines.join("\n") : "TRACE CONTATOS: toque em Contatos"}
    </pre>
  );
}
