"use client";

import { useEffect, useState } from "react";

type RuleHit = {
  source: string;
  selector: string;
  padding: string;
};

type Snapshot = {
  label: string;
  frame: number;
  t: number;
  className: string;
  top: number;
  height: number;
  paddingTop: string;
  paddingBottom: string;
  scrollY: number;
  sheets: number;
  rules: RuleHit[];
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function isContactsButton(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const button = element?.closest<HTMLButtonElement>(".sidebar nav button");
  return button?.querySelector(".nav-name")?.textContent?.trim() === "Contatos";
}

function sheetSource(sheet: CSSStyleSheet) {
  if (sheet.href) {
    try {
      const url = new URL(sheet.href);
      return url.pathname.split("/").pop() || url.pathname;
    } catch {
      return sheet.href;
    }
  }

  const owner = sheet.ownerNode;
  if (owner instanceof HTMLElement) {
    return (
      owner.getAttribute("data-n-href") ||
      owner.getAttribute("data-href") ||
      owner.getAttribute("data-precedence") ||
      (owner.id ? `#${owner.id}` : owner.tagName.toLowerCase())
    );
  }
  return "inline";
}

function collectRules(
  rules: CSSRuleList,
  element: HTMLElement,
  source: string,
  output: RuleHit[],
) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      if (window.matchMedia(rule.conditionText).matches) {
        collectRules(rule.cssRules, element, source, output);
      }
      continue;
    }

    if (rule instanceof CSSStyleRule) {
      let matches = false;
      try {
        matches = element.matches(rule.selectorText);
      } catch {
        matches = false;
      }
      if (!matches) continue;

      const style = rule.style;
      const relevant = [
        "padding",
        "padding-top",
        "padding-bottom",
        "padding-block",
        "padding-block-start",
        "padding-block-end",
      ].filter((name) => style.getPropertyValue(name));
      if (!relevant.length) continue;

      output.push({
        source,
        selector: rule.selectorText,
        padding: relevant
          .map((name) => {
            const value = style.getPropertyValue(name).trim();
            const priority = style.getPropertyPriority(name) ? " !important" : "";
            return `${name}:${value}${priority}`;
          })
          .join(";"),
      });
      continue;
    }

    const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
    if (nested) collectRules(nested, element, source, output);
  }
}

function matchedPaddingRules(element: HTMLElement) {
  const output: RuleHit[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectRules(sheet.cssRules, element, sheetSource(sheet), output);
    } catch {
      // Folhas sem acesso via CSSOM nao participam do diagnostico textual.
    }
  }
  return output;
}

function takeSnapshot(label: string, frame: number, startedAt: number, workspace: HTMLElement): Snapshot {
  const rect = workspace.getBoundingClientRect();
  const style = window.getComputedStyle(workspace);
  return {
    label,
    frame,
    t: round(performance.now() - startedAt),
    className: workspace.className,
    top: round(rect.top),
    height: round(rect.height),
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    scrollY: round(window.scrollY),
    sheets: document.styleSheets.length,
    rules: matchedPaddingRules(workspace),
  };
}

function formatSnapshot(snapshot: Snapshot) {
  const importantRules = snapshot.rules
    .filter((rule) =>
      rule.selector.includes("workspace") ||
      rule.selector.includes("contacts") ||
      rule.padding.includes("!important"),
    )
    .slice(-12);

  return [
    `${snapshot.label} f${snapshot.frame} ${snapshot.t}ms sheets${snapshot.sheets}`,
    `class:${snapshot.className}`,
    `computed: top${snapshot.top} h${snapshot.height} pt${snapshot.paddingTop} pb${snapshot.paddingBottom} scroll${snapshot.scrollY}`,
    ...importantRules.flatMap((rule, index) => [
      `${index + 1}. ${rule.source}`,
      `   ${rule.selector}`,
      `   ${rule.padding}`,
    ]),
  ];
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
      let frame = 0;
      let early: Snapshot | null = null;
      let finalState: Snapshot | null = null;
      setLines(["TRACE CSS: aguardando estado 0px -> 12px..."]);

      const sample = () => {
        const shell = document.querySelector<HTMLElement>(".app-shell");
        const workspace = shell?.querySelector<HTMLElement>(".workspace") ?? null;
        const portal = workspace?.querySelector<HTMLElement>(".vf-contacts-optimized-portal") ?? null;

        if (workspace && portal) {
          const style = window.getComputedStyle(workspace);
          if (!early && style.paddingTop === "0px") {
            early = takeSnapshot("ESTADO INICIAL", frame, startedAt, workspace);
          }
          if (early && !finalState && style.paddingTop === "12px") {
            finalState = takeSnapshot("ESTADO FINAL", frame, startedAt, workspace);
            setLines([
              ...formatSnapshot(early),
              "----------------",
              ...formatSnapshot(finalState),
            ].slice(-46));
            running = false;
            return;
          }
        }

        frame += 1;
        if (frame < 720) {
          raf = window.requestAnimationFrame(sample);
          return;
        }

        if (early) {
          setLines(formatSnapshot(early).slice(-42));
        } else {
          setLines(["TRACE CSS: nao capturou o estado inicial de 0px."]);
        }
        running = false;
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
        maxHeight: "55vh",
        overflow: "auto",
        margin: 0,
        padding: "8px 9px",
        border: "1px solid rgba(56,189,248,.65)",
        borderRadius: 8,
        background: "rgba(2,8,20,.95)",
        color: "#dff6ff",
        fontSize: 7,
        lineHeight: 1.18,
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {lines.length ? lines.join("\n") : "TRACE CSS: toque em Contatos"}
    </pre>
  );
}
