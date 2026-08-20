"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../supabase-client";

type ContactExport = {
  id: string;
  actorEmail: string;
  ownerScope: string;
  format: string;
  itemCount: number;
  createdAt: string;
};

function formatLabel(value: string) {
  if (value === "xlsx") return "Excel";
  return value.toUpperCase();
}

export default function ExportHistoryClient() {
  const router = useRouter();
  const [items, setItems] = useState<ContactExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/contact-exports", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.status === 401) {
        router.replace("/contatos");
        return;
      }
      if (!response.ok)
        throw new Error(data.error || "Não foi possível carregar as exportações.");
      setItems(Array.isArray(data.exports) ? data.exports : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar as exportações.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="vf-export-page">
      <header className="vf-export-page-head">
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <img
            src="/voto-forte-bandeira-icon.jpg"
            alt="VOTO FORTE PARANÁ"
            style={{ width: "54px", height: "42px", objectFit: "cover", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", flexShrink: 0 }}
          />
          <div>
            <small>CONTROLE DE EXPORTAÇÕES</small>
            <h1>Histórico de exportações</h1>
            <p>
              Abra um lote para consultar exatamente quais contatos participaram da
              exportação e executar ações individuais com segurança.
            </p>
          </div>
        </div>
        <div className="vf-export-page-actions">
          <button
            type="button"
            className="vf-back-dashboard-btn"
            onClick={() => router.push("/sistema-completo")}
            title="Voltar ao Dashboard Principal"
          >
            <span className="vf-back-arrow" aria-hidden="true">←</span>
            <span>Voltar ao Sistema</span>
          </button>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </header>

      <section className="vf-export-info" aria-label="Informação sobre o histórico">
        <b>Rastreabilidade a partir desta versão</b>
        <p>
          Exportações antigas não podem ser reconstruídas com precisão porque o
          sistema anterior não armazenava os contatos de cada lote. As novas
          exportações ficam registradas daqui em diante.
        </p>
      </section>

      {error ? <div className="vf-export-error" role="alert">{error}</div> : null}

      <section className="vf-export-history-card" aria-busy={loading}>
        <div className="vf-export-section-title">
          <div>
            <small>LOTES REGISTRADOS</small>
            <h2>Exportações recentes</h2>
          </div>
          <span>{items.length} lote(s)</span>
        </div>

        {loading && !items.length ? (
          <p className="vf-export-empty">Carregando exportações…</p>
        ) : items.length ? (
          <div className="vf-export-history-list">
            {items.map((item) => (
              <button
                type="button"
                className="vf-export-history-row"
                key={item.id}
                onClick={() => router.push(`/exportacoes/${item.id}`)}
              >
                <span className="vf-export-format">{formatLabel(item.format)}</span>
                <span className="vf-export-history-main">
                  <b>{item.actorEmail}</b>
                  <small>
                    {new Date(item.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                    {" · "}
                    {item.ownerScope === "all"
                      ? "Todos os ambientes permitidos"
                      : item.ownerScope}
                  </small>
                </span>
                <strong>{item.itemCount.toLocaleString("pt-BR")} contatos</strong>
                <span className="vf-export-open">Abrir lote →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="vf-export-empty">Nenhuma exportação registrada ainda.</p>
        )}
      </section>
    </main>
  );
}
