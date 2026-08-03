"use client";

import { useEffect } from "react";

const SESSION_KEY = "voto-forte:legacy-geocoding-ran";

export default function LegacyContactGeocoder() {
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const isMapView = () => {
      const heading = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((element) => element.textContent?.trim().toLowerCase() || "")
        .some((text) => text.includes("mapa eleitoral") || text.includes("mapa real"));
      return heading || Boolean(document.querySelector(".leaflet-container"));
    };

    const run = async () => {
      if (running || cancelled || !isMapView()) return;
      if (sessionStorage.getItem(SESSION_KEY) === "true") return;

      running = true;
      let totalUpdated = 0;

      try {
        for (let batch = 0; batch < 5; batch += 1) {
          const response = await fetch("/api/geocode-missing", {
            method: "POST",
            headers: { accept: "application/json" },
          });
          if (!response.ok) break;

          const result = (await response.json()) as {
            updated?: number;
            processed?: number;
          };
          const updated = Number(result.updated || 0);
          const processed = Number(result.processed || 0);
          totalUpdated += updated;

          if (processed === 0 || updated === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 1300));
        }

        sessionStorage.setItem(SESSION_KEY, "true");
        if (totalUpdated > 0 && !cancelled) {
          window.dispatchEvent(
            new CustomEvent("voto-forte:geocoding-complete", {
              detail: { updated: totalUpdated },
            }),
          );
          window.setTimeout(() => window.location.reload(), 700);
        }
      } catch {
        // O mapa continua funcionando mesmo se a recuperação automática falhar.
      } finally {
        running = false;
      }
    };

    const observer = new MutationObserver(() => void run());
    observer.observe(document.body, { childList: true, subtree: true });
    void run();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
