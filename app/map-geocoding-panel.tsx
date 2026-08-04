"use client";

import { useEffect, useState } from "react";

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

function isMapView() {
  const heading = Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((element) => element.textContent?.trim().toLowerCase() || "")
    .some((text) => text.includes("mapa eleitoral") || text.includes("mapa real"));
  return heading || Boolean(document.querySelector(".leaflet-container"));
}

async function readProgress(): Promise<Progress> {
  const response = await fetch("/api/records?owner=all", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return { total: 0, mapped: 0, pending: 0 };
  const data = (await response.json()) as {
    records?: Array<{
      kind?: string;
      payload?: { latitude?: number; longitude?: number };
    }>;
  };
  const contacts = (data.records || []).filter((record) => record.kind === "contact");
  const mapped = contacts.filter(
    (record) =>
      Number.isFinite(Number(record.payload?.latitude)) &&
      Number.isFinite(Number(record.payload?.longitude)),
  ).length;
  return { total: contacts.length, mapped, pending: Math.max(0, contacts.length - mapped) };
}

export default function MapGeocodingPanel() {
  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress>({ total: 0, mapped: 0, pending: 0 });
  const [message, setMessage] = useState("Verificando cadastros do mapa…");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const onMap = isMapView();
      setVisible(onMap);
      if (!onMap) return;
      const next = await readProgress();
      if (cancelled) return;
      setProgress(next);
      setMessage(
        next.pending > 0
          ? `${next.pending.toLocaleString("pt-BR")} cadastro(s) ainda precisam ser mapeados.`
          : "Todos os cadastros disponíveis já estão mapeados.",
      );
    };
    const observer = new MutationObserver(() => void refresh());
    observer.observe(document.body, { childList: true, subtree: true });
    void refresh();
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

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

        if (Number(result.processed || 0) === 0 || updated === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 1400));
      }

      const next = await readProgress();
      setProgress(next);
      setMessage(
        next.pending > 0
          ? `${updatedTotal} novo(s) alfinete(s). Restam ${next.pending.toLocaleString("pt-BR")}.`
          : "Mapeamento concluído. Todos os cadastros disponíveis possuem alfinete.",
      );
      if (updatedTotal > 0) window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setMessage("O processamento foi interrompido. Você pode retomar pelo mesmo botão.");
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
        <span>{percentage}% concluído</span>
      </div>
      <div className="vf-map-progress-track">
        <i style={{ width: `${percentage}%` }} />
      </div>
      <small>
        {progress.mapped.toLocaleString("pt-BR")} de {progress.total.toLocaleString("pt-BR")} mapeados
      </small>
      <p>{message}</p>
      {progress.pending > 0 && (
        <button type="button" onClick={processMapping} disabled={running}>
          {running ? "Mapeando bairros…" : "Iniciar ou retomar mapeamento"}
        </button>
      )}
    </aside>
  );
}
