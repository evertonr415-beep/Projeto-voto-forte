"use client";

import { useEffect } from "react";

const SESSION_KEY = "voto-forte:legacy-geocoding-ran-v2";

export default function LegacyContactGeocoder() {
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const isMapView = () => {
      const heading = Array.from(document.querySelectorAll("h1, h2, h3"))
        .map((element) => element.textContent?.trim().toLowerCase() || "")
        .some(
          (text) =>
            text.includes("mapa eleitoral") || text.includes("mapa real"),
        );
      return heading || Boolean(document.querySelector(".leaflet-container"));
    };

    const updateProgress = (message: string) => {
      const target = document.querySelector(".real-map-toolbar strong");
      if (target) target.textContent = message;
    };

    const run = async () => {
      if (running || cancelled || !isMapView()) return;
      if (sessionStorage.getItem(SESSION_KEY) === "true") return;

      running = true;
      let totalUpdated = 0;

      try {
        for (let batch = 0; batch < 20; batch += 1) {
          if (cancelled) break;
          updateProgress(
            `Organizando alfinetes por bairro · lote ${batch + 1} de 20`,
          );

          const response = await fetch("/api/geocode-missing", {
            method: "POST",
            headers: { accept: "application/json" },
          });
          if (!response.ok) break;

          const result = (await response.json()) as {
            updated?: number;
            processed?: number;
            remaining?: number;
            district?: string | null;
          };
          const updated = Number(result.updated || 0);
          const processed = Number(result.processed || 0);
          const remaining = Number(result.remaining || 0);
          totalUpdated += updated;

          if (result.district) {
            updateProgress(
              `${result.district} · ${updated} alfinete(s) organizados · ${remaining} pendente(s)`,
            );
          }

          if (processed === 0 || updated === 0 || remaining === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 1400));
        }

        sessionStorage.setItem(SESSION_KEY, "true");
        if (totalUpdated > 0 && !cancelled) {
          window.dispatchEvent(
            new CustomEvent("voto-forte:geocoding-complete", {
              detail: { updated: totalUpdated },
            }),
          );
          updateProgress(
            `${totalUpdated} contato(s) organizados no mapa · atualizando visualização`,
          );
          window.setTimeout(() => window.location.reload(), 900);
        }
      } catch {
        updateProgress(
          "Mapa ativo · alguns bairros continuarão sendo processados no próximo acesso",
        );
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
