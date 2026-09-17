"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./supabase-client";

const ACTIVE_CAMPAIGN_KEY = "voto-forte:whatsapp:server-campaign";
const LEGACY_CHECKPOINT_KEY = "voto-forte:whatsapp:broadcast-checkpoint:v1";

type ContactItem = {
  id: number | string;
  name: string;
  phone: string;
  district?: string;
  leader?: string;
};

type ServerCampaign = {
  id: string;
  status: "queued" | "running" | "paused" | "completed" | "cancelled" | "failed";
  template_name: string;
  template_language: string;
  delay_seconds: number;
  total_count: number;
  waiting_count: number;
  sending_count: number;
  sent_count: number;
  failed_count: number;
  cancelled_count: number;
  uncertain_count: number;
  next_dispatch_at?: string | null;
  last_worker_at?: string | null;
  created_at: string;
  completed_at?: string | null;
};

type QueueItem = {
  id: number;
  sequence: number;
  contact_name: string;
  phone: string;
  status: "waiting" | "sending" | "sent" | "failed" | "cancelled" | "uncertain";
  attempt_count: number;
  message_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
  failed_at?: string | null;
  uncertain_at?: string | null;
};

function normalizePhone(raw: string) {
  let digits = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 8 || digits.length === 9) return `5543${digits}`;
  return digits.length >= 10 ? digits : "";
}

function resolveTag(value: string, contact: ContactItem) {
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "Amigo(a)";
  return String(value || "")
    .replace(/\{nome\}/gi, contact.name || "Amigo(a)")
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{bairro\}/gi, contact.district || "sua região")
    .replace(/\{cidade\}/gi, "Arapongas")
    .replace(/\{lideranca\}/gi, contact.leader || "Liderança");
}

function findControl<T extends HTMLInputElement | HTMLSelectElement>(
  root: ParentNode,
  labelPrefix: string,
): T | null {
  const groups = Array.from(root.querySelectorAll<HTMLElement>(".wt-form-group"));
  for (const group of groups) {
    const label = group.querySelector("label")?.textContent?.trim() || "";
    if (!label.startsWith(labelPrefix)) continue;
    const control = group.querySelector<T>("select, input");
    if (control) return control;
  }
  return null;
}

async function fetchRecipients(
  district: string,
  kind: "Todos" | "Eleitor" | "Liderança",
  limit: number,
) {
  const maxToFetch = limit === 99999 ? 5000 : Math.max(1, Math.min(5000, limit));
  const params = new URLSearchParams({
    page: "1",
    pageSize: String(Math.min(200, maxToFetch)),
    owner: "all",
  });

  if (district && district !== "Todos" && district !== "Todos os Bairros") {
    params.set("district", district);
  }
  if (kind && kind !== "Todos") params.set("profile", kind);

  const loaded: ContactItem[] = [];

  const appendContacts = (items: Array<Record<string, unknown>>) => {
    for (const raw of items) {
      loaded.push({
        id: (raw.id as number | string) || String(loaded.length),
        name: String(raw.name || raw.nome || "Contato"),
        phone: String(raw.phone || raw.phoneNormalized || raw.telefone || raw.celular || ""),
        district: String(
          raw.district ||
            raw.bairro ||
            (district && district !== "Todos" && district !== "Todos os Bairros"
              ? district
              : "Arapongas"),
        ),
        leader: String(raw.leader || raw.lideranca || ""),
      });
    }
  };

  const firstResponse = await apiFetch(`/api/contacts?${params.toString()}`, {
    cache: "no-store",
  });
  const firstData = await firstResponse.json();
  if (!firstResponse.ok || !Array.isArray(firstData.contacts)) {
    throw new Error(firstData.error || "Não foi possível carregar os destinatários.");
  }
  appendContacts(firstData.contacts as Array<Record<string, unknown>>);

  const totalPages = Math.max(1, Number(firstData.totalPages || 1));
  const pagesToRead = Math.min(Math.ceil(maxToFetch / 200), totalPages);
  for (let page = 2; page <= pagesToRead; page += 1) {
    params.set("page", String(page));
    const response = await apiFetch(`/api/contacts?${params.toString()}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.contacts)) break;
    appendContacts(data.contacts as Array<Record<string, unknown>>);
  }

  const seen = new Set<string>();
  const recipients: ContactItem[] = [];
  for (const contact of loaded) {
    const normalized = normalizePhone(contact.phone);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    recipients.push({ ...contact, phone: normalized });
    if (recipients.length >= maxToFetch) break;
  }
  return recipients;
}

function statusLabel(status: ServerCampaign["status"]) {
  switch (status) {
    case "running":
      return "ENVIANDO NO SERVIDOR";
    case "paused":
      return "PAUSADO";
    case "completed":
      return "CONCLUÍDO";
    case "cancelled":
      return "CANCELADO";
    case "failed":
      return "FALHOU";
    default:
      return "AGUARDANDO";
  }
}

function isActive(status?: ServerCampaign["status"]) {
  return status === "queued" || status === "running" || status === "paused";
}

function legacyQueueStillOpen() {
  try {
    const raw = localStorage.getItem(LEGACY_CHECKPOINT_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as {
      status?: string;
      recipients?: Array<{ status?: string }>;
    };
    return (
      data?.status === "running" &&
      Array.isArray(data.recipients) &&
      data.recipients.some((item) => !["sent", "error"].includes(String(item.status || "")))
    );
  } catch {
    return false;
  }
}

export default function ServerBroadcastQueueBridge() {
  const [campaign, setCampaign] = useState<ServerCampaign | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissedTerminalId, setDismissedTerminalId] = useState("");
  const campaignIdRef = useRef("");

  const loadCampaign = useCallback(async (id: string, silent = false) => {
    if (!id) return null;
    try {
      const response = await apiFetch(
        `/api/whatsapp/campaigns/${encodeURIComponent(id)}?itemsLimit=500`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data?.campaign) {
        if (!silent) setMessage(String(data?.error || "Campanha não encontrada."));
        return null;
      }

      const next = data.campaign as ServerCampaign;
      campaignIdRef.current = next.id;
      setCampaign(next);
      setItems(Array.isArray(data.items) ? (data.items as QueueItem[]) : []);

      try {
        localStorage.setItem(ACTIVE_CAMPAIGN_KEY, next.id);
      } catch {}

      return next;
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "Falha ao atualizar a fila do servidor.");
      }
      return null;
    }
  }, []);

  const discoverCampaign = useCallback(async () => {
    let saved = "";
    try {
      saved = localStorage.getItem(ACTIVE_CAMPAIGN_KEY) || "";
    } catch {}

    if (saved) {
      const found = await loadCampaign(saved, true);
      if (found) return found;
      try {
        localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
      } catch {}
    }

    try {
      const response = await apiFetch("/api/whatsapp/campaigns?active=true&limit=10", {
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json();
      const active = Array.isArray(data.campaigns)
        ? (data.campaigns[0] as ServerCampaign | undefined)
        : undefined;
      if (!active) return null;
      return loadCampaign(active.id, true);
    } catch {
      return null;
    }
  }, [loadCampaign]);

  useEffect(() => {
    document.documentElement.dataset.vfServerQueue = "true";
    void discoverCampaign();
    return () => {
      delete document.documentElement.dataset.vfServerQueue;
    };
  }, [discoverCampaign]);

  useEffect(() => {
    if (!campaign?.id) return;
    const interval = window.setInterval(() => {
      void loadCampaign(campaign.id, true);
    }, isActive(campaign.status) ? 2500 : 8000);
    return () => window.clearInterval(interval);
  }, [campaign?.id, campaign?.status, loadCampaign]);

  useEffect(() => {
    if (!campaign?.id) return;
    if (campaign.status === "completed") {
      setMessage(
        `Campanha concluída pelo servidor: ${campaign.sent_count} enviados, ${campaign.failed_count} falhas e ${campaign.uncertain_count} incerto(s).`,
      );
      window.dispatchEvent(new CustomEvent("voto-forte:survey-updated"));
    }
  }, [campaign?.id, campaign?.status, campaign?.sent_count, campaign?.failed_count, campaign?.uncertain_count]);

  useEffect(() => {
    const interceptStart = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".wt-primary-btn");
      if (!button || !button.closest(".wt-drawer")) return;
      if (!button.textContent?.trim().startsWith("Enviar para")) return;

      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) event.stopImmediatePropagation();

      if (creating) return;
      if (campaign && isActive(campaign.status)) {
        setMessage(
          "Já existe uma campanha ativa no servidor. Pause, conclua ou cancele essa campanha antes de iniciar outra.",
        );
        return;
      }
      if (legacyQueueStillOpen()) {
        setMessage(
          "Existe uma fila antiga recuperável neste navegador. Conclua ou descarte essa recuperação antes de criar uma nova campanha no servidor.",
        );
        return;
      }

      const drawer = button.closest<HTMLElement>(".wt-drawer");
      if (!drawer) return;

      setCreating(true);
      setMessage("Preparando a campanha e transferindo a fila para o servidor…");

      void (async () => {
        try {
          const district =
            findControl<HTMLSelectElement>(drawer, "Bairro")?.value || "Todos";
          const kindValue =
            findControl<HTMLSelectElement>(drawer, "Perfil")?.value || "Todos";
          const kind =
            kindValue === "Eleitor" || kindValue === "Liderança"
              ? kindValue
              : "Todos";
          const limit = Number(
            findControl<HTMLSelectElement>(drawer, "Limite")?.value || 50,
          );
          const templateValue =
            findControl<HTMLSelectElement>(drawer, "Mensagem")?.value || "";
          const [templateName, templateLanguage = "pt_BR"] = templateValue.split("::");
          const delaySeconds = Math.max(
            1,
            Number(
              drawer.querySelector<HTMLInputElement>('input[type="range"]')?.value ||
                3,
            ),
          );
          const parameterMappings = Array.from(
            drawer.querySelectorAll<HTMLElement>(".wt-form-group"),
          )
            .filter((group) =>
              (group.querySelector("label")?.textContent || "")
                .trim()
                .startsWith("Variável"),
            )
            .map(
              (group) =>
                group.querySelector<HTMLInputElement>("input")?.value || "",
            );

          if (!templateName) {
            throw new Error("Selecione um modelo aprovado antes de iniciar.");
          }

          const recipients = await fetchRecipients(district, kind, limit);
          if (!recipients.length) {
            throw new Error("Nenhum contato elegível foi encontrado.");
          }

          const response = await apiFetch("/api/whatsapp/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              templateName,
              templateLanguage,
              delaySeconds,
              metadata: {
                district,
                kind,
                requestedLimit: limit,
                parameterMappings,
              },
              contacts: recipients.map((contact) => ({
                id: contact.id,
                name: contact.name,
                phone: contact.phone,
                district: contact.district,
                leader: contact.leader,
                parameters: parameterMappings.map((mapping) =>
                  resolveTag(mapping, contact),
                ),
              })),
            }),
          });
          const data = await response.json();
          if (!response.ok || !data?.campaign?.id) {
            throw new Error(data?.error || "O servidor não aceitou a campanha.");
          }

          const next = data.campaign as ServerCampaign;
          campaignIdRef.current = next.id;
          setCampaign(next);
          setItems([]);
          setDismissedTerminalId("");
          try {
            localStorage.setItem(ACTIVE_CAMPAIGN_KEY, next.id);
          } catch {}
          setMessage(
            `Fila entregue ao servidor com ${next.total_count} destinatário(s). Pode fechar a aba ou desligar o computador; o servidor continuará o envio.`,
          );

          // Atualiza imediatamente os detalhes; o cron assume os próximos itens.
          await loadCampaign(next.id, true);
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível criar a campanha no servidor.",
          );
        } finally {
          setCreating(false);
        }
      })();
    };

    document.addEventListener("click", interceptStart, true);
    return () => document.removeEventListener("click", interceptStart, true);
  }, [campaign, creating, loadCampaign]);

  const performAction = async (action: "pause" | "resume" | "cancel") => {
    if (!campaign?.id || actionBusy) return;
    if (
      action === "cancel" &&
      !window.confirm(
        "Cancelar esta campanha? Os itens ainda aguardando não serão enviados. Mensagens já enviadas não podem ser desfeitas.",
      )
    ) {
      return;
    }

    setActionBusy(true);
    try {
      const response = await apiFetch(
        `/api/whatsapp/campaigns/${encodeURIComponent(campaign.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data?.campaign) {
        throw new Error(data?.error || "Não foi possível alterar a campanha.");
      }
      setCampaign(data.campaign as ServerCampaign);
      setMessage(
        action === "pause"
          ? "Campanha pausada no servidor."
          : action === "resume"
            ? "Campanha retomada no servidor."
            : "Campanha cancelada. Nenhum novo destinatário será iniciado.",
      );
      await loadCampaign(campaign.id, true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao alterar a campanha.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const counts = useMemo(() => {
    if (!campaign) {
      return { total: 0, processed: 0, progress: 0 };
    }
    const processed =
      campaign.sent_count +
      campaign.failed_count +
      campaign.cancelled_count +
      campaign.uncertain_count;
    return {
      total: campaign.total_count,
      processed,
      progress: campaign.total_count
        ? Math.round((processed / campaign.total_count) * 100)
        : 0,
    };
  }, [campaign]);

  const visible =
    Boolean(campaign) &&
    dismissedTerminalId !== campaign?.id &&
    (isActive(campaign?.status) ||
      campaign?.status === "completed" ||
      campaign?.status === "cancelled" ||
      campaign?.status === "failed");

  if (!visible || !campaign) return null;

  const currentItem = items.find((item) => item.status === "sending");
  const statusColor =
    campaign.status === "completed"
      ? "#4ade80"
      : campaign.status === "paused"
        ? "#fbbf24"
        : campaign.status === "cancelled" || campaign.status === "failed"
          ? "#fb7185"
          : "#38bdf8";

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 2147483200,
        width: "min(455px, calc(100vw - 28px))",
        border: "1px solid rgba(215,174,96,.55)",
        borderRadius: 16,
        padding: 16,
        background: "rgba(5,15,29,.98)",
        boxShadow: "0 22px 70px rgba(0,0,0,.52)",
        color: "#e5eef8",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            display: "grid",
            placeItems: "center",
            background: "rgba(215,174,96,.13)",
            color: "#e0b45e",
            fontSize: 19,
            flex: "0 0 auto",
          }}
        >
          ⚡
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", color: "#fff", fontSize: 15 }}>
            Fila de disparos no servidor
          </strong>
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 11,
              color: statusColor,
              fontWeight: 800,
              letterSpacing: ".04em",
            }}
          >
            {statusLabel(campaign.status)}
          </span>
        </div>
        {!isActive(campaign.status) && (
          <button
            type="button"
            onClick={() => {
              setDismissedTerminalId(campaign.id);
              try {
                localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
              } catch {}
            }}
            style={{
              border: 0,
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 18,
            }}
            aria-label="Fechar resumo"
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 7,
          marginTop: 14,
          fontSize: 10,
        }}
      >
        <div><b style={{ display: "block", fontSize: 17 }}>{campaign.total_count}</b>Total</div>
        <div><b style={{ display: "block", fontSize: 17, color: "#4ade80" }}>{campaign.sent_count}</b>Enviados</div>
        <div><b style={{ display: "block", fontSize: 17, color: "#fbbf24" }}>{campaign.waiting_count}</b>Aguardando</div>
        <div><b style={{ display: "block", fontSize: 17, color: campaign.failed_count || campaign.uncertain_count ? "#fb7185" : "#94a3b8" }}>{campaign.failed_count + campaign.uncertain_count}</b>Falhas/Inc.</div>
      </div>

      <div
        style={{
          marginTop: 10,
          height: 7,
          borderRadius: 999,
          background: "rgba(148,163,184,.17)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${counts.progress}%`,
            background: "linear-gradient(90deg,#d7ae60,#38bdf8)",
            transition: "width .35s ease",
          }}
        />
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: "#9fb0c3", lineHeight: 1.45 }}>
        {campaign.sending_count > 0 && currentItem
          ? `Enviando agora: ${currentItem.contact_name}`
          : campaign.status === "running"
            ? "Servidor ativo. Você pode fechar esta aba ou desligar o computador."
            : campaign.status === "paused"
              ? "A fila está preservada no banco e pode ser retomada a qualquer momento."
              : `Processados: ${counts.processed} de ${counts.total}.`}
      </div>

      {campaign.uncertain_count > 0 && (
        <div
          style={{
            marginTop: 9,
            borderRadius: 9,
            padding: "8px 10px",
            background: "rgba(251,113,133,.1)",
            color: "#fecdd3",
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          {campaign.uncertain_count} envio(s) ficaram sem confirmação segura. Eles não serão reenviados automaticamente para evitar duplicidade.
        </div>
      )}

      {message && (
        <div style={{ marginTop: 9, color: "#bae6fd", fontSize: 10, lineHeight: 1.4 }}>
          {message}
        </div>
      )}

      {isActive(campaign.status) && (
        <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
          {campaign.status === "paused" ? (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void performAction("resume")}
              style={{
                flex: 1,
                border: "1px solid rgba(74,222,128,.55)",
                borderRadius: 9,
                padding: "9px 10px",
                background: "rgba(34,197,94,.12)",
                color: "#bbf7d0",
                fontWeight: 800,
                cursor: actionBusy ? "wait" : "pointer",
              }}
            >
              ▶ Retomar
            </button>
          ) : (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void performAction("pause")}
              style={{
                flex: 1,
                border: "1px solid rgba(251,191,36,.55)",
                borderRadius: 9,
                padding: "9px 10px",
                background: "rgba(245,158,11,.11)",
                color: "#fde68a",
                fontWeight: 800,
                cursor: actionBusy ? "wait" : "pointer",
              }}
            >
              ⏸ Pausar
            </button>
          )}
          <button
            type="button"
            disabled={actionBusy}
            onClick={() => void performAction("cancel")}
            style={{
              flex: 1,
              border: "1px solid rgba(248,113,113,.55)",
              borderRadius: 9,
              padding: "9px 10px",
              background: "rgba(239,68,68,.1)",
              color: "#fecaca",
              fontWeight: 800,
              cursor: actionBusy ? "wait" : "pointer",
            }}
          >
            ⏹ Cancelar
          </button>
        </div>
      )}
    </aside>
  );
}
