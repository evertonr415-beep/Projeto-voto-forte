"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
};

const ELECTION_DATE = new Date("2026-10-04T08:00:00-03:00").getTime();
const ZERO_COUNTDOWN: Countdown = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isPast: false,
};

function calculateCountdown(): Countdown {
  const diff = ELECTION_DATE - Date.now();
  if (diff <= 0) {
    return { ...ZERO_COUNTDOWN, isPast: true };
  }

  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    isPast: false,
  };
}

export default function ElectionCountdownEnhancer() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [countdown, setCountdown] = useState<Countdown>(ZERO_COUNTDOWN);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    let generatedHost: HTMLElement | null = null;
    let rootObserver: MutationObserver | null = null;
    let frameId = 0;

    const attach = () => {
      const topbar = document.querySelector<HTMLElement>(".ae-topbar");
      const root = topbar?.closest<HTMLElement>(".ae-root") || null;
      if (!topbar || !root) return;

      let target = document.getElementById("vf-election-countdown-host") as HTMLElement | null;
      if (!target) {
        target = document.createElement("div");
        target.id = "vf-election-countdown-host";
        target.className = "vf-election-countdown-host";
        topbar.insertAdjacentElement("afterend", target);
        generatedHost = target;
      }

      setHost((current) => (current === target ? current : target));
      setIsLight(root.classList.contains("light-mode"));

      if (!rootObserver) {
        rootObserver = new MutationObserver(() => {
          setIsLight(root.classList.contains("light-mode"));
        });
        rootObserver.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
      }
    };

    attach();
    const observer = new MutationObserver(() => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        attach();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      rootObserver?.disconnect();
      generatedHost?.remove();
    };
  }, []);

  useEffect(() => {
    const update = () => setCountdown(calculateCountdown());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!host) return null;

  const labelColor = isLight ? "#64748b" : "#94a3b8";
  const units = [
    {
      label: "DIAS",
      value: countdown.days,
      color: isLight ? "#0284c7" : "#38bdf8",
      background: isLight ? "rgba(2,132,199,.08)" : "rgba(2,132,199,.15)",
      border: "rgba(56,189,248,.3)",
    },
    {
      label: "HORAS",
      value: countdown.hours,
      color: "#d4ab64",
      background: isLight ? "rgba(212,171,100,.10)" : "rgba(212,171,100,.12)",
      border: "rgba(212,171,100,.35)",
    },
    {
      label: "MINUTOS",
      value: countdown.minutes,
      color: "#d4ab64",
      background: isLight ? "rgba(212,171,100,.10)" : "rgba(212,171,100,.12)",
      border: "rgba(212,171,100,.35)",
    },
    {
      label: "SEGUNDOS",
      value: countdown.seconds,
      color: isLight ? "#16a34a" : "#22c55e",
      background: isLight ? "rgba(22,163,74,.08)" : "rgba(22,163,74,.15)",
      border: "rgba(34,197,94,.35)",
    },
  ];

  return createPortal(
    <section
      className="ae-election-countdown"
      aria-label="Contagem regressiva oficial para as Eleições 2026"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        background: isLight
          ? "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)"
          : "linear-gradient(135deg, rgba(12,28,52,.96) 0%, rgba(7,18,36,.98) 100%)",
        border: isLight
          ? "1px solid rgba(212,171,100,.5)"
          : "1px solid rgba(212,171,100,.38)",
        borderRadius: 14,
        padding: "12px 20px",
        margin: "0 0 16px",
        boxShadow: isLight
          ? "0 4px 16px rgba(0,0,0,.06), 0 0 12px rgba(212,171,100,.15)"
          : "0 10px 28px rgba(0,0,0,.4), 0 0 16px rgba(212,171,100,.12)",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "linear-gradient(90deg, #0284c7 0%, #d4ab64 50%, #16a34a 100%)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 260 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: 20,
            background: isLight ? "rgba(212,171,100,.15)" : "rgba(212,171,100,.12)",
            border: "1px solid rgba(212,171,100,.35)",
            fontSize: ".74rem",
            fontWeight: 800,
            color: isLight ? "#92400e" : "#d4ab64",
            letterSpacing: ".05em",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: countdown.isPast ? "#94a3b8" : "#22c55e",
              boxShadow: countdown.isPast ? "none" : "0 0 8px #22c55e",
            }}
          />
          <span>ELEIÇÕES 2026 • 1º TURNO</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: "1.02rem", fontWeight: 800, color: isLight ? "#0f172a" : "#fff" }}>
            🗳️ Votação Geral: <strong style={{ color: "#d4ab64" }}>04 de Outubro de 2026</strong>
          </div>
          <span style={{ fontSize: ".78rem", color: labelColor }}>
            Abertura oficial das urnas em todo o Paraná às 08h00 (Horário de Brasília)
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {units.map((unit, index) => (
          <React.Fragment key={unit.label}>
            {index > 0 && (
              <span style={{ fontSize: "1.1rem", fontWeight: 900, color: isLight ? "#94a3b8" : "rgba(255,255,255,.3)" }}>
                :
              </span>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 62,
                padding: "6px 10px",
                borderRadius: 10,
                background: unit.background,
                border: `1px solid ${unit.border}`,
              }}
            >
              <span
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 900,
                  color: unit.color,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(unit.value).padStart(2, "0")}
              </span>
              <span style={{ fontSize: ".65rem", fontWeight: 800, color: labelColor, letterSpacing: ".06em", marginTop: 3 }}>
                {unit.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>,
    host,
  );
}
