"use client";

import { useEffect } from "react";

export default function LegacyContactGeocoder() {
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const updateProgress = (message: string) => {
      const target = document.querySelector(".real-map-toolbar strong");
      if (target) target.textContent = message;
    };

    const run = async () => {
      if (running || cancelled) return;
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

        if (totalUpdated > 0 && !cancelled) {
          window.dispatchEvent(
            new CustomEvent("voto-forte:geocoding-complete", {
              detail: { updated: totalUpdated },
            }),
          );
          updateProgress(
            `${totalUpdated} contato(s) organizados no mapa · dados atualizados`,
          );
        }
      } catch {
        updateProgress(
          "Mapa ativo · não foi possível concluir a organização automática agora",
        );
      } finally {
        running = false;
      }
    };

    const handleRun = () => void run();
    window.addEventListener("voto-forte:legacy-geocoding-run", handleRun);

    return () => {
      cancelled = true;
      window.removeEventListener("voto-forte:legacy-geocoding-run", handleRun);
    };
  }, []);

  return null;
}
