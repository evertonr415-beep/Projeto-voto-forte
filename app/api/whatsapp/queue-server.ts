import { getWhatsappAdminClient, recordWhatsappEvent } from "./admin";
import {
  metaErrorMessage,
  sendMetaMessage,
} from "./meta";

type QueueClaim = {
  item_id: number;
  campaign_id: string;
  lock_token: string;
  phone: string;
  contact_name: string;
  parameters: unknown;
  item_metadata: unknown;
  template_name: string;
  template_language: string;
  delay_seconds: number;
  attempt_count: number;
};

type WorkerResult = {
  processed: number;
  sent: number;
  failed: number;
  retried: number;
  uncertain: number;
  idle: boolean;
  durationMs: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageIdFromMeta(data: unknown) {
  if (!data || typeof data !== "object" || !("messages" in data)) return "";
  const messages = (data as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || !messages.length) return "";
  const first = messages[0];
  if (!first || typeof first !== "object" || !("id" in first)) return "";
  return String((first as { id?: unknown }).id || "");
}

function jsonPayload(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return data == null ? {} : { raw: String(data).slice(0, 2000) };
}

function parametersFromClaim(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((item) => String(item ?? ""));
}

async function nextDueDelayMs() {
  const supabase = getWhatsappAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("vf_whatsapp_campaigns")
    .select("next_dispatch_at")
    .eq("status", "running")
    .gt("waiting_count", 0)
    .order("next_dispatch_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.next_dispatch_at) return null;
  return Math.max(0, new Date(data.next_dispatch_at).getTime() - Date.now());
}

async function finishItem(
  claim: QueueClaim,
  outcome: "sent" | "failed" | "retry" | "uncertain",
  details: {
    messageId?: string;
    errorCode?: string;
    errorMessage?: string;
    providerResponse?: unknown;
    retryDelaySeconds?: number;
  } = {},
) {
  const supabase = getWhatsappAdminClient();
  if (!supabase) throw new Error("Supabase administrativo indisponível.");

  const { error } = await supabase.rpc("vf_whatsapp_queue_finish_item", {
    p_item_id: claim.item_id,
    p_lock_token: claim.lock_token,
    p_outcome: outcome,
    p_message_id: details.messageId || null,
    p_error_code: details.errorCode || null,
    p_error_message: details.errorMessage || null,
    p_provider_response: jsonPayload(details.providerResponse),
    p_retry_delay_seconds: details.retryDelaySeconds || 60,
  });
  if (error) throw error;
}

async function claimNextItem(): Promise<QueueClaim | null> {
  const supabase = getWhatsappAdminClient();
  if (!supabase) throw new Error("Supabase administrativo indisponível.");

  const { data, error } = await supabase.rpc("vf_whatsapp_queue_claim_next");
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return row as QueueClaim;
}

async function deliverClaim(claim: QueueClaim) {
  const parameters = parametersFromClaim(claim.parameters);
  const components = parameters.length
    ? [
        {
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text })),
        },
      ]
    : undefined;

  try {
    const result = await sendMetaMessage({
      to: claim.phone,
      type: "template",
      template: {
        name: claim.template_name,
        language: { code: claim.template_language || "pt_BR" },
        ...(components ? { components } : {}),
      },
    });

    if (result.ok) {
      const messageId = messageIdFromMeta(result.data);
      await finishItem(claim, "sent", {
        messageId,
        providerResponse: result.data,
      });

      try {
        await recordWhatsappEvent({
          message_id: messageId || null,
          direction: "outbound",
          event_type: "message_accepted",
          status: "accepted",
          phone: claim.phone,
          contact_name: claim.contact_name,
          message_type: "template",
          message_text: claim.template_name,
          occurred_at: new Date().toISOString(),
          payload: {
            campaign_id: claim.campaign_id,
            queue_item_id: claim.item_id,
            attempt: claim.attempt_count,
          },
        });
      } catch (eventError) {
        console.error("[whatsapp-queue] event persistence failed", eventError);
      }

      return "sent" as const;
    }

    const errorMessage = metaErrorMessage(result.data, result.status);
    const retryable = result.status === 429 || result.status >= 500;

    if (retryable && claim.attempt_count < 3) {
      await finishItem(claim, "retry", {
        errorCode: String(result.status),
        errorMessage,
        providerResponse: result.data,
        retryDelaySeconds: result.status === 429 ? 120 : 60,
      });
      return "retry" as const;
    }

    await finishItem(claim, "failed", {
      errorCode: String(result.status),
      errorMessage,
      providerResponse: result.data,
    });

    try {
      await recordWhatsappEvent({
        direction: "outbound",
        event_type: "message_failed",
        status: "failed",
        phone: claim.phone,
        contact_name: claim.contact_name,
        message_type: "template",
        message_text: claim.template_name,
        error_code: String(result.status),
        error_message: errorMessage,
        occurred_at: new Date().toISOString(),
        payload: {
          campaign_id: claim.campaign_id,
          queue_item_id: claim.item_id,
          attempt: claim.attempt_count,
        },
      });
    } catch {}

    return "failed" as const;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha de rede sem confirmação da Meta.";

    // Em erro de transporte não sabemos com segurança se a Meta recebeu a
    // requisição. Não reenviamos automaticamente para evitar duplicidade.
    await finishItem(claim, "uncertain", {
      errorCode: "transport_uncertain",
      errorMessage: message,
      providerResponse: { transportError: message },
    });
    return "uncertain" as const;
  }
}

export async function processWhatsappQueue(options?: {
  budgetMs?: number;
  maxItems?: number;
}): Promise<WorkerResult> {
  const started = Date.now();
  const budgetMs = Math.max(5_000, Math.min(55_000, options?.budgetMs || 45_000));
  const maxItems = Math.max(1, Math.min(100, options?.maxItems || 40));

  const result: WorkerResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    retried: 0,
    uncertain: 0,
    idle: false,
    durationMs: 0,
  };

  while (Date.now() - started < budgetMs && result.processed < maxItems) {
    const claim = await claimNextItem();
    if (!claim) {
      const dueIn = await nextDueDelayMs();
      const remaining = budgetMs - (Date.now() - started);

      if (dueIn == null || dueIn > remaining - 750 || remaining < 1_000) {
        result.idle = true;
        break;
      }

      await sleep(Math.max(250, Math.min(dueIn, 2_000)));
      continue;
    }

    const outcome = await deliverClaim(claim);
    result.processed += 1;
    if (outcome === "sent") result.sent += 1;
    else if (outcome === "failed") result.failed += 1;
    else if (outcome === "retry") result.retried += 1;
    else result.uncertain += 1;
  }

  result.durationMs = Date.now() - started;
  return result;
}
