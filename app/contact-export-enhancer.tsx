"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

const HISTORY_ROUTE = "/exportacoes";
const EXPORT_ID_PATTERN = /lote\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function normalClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function exportFormat(button: HTMLButtonElement) {
  const label = button.textContent?.trim().toLowerCase();
  if (label === "csv") return "csv";
  if (label === "excel") return "xlsx";
  if (label === "vcf") return "vcf";
  return null;
}

function downloadBlob(response: Response, blob: Blob, fallback: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const disposition = response.headers.get("content-disposition") || "";
  anchor.download = disposition.match(/filename="([^"]+)"/)?.[1] || fallback;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ensureHistoryLink(router: ReturnType<typeof useRouter>) {
  const card = document.querySelector<HTMLElement>(".export-contacts");
  if (!card || card.querySelector("[data-vf-export-history-link]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vf-export-history-link";
  button.setAttribute("data-vf-export-history-link", "true");
  button.textContent = "Histórico de exportações";
  button.addEventListener("click", () => router.push(HISTORY_ROUTE));
  card.appendChild(button);

  const status = document.createElement("p");
  status.className = "vf-export-card-status";
  status.setAttribute("data-vf-export-status", "true");
  status.setAttribute("aria-live", "polite");
  card.appendChild(status);
}

function markAuditRows() {
  document.querySelectorAll<HTMLElement>(".audit-list > div").forEach((row) => {
    const action = row.querySelector("b")?.textContent?.trim();
    const detail = row.querySelector("small")?.textContent || "";
    if (action !== "Exportação de contatos") return;
    const id = detail.match(EXPORT_ID_PATTERN)?.[1];
    if (!id) return;
    row.dataset.vfExportId = id;
    row.classList.add("vf-export-audit-row");
    row.setAttribute("role", "link");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", `${action}. Abrir lote exportado.`);
  });
}

export default function ContactExportEnhancer() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(HISTORY_ROUTE);
    ensureHistoryLink(router);
    markAuditRows();

    const observer = new MutationObserver(() => {
      ensureHistoryLink(router);
      markAuditRows();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    async function handleTrackedExport(button: HTMLButtonElement, format: string) {
      const status = document.querySelector<HTMLElement>("[data-vf-export-status]");
      const ownerScope =
        document.querySelector<HTMLSelectElement>(".scope-picker select")?.value || "";
      const originalText = button.textContent || format.toUpperCase();
      button.disabled = true;
      if (status) status.textContent = "Registrando lote e preparando arquivo…";

      try {
        const createResponse = await apiFetch("/api/contact-exports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ format, ownerScope }),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok)
          throw new Error(createData.error || "Não foi possível registrar a exportação.");

        const exportId = String(createData.export?.id || "");
        const itemCount = Number(createData.export?.itemCount || 0);
        if (!exportId) throw new Error("A exportação não retornou um lote válido.");

        const downloadResponse = await apiFetch(
          `/api/contact-exports/${encodeURIComponent(exportId)}/download`,
          { cache: "no-store" },
        );
        if (!downloadResponse.ok) {
          const data = await downloadResponse.json().catch(() => ({}));
          throw new Error(data.error || "O lote foi registrado, mas o arquivo não pôde ser baixado.");
        }

        downloadBlob(
          downloadResponse,
          await downloadResponse.blob(),
          `contatos-voto-forte.${format === "xlsx" ? "xlsx" : format}`,
        );
        if (status)
          status.textContent = `${itemCount.toLocaleString("pt-BR")} contato(s) registrados no histórico.`;
      } catch (error) {
        if (status)
          status.textContent =
            error instanceof Error
              ? error.message
              : "Não foi possível concluir a exportação.";
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const auditRow = target.closest<HTMLElement>("[data-vf-export-id]");
      if (auditRow && normalClick(event)) {
        event.preventDefault();
        router.push(`/exportacoes/${auditRow.dataset.vfExportId}`);
        return;
      }

      const button = target.closest<HTMLButtonElement>(
        ".export-contacts .export-buttons button",
      );
      if (!button || !normalClick(event)) return;
      const format = exportFormat(button);
      if (!format) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void handleTrackedExport(button, format);
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      const row = target?.closest<HTMLElement>("[data-vf-export-id]");
      if (!row) return;
      event.preventDefault();
      router.push(`/exportacoes/${row.dataset.vfExportId}`);
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeydown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeydown, true);
    };
  }, [router]);

  return null;
}
