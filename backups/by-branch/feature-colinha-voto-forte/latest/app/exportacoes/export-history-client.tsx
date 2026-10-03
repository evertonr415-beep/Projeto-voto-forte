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

  const [backingUp, setBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");

  const handlePerformBackup = async () => {
    setBackingUp(true);
    setBackupMessage("");
    try {
      const res = await apiFetch("/api/contacts?limit=5000");
      const data = await res.json();
      const contacts = Array.isArray(data.contacts) ? data.contacts : [];

      const backupPackage = {
        format: "voto-forte-user-backup",
        version: "1.0",
        generatedAt: new Date().toISOString(),
        totalContacts: contacts.length,
        contacts,
        exportsHistory: items,
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      const timeStr = new Date().toTimeString().slice(0, 5).replace(":", "");
      const blob = new Blob([JSON.stringify(backupPackage, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `VotoForte-Backup-Meus-Dados-${dateStr}-${timeStr}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setBackupMessage(
        `✅ Backup realizado com sucesso! (${contacts.length} contatos salvos no arquivo baixado)`,
      );
      setTimeout(() => setBackupMessage(""), 6000);
    } catch {
      setBackupMessage("❌ Erro ao gerar o arquivo de backup.");
    } finally {
      setBackingUp(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="vf-export-page">
      <header className="vf-export-page-head">
        <div>
          <small>CONTROLE DE EXPORTAÇÕES</small>
          <p>
            Consulte os lotes exportados, veja quais contatos participaram e mantenha
            uma cópia segura dos seus dados.
          </p>
        </div>

        <div className="vf-export-page-actions">
          <button
            type="button"
            className="vf-btn-perform-backup"
            onClick={handlePerformBackup}
            disabled={backingUp}
            title="Realizar backup dos seus dados e baixar arquivo"
          >
            {backingUp ? "⏳ Gerando backup…" : "💾 Realizar backup"}
          </button>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </header>

      {backupMessage && (
        <div className="vf-backup-toast" role="status">
          {backupMessage}
        </div>
      )}

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
