"use client";

import { useEffect, useState } from "react";

type BoxSample = {
  top: number;
  height: number;
  paddingTop: string;
  marginTop: string;
};

type TraceSample = {
  frame: number;
  t: number;
  scrollY: number;
  scrollingTop: number;
  vvOffsetTop: number | null;
  vvPageTop: number | null;
  entering: boolean;
  active: boolean;
  dataLoaded: boolean;
  workspace: BoxSample | null;
  portal: BoxSample | null;
  optimized: BoxSample | null;
  hero: BoxSample | null;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function box(element: Element | null): BoxSample | null {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    top: round(rect.top),
    height: round(rect.height),
    paddingTop: style.paddingTop,
    marginTop: style.marginTop,
  };
}

function isContactsButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest<HTMLButtonElement>(".sidebar nav button");
  return button?.querySelector(".nav-name")?.textContent?.trim() === "Contatos";
}

function hasLoadedKpis(portal: HTMLElement | null) {
  if (!portal) return false;
  const values = Array.from(portal.querySelectorAll<HTMLElement>(".optimized-kpis b"))
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean);
  return values.length > 0 && values.some((value) => value !== "—" && value !== "-");
}

function changed(a: TraceSample, b: TraceSample) {
  const topChanged = (left: BoxSample | null, right: BoxSample | null) => {
    if (!left && !right) return false;
    if (!left || !right) return true;
    return (
      Math.abs(left.top - right.top) >= 0.5 ||
      left.paddingTop !== right.paddingTop ||
      left.marginTop !== right.marginTop
    );
  };

  return (
    Math.abs(a.scrollY - b.scrollY) >= 0.5 ||
    Math.abs(a.scrollingTop - b.scrollingTop) >= 0.5 ||
    Math.abs((a.vvOffsetTop ?? 0) - (b.vvOffsetTop ?? 0)) >= 0.5 ||
    Math.abs((a.vvPageTop ?? 0) - (b.vvPageTop ?? 0)) >= 0.5 ||
    a.entering !== b.entering ||
    a.active !== b.active ||
    a.dataLoaded !== b.dataLoaded ||
    topChanged(a.workspace, b.workspace) ||
    topChanged(a.portal, b.portal) ||
    topChanged(a.optimized, b.optimized) ||
    topChanged(a.hero, b.hero)
  );
}

function formatBox(label: string, value: BoxSample | null) {
  if (!value) return `${label}: --`;
  return `${label}: top${value.top} h${value.height} pt${value.paddingTop} mt${value.marginTop}`;
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
      let loadedFrame: number | null = null;

      setLines(["TRACE VERTICAL: aguardando indicadores..."]);

      const finish = () => {
        const changes = samples.filter((item, index) => {
          if (index === 0) return true;
          return changed(samples[index - 1], item);
        });
        const portalFirst = samples.find((item) => item.portal);
        const loaded = samples.find((item) => item.dataLoaded);
        const final = samples.at(-1)!;
        const compact = [samples[0], portalFirst, ...changes.slice(-8), loaded, final].filter(Boolean) as TraceSample[];
        const unique = compact.filter((item, index, array) => index === array.findIndex((other) => other.frame === item.frame));

        const output = [
          "TRACE VERTICAL",
          ...unique.flatMap((item) => [
            `f${item.frame} ${item.t}ms E${item.entering ? 1 : 0} A${item.active ? 1 : 0} D${item.dataLoaded ? 1 : 0} scroll${item.scrollY} root${item.scrollingTop} vvOff${item.vvOffsetTop ?? "--"} vvPage${item.vvPageTop ?? "--"}`,
            formatBox("ws", item.workspace),
            formatBox("portal", item.portal),
            formatBox("shell", item.optimized),
            formatBox("hero", item.hero),
          ]),
        ];

        setLines(output.slice(-34));
        running = false;
      };

      const sampleFrame = () => {
        const shell = document.querySelector<HTMLElement>(".app-shell");
        const workspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
        const portal = workspace?.querySelector<HTMLElement>(".vf-contacts-optimized-portal") ?? null;
        const optimized = portal?.querySelector<HTMLElement>(".optimized-shell") ?? null;
        const dataLoaded = hasLoadedKpis(portal);

        if (dataLoaded && loadedFrame == null) loadedFrame = frame;

        samples.push({
          frame,
          t: round(performance.now() - startedAt),
          scrollY: round(window.scrollY),
          scrollingTop: round(document.scrollingElement?.scrollTop || 0),
          vvOffsetTop: window.visualViewport ? round(window.visualViewport.offsetTop) : null,
          vvPageTop: window.visualViewport ? round(window.visualViewport.pageTop) : null,
          entering: Boolean(shell?.classList.contains("vf-contacts-entering")),
          active: Boolean(shell?.classList.contains("vf-contacts-active")),
          dataLoaded,
          workspace: box(workspace),
          portal: box(portal),
          optimized: box(optimized),
          hero: box(portal?.querySelector(".optimized-topbar") ?? null),
        });

        frame += 1;
        const enoughAfterLoad = loadedFrame != null && frame - loadedFrame >= 90;
        const timeout = frame >= 720;
        if (!enoughAfterLoad && !timeout) {
          raf = window.requestAnimationFrame(sampleFrame);
          return;
        }
        finish();
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
      aria-label="Diagnóstico vertical de Contatos"
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
      {lines.length ? lines.join("\n") : "TRACE VERTICAL: toque em Contatos"}
    </pre>
  );
}
