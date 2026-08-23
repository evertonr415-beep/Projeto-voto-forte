"use client";

import { useEffect, useState } from "react";

type Box = {
  top: number;
  height: number;
  width: number;
  paddingTop: string;
  paddingBottom: string;
  marginTop: string;
  transform: string;
};

type Sample = {
  frame: number;
  t: number;
  scrollY: number;
  shellClass: string;
  workspaceClass: string;
  workspace: Box | null;
  portal: Box | null;
  optimized: Box | null;
  hero: Box | null;
  dataLoaded: boolean;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function box(element: Element | null): Box | null {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    top: round(rect.top),
    height: round(rect.height),
    width: round(rect.width),
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    marginTop: style.marginTop,
    transform: style.transform,
  };
}

function isContactsButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest<HTMLButtonElement>(".sidebar nav button");
  return button?.querySelector(".nav-name")?.textContent?.trim() === "Contatos";
}

function hasLoadedKpis(portal: HTMLElement | null) {
  if (!portal) return false;
  return Array.from(portal.querySelectorAll<HTMLElement>(".optimized-kpis b"))
    .map((node) => node.textContent?.trim() || "")
    .some((value) => value && value !== "—" && value !== "-");
}

function boxChanged(a: Box | null, b: Box | null) {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return (
    Math.abs(a.top - b.top) >= 0.5 ||
    Math.abs(a.height - b.height) >= 0.5 ||
    Math.abs(a.width - b.width) >= 0.5 ||
    a.paddingTop !== b.paddingTop ||
    a.paddingBottom !== b.paddingBottom ||
    a.marginTop !== b.marginTop ||
    a.transform !== b.transform
  );
}

function changed(a: Sample, b: Sample) {
  return (
    Math.abs(a.scrollY - b.scrollY) >= 0.5 ||
    a.shellClass !== b.shellClass ||
    a.workspaceClass !== b.workspaceClass ||
    a.dataLoaded !== b.dataLoaded ||
    boxChanged(a.workspace, b.workspace) ||
    boxChanged(a.portal, b.portal) ||
    boxChanged(a.optimized, b.optimized) ||
    boxChanged(a.hero, b.hero)
  );
}

function fmt(label: string, value: Box | null) {
  if (!value) return `${label}: --`;
  return `${label}: top${value.top} h${value.height} w${value.width} pt${value.paddingTop} pb${value.paddingBottom} mt${value.marginTop} tr${value.transform}`;
}

export default function ContactsCurrentStateTrace() {
  const [enabled, setEnabled] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("vfdebug") !== "current") return;
    setEnabled(true);

    let raf = 0;
    let running = false;

    const start = () => {
      if (running) return;
      running = true;
      const startedAt = performance.now();
      const samples: Sample[] = [];
      let frame = 0;
      let loadedFrame: number | null = null;
      setLines(["TRACE ATUAL: capturando..."]);

      const finish = () => {
        const changes = samples.filter((item, index) => index === 0 || changed(samples[index - 1], item));
        const portalFirst = samples.find((item) => item.portal);
        const loaded = samples.find((item) => item.dataLoaded);
        const final = samples.at(-1)!;
        const compact = [samples[0], portalFirst, ...changes.slice(-10), loaded, final].filter(Boolean) as Sample[];
        const unique = compact.filter((item, index, all) => index === all.findIndex((other) => other.frame === item.frame));

        setLines([
          "TRACE ATUAL",
          ...unique.flatMap((item) => [
            `f${item.frame} ${item.t}ms D${item.dataLoaded ? 1 : 0} scroll${item.scrollY}`,
            `shell:${item.shellClass}`,
            `wsclass:${item.workspaceClass}`,
            fmt("ws", item.workspace),
            fmt("portal", item.portal),
            fmt("opt", item.optimized),
            fmt("hero", item.hero),
          ]),
        ].slice(-42));
        running = false;
      };

      const sample = () => {
        const shell = document.querySelector<HTMLElement>(".app-shell");
        const workspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
        const portal = workspace?.querySelector<HTMLElement>(".vf-contacts-optimized-portal") ?? null;
        const optimized = portal?.querySelector<HTMLElement>(".optimized-shell") ?? null;
        const loaded = hasLoadedKpis(portal);
        if (loaded && loadedFrame == null) loadedFrame = frame;

        samples.push({
          frame,
          t: round(performance.now() - startedAt),
          scrollY: round(window.scrollY),
          shellClass: shell?.className || "",
          workspaceClass: workspace?.className || "",
          workspace: box(workspace),
          portal: box(portal),
          optimized: box(optimized),
          hero: box(portal?.querySelector(".optimized-topbar") ?? null),
          dataLoaded: loaded,
        });

        frame += 1;
        if ((loadedFrame == null || frame - loadedFrame < 120) && frame < 720) {
          raf = window.requestAnimationFrame(sample);
          return;
        }
        finish();
      };

      sample();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (isContactsButton(event.target)) start();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <pre
      style={{
        position: "fixed",
        left: 6,
        right: 6,
        bottom: 72,
        zIndex: 2147483647,
        maxHeight: "52vh",
        overflow: "auto",
        margin: 0,
        padding: "8px 9px",
        border: "1px solid rgba(56,189,248,.65)",
        borderRadius: 8,
        background: "rgba(2,8,20,.94)",
        color: "#dff6ff",
        fontSize: 7.5,
        lineHeight: 1.2,
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {lines.length ? lines.join("\n") : "TRACE ATUAL: toque em Contatos"}
    </pre>
  );
}
