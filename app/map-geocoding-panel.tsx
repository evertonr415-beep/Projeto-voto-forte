"use client";

import { useEffect, useState } from "react";
import {
  invalidateSharedTerritoryData,
  loadSharedMappedTerritoryContacts,
  loadSharedTerritorySummary,
} from "./territory-data-client";

type Progress = {
  total: number;
  mapped: number;
  pending: number;
};

type BatchResult = {
  updated?: number;
  remaining?: number;
  district?: string | null;
  processed?: number;
};

async function readProgress(force = false): Promise<Progress> {
  const [summary, mappedRecords] = await Promise.all([
    loadSharedTerritorySummary({ force }),
    loadSharedMappedTerritoryContacts({ force }),
  ]);
  const mapped = mappedRecords.length;

  return {
    total: summary.total,
    mapped,
    pending: Math.max(0, summary.total - mapped),
  };
}

export default function MapGeocodingPanel() {
  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    total: 0,
    mapped: 0,
    pending: 0,
  });
  const [message, setMessage] = useState("Abra o painel para verificar o mapeamento.");

  useEffect(() => {
    let cancelled = false;

    const refresh = async (force = false) => {
      setLoading(true);
      try {
        const next = await readProgress(force);
        if (cancelled) return;
        setProgress(next);
        setMessage(
          next.pending > 0
            ? `${next.pending.toLocaleString("pt-BR")} cadastro(s) ainda precisam ser mapeados.`
            : "Todos os cadastros disponíveis já estão mapeados.",
        );
      } catch {
        if (!cancelled)
          setMessage("Não foi possível verificar o mapeamento agora.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const handleToggle = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open?: boolean }>).detail?.open,
      );
      setVisible(open);
      if (open) void refresh(false);
    };

    const handleGeocodingComplete = () => {
      invalidateSharedTerritoryData();
      if (visible) void refresh(true);
    };

    window.addEventListener("voto-forte:geocoding-panel-toggle", handleToggle);
    window.addEventListener(
      "voto-forte:geocoding-complete",
      handleGeocodingComplete,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "voto-forte:geocoding-panel-toggle",
        handleToggle,
      );
      window.removeEventListener(
        "voto-forte:geocoding-complete",
        handleGeocodingComplete,
      );
    };
  }, [visible]);

  async function processMapping() {
    if (running) return;
    setRunning(true);
    let updatedTotal = 0;

    try {
      for (let batch = 0; batch < 20; batch += 1) {
        setMessage(`Processando lote ${batch + 1} de 20…`);
        const response = await fetch("/api/geocode-missing", {
          method: "POST",
          headers: { accept: "application/json" },
        });
        if (!response.ok) {
          setMessage("Não foi possível processar este lote. Tente novamente.");
          break;
        }

        const result = (await response.json()) as BatchResult;
        const updated = Number(result.updated || 0);
        updatedTotal += updated;
        setMessage(
          result.district
            ? `${result.district}: ${updated} alfinete(s) organizado(s).`
            : `${updated} alfinete(s) organizado(s).`,
        );

        if (
          Number(result.processed || 0) === 0 ||
          updated === 0 ||
          Number(result.remaining || 0) === 0
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }

      invalidateSharedTerritoryData();
      const next = await readProgress(true);
      setProgress(next);
      setMessage(
        next.pending > 0
          ? `${updatedTotal} novo(s) alfinete(s). Restam ${next.pending.toLocaleString("pt-BR")}.`
          : "Mapeamento concluído. Todos os cadastros disponíveis possuem alfinete.",
      );

      if (updatedTotal > 0) {
        window.dispatchEvent(
          new CustomEvent("voto-forte:geocoding-complete", {
            detail: { updated: updatedTotal },
          }),
        );
        window.dispatchEvent(new Event("voto-forte:records-changed"));
      }
    } catch {
      setMessage(
        "O processamento foi interrompido. Você pode retomar pelo mesmo botão.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (!visible) return null;

  const percentage = progress.total
    ? Math.round((progress.mapped / progress.total) * 100)
    : 0;

  return (
    <aside className="vf-map-progress" aria-live="polite">
      <div>
        <strong>Mapeamento dos cadastros</strong>
        <span>{loading ? "Atualizando…" : `${percentage}% concluído`}</span>
      </div>
      <div className="vf-map-progress-track">
        <i style={{ width: `${percentage}%` }} />
      </div>
      <small>
        {progress.mapped.toLocaleString("pt-BR")} de {progress.total.toLocaleString("pt-BR")} mapeados
      </small>
      <p>{message}</p>
      {progress.pending > 0 && (
        <button type="button" onClick={processMapping} disabled={running || loading}>
          {running ? "Mapeando bairros…" : "Iniciar ou retomar mapeamento"}
        </button>
      )}
    </aside>
  );
}
