"use client";

import { useEffect } from "react";

type ConnectionInfo = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithPerformanceHints = Navigator & {
  connection?: ConnectionInfo;
  deviceMemory?: number;
};

type PerformanceMode = "full" | "light";

const LIGHT_MODE_ATTRIBUTE = "data-vf-performance";

function initialPerformanceMode(): PerformanceMode {
  const nav = navigator as NavigatorWithPerformanceHints;
  const connection = nav.connection;
  let pressureScore = 0;

  if (connection?.saveData) pressureScore += 3;
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
    pressureScore += 3;
  } else if (connection?.effectiveType === "3g") {
    pressureScore += 1;
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) {
    pressureScore += 2;
  }
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) {
    pressureScore += 1;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pressureScore += 1;
  }

  return pressureScore >= 3 ? "light" : "full";
}

function publishMode(mode: PerformanceMode, reason: string) {
  document.documentElement.setAttribute(LIGHT_MODE_ATTRIBUTE, mode);
  window.dispatchEvent(
    new CustomEvent("voto-forte:performance-mode", {
      detail: { mode, reason },
    }),
  );
}

export default function AdaptivePerformance() {
  useEffect(() => {
    let mode = initialPerformanceMode();
    let longTaskDuration = 0;
    let observationStartedAt = performance.now();

    publishMode(mode, mode === "light" ? "device-or-network" : "normal");

    if (mode === "light" || typeof PerformanceObserver === "undefined") {
      return;
    }

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        const now = performance.now();
        if (now - observationStartedAt > 10_000) {
          observationStartedAt = now;
          longTaskDuration = 0;
        }

        for (const entry of list.getEntries()) {
          longTaskDuration += entry.duration;
        }

        if (longTaskDuration >= 1_200 && mode !== "light") {
          mode = "light";
          publishMode("light", "sustained-main-thread-pressure");
          observer?.disconnect();
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer?.disconnect();
      observer = null;
    }

    return () => observer?.disconnect();
  }, []);

  return null;
}
