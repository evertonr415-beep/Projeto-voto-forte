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

function sameWidth(a: TraceSample, b: TraceSample) {
  const values = [
    [a.workspace?.width, b.workspace?.width],
    [a.portal?.width, b.portal?.width],
    [a.optimized?.width, b.optimized?.width],
    [a.visualWidth, b.visualWidth],
    [a.visualScale, b.visualScale],
  ];
  return values.every(([left, right]) => {
    if (left == null && right == null) return true;
    if (left == null || right == null) return false;
    return Math.abs(left - right) < 0.5;
  });
}

function formatBox(label: string, value: BoxSample | null) {
  if (!value) return `${label}: --`;
  return `${label}: x${value.x} w${value.width} p${value.paddingLeft}/${value.paddingRight}`;
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

      setLines(["TRACE CONTATOS: capturando..."]);

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
        };
        samples.push(sample);

        frame += 1;
        if (frame < 150) {
          raf = window.requestAnimationFrame(sampleFrame);
          return;
        }

        const changes: TraceSample[] = [];
        for (const current of samples) {
          const previous = changes.at(-1);
          if (!previous || !sameWidth(previous, current) || previous.entering !== current.entering || previous.active !== current.active || previous.hasWelcome !== current.hasWelcome) {
            changes.push(current);
          }
        }

        const start = samples[0];
        const portalFirst = samples.find((item) => item.portal);
        const enteringOff = samples.find((item, index) => index > 0 && !item.entering && samples[index - 1]?.entering);
        const final = samples.at(-1)!;
        const compact = [start, portalFirst, enteringOff, ...changes.slice(-4), final].filter(Boolean) as TraceSample[];
        const unique = compact.filter((item, index, array) => index === array.findIndex((other) => other.frame === item.frame));

        const output = [
          `TRACE CONTATOS | viewport ${final.innerWidth} | vv ${final.visualWidth ?? "--"} | scale ${final.visualScale ?? "--"}`,
          ...unique.flatMap((item) => [
            `f${item.frame} ${item.t}ms E${item.entering ? 1 : 0} A${item.active ? 1 : 0} V${item.hasWelcome ? 1 : 0}`,
            formatBox("ws", item.workspace),
            formatBox("portal", item.portal),
            formatBox("shell", item.optimized),
          ]),
        ];
        setLines(output.slice(-25));
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
      aria-label="Diagnóstico de geometria de Contatos"
      style={{
        position: "fixed",
        left: 6,
        right: 6,
        bottom: 72,
        zIndex: 2147483647,
        maxHeight: "38vh",
        overflow: "auto",
        margin: 0,
        padding: "8px 9px",
        borderRadius: 8,
        border: "1px solid rgba(56,189,248,.55)",
        background: "rgba(2,8,20,.93)",
        color: "#dff6ff",
        fontSize: 9,
        lineHeight: 1.28,
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {lines.length ? lines.join("\n") : "TRACE CONTATOS: toque em Contatos"}
    </pre>
  );
}
