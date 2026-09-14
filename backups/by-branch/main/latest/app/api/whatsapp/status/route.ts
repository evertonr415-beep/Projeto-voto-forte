import { getAccount } from "../../../server-identity";
import { getWhatsappAdminClient } from "../admin";
import { getMetaConfig, metaErrorMessage, readMetaResponse } from "../meta";

type EventRow = {
  event_type?: string | null;
  status?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
  payload?: unknown;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function eventTime(row?: EventRow | null) {
  return String(row?.occurred_at || row?.created_at || "");
}

function timestamp(row?: EventRow | null) {
  const value = eventTime(row);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findBanState(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBanState(item);
      if (found) return found;
    }
    return "";
  }

  const obj = value as Record<string, unknown>;
  const banInfo = objectValue(obj.ban_info);
  const direct = String(banInfo?.waba_ban_state || obj.waba_ban_state || "").trim();
  if (direct) return direct.toUpperCase();

  for (const child of Object.values(obj)) {
    const found = findBanState(child);
    if (found) return found;
  }
  return "";
}

async function metaGet(
  graphVersion: string,
  id: string,
  fields: string,
  accessToken: string,
) {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${id}?fields=${encodeURIComponent(fields)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    },
  );
  const data = await readMetaResponse(response);
  return { response, data };
}

export async function POST() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.accessRole !== "adm") {
    return Response.json({ error: "Acesso restrito aos superusuários." }, { status: 403 });
  }

  try {
    const { accessToken, graphVersion, phoneNumberId, wabaId } = getMetaConfig();

    if (!accessToken || !phoneNumberId) {
      return Response.json(
        {
          success: false,
          connected: false,
          error: "Integração Meta ainda não ativada completamente no servidor.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const [phoneResult, wabaResult] = await Promise.all([
      metaGet(
        graphVersion,
        phoneNumberId,
        "id,display_phone_number,verified_name,quality_rating,code_verification_status",
        accessToken,
      ),
      wabaId
        ? metaGet(graphVersion, wabaId, "id,name,account_review_status", accessToken)
        : Promise.resolve(null),
    ]);

    const phoneObject = objectValue(phoneResult.data);
    const wabaObject = objectValue(wabaResult?.data);

    let nameStatus = "";
    try {
      const optionalName = await metaGet(
        graphVersion,
        phoneNumberId,
        "name_status",
        accessToken,
      );
      if (optionalName.response.ok) {
        nameStatus = String(objectValue(optionalName.data)?.name_status || "");
      }
    } catch {
      // Campo beta: a ausência dele não impede o diagnóstico principal.
    }

    let rows: EventRow[] = [];
    try {
      const supabase = getWhatsappAdminClient();
      if (supabase) {
        const { data } = await supabase
          .from("vf_whatsapp_events")
          .select(
            "event_type,status,error_code,error_message,occurred_at,created_at,payload",
          )
          .order("created_at", { ascending: false })
          .limit(500);
        if (Array.isArray(data)) rows = data as EventRow[];
      }
    } catch {
      // O diagnóstico da Meta continua funcionando mesmo sem histórico local.
    }

    const statusEvents = rows.filter((row) => row.event_type === "message_status");
    const latestDelivered = statusEvents.find((row) =>
      ["delivered", "read"].includes(String(row.status || "").toLowerCase()),
    );
    const latestLock = statusEvents.find((row) => String(row.error_code || "") === "131031");
    const latestPayment = statusEvents.find((row) => String(row.error_code || "") === "131042");

    let latestBanState = "";
    let latestBanStateAt = "";
    for (const row of rows) {
      const state = findBanState(row.payload);
      if (state) {
        latestBanState = state;
        latestBanStateAt = eventTime(row);
        break;
      }
    }

    const deliveredAt = timestamp(latestDelivered);
    const lockAt = timestamp(latestLock);
    const paymentAt = timestamp(latestPayment);
    const banAt = Date.parse(latestBanStateAt || "") || 0;
    const hasRecoveryAfterLock = deliveredAt > lockAt && deliveredAt > 0;
    const hasRecoveryAfterPayment = deliveredAt > paymentAt && deliveredAt > 0;

    const accountReviewStatus = String(wabaObject?.account_review_status || "").toUpperCase();
    const phoneApiReachable = phoneResult.response.ok;

    let metaState = "online";
    let metaStateLabel = "Ativa / conectada";
    let metaStateTone: "success" | "warning" | "danger" | "neutral" = "success";
    let metaStateSource = "graph_api";
    let metaStateAt = new Date().toISOString();
    let metaStateDetail = "A API oficial da Meta respondeu normalmente para este número.";

    if (["DISABLE", "DISABLED", "BANNED"].includes(latestBanState) && banAt >= deliveredAt) {
      metaState = "banned";
      metaStateLabel = "Banida / desativada";
      metaStateTone = "danger";
      metaStateSource = "meta_webhook";
      metaStateAt = latestBanStateAt;
      metaStateDetail = "A Meta registrou estado de banimento/desativação para esta conta.";
    } else if (latestBanState === "FLAGGED" && banAt >= deliveredAt) {
      metaState = "flagged";
      metaStateLabel = "Sinalizada pela Meta";
      metaStateTone = "warning";
      metaStateSource = "meta_webhook";
      metaStateAt = latestBanStateAt;
      metaStateDetail = "A conta foi sinalizada pela Meta e pode sofrer restrições.";
    } else if (latestBanState === "REINSTATE" && banAt >= lockAt) {
      metaState = "reinstated";
      metaStateLabel = "Reativada pela Meta";
      metaStateTone = "success";
      metaStateSource = "meta_webhook";
      metaStateAt = latestBanStateAt;
      metaStateDetail = "Foi recebido evento de reativação da conta.";
    } else if (latestLock && !hasRecoveryAfterLock) {
      metaState = "locked";
      metaStateLabel = "Conta bloqueada";
      metaStateTone = "danger";
      metaStateSource = "message_status";
      metaStateAt = eventTime(latestLock);
      metaStateDetail = "A Meta devolveu o erro 131031: Business Account locked, sem entrega posterior confirmando recuperação.";
    } else if (latestPayment && !hasRecoveryAfterPayment) {
      metaState = "payment_issue";
      metaStateLabel = "Restrição por pagamento";
      metaStateTone = "warning";
      metaStateSource = "message_status";
      metaStateAt = eventTime(latestPayment);
      metaStateDetail = "A Meta devolveu o erro 131042, indicando pendência de pagamento na conta do WhatsApp Business.";
    } else if (accountReviewStatus === "REJECTED") {
      metaState = "review_rejected";
      metaStateLabel = "Revisão rejeitada";
      metaStateTone = "danger";
      metaStateSource = "graph_api";
      metaStateDetail = "O status de revisão da WABA retornado pela Meta está como REJECTED.";
    } else if (accountReviewStatus === "PENDING") {
      metaState = "review_pending";
      metaStateLabel = "Em análise pela Meta";
      metaStateTone = "warning";
      metaStateSource = "graph_api";
      metaStateDetail = "O status de revisão da WABA está pendente.";
    } else if (!phoneApiReachable) {
      metaState = "api_error";
      metaStateLabel = "Falha na consulta Meta";
      metaStateTone = "neutral";
      metaStateDetail = metaErrorMessage(phoneResult.data, phoneResult.response.status);
    }

    const safePhoneData = phoneObject
      ? {
          id: String(phoneObject.id || ""),
          display_phone_number: String(phoneObject.display_phone_number || ""),
          verified_name: String(phoneObject.verified_name || ""),
          quality_rating: String(phoneObject.quality_rating || ""),
          code_verification_status: String(phoneObject.code_verification_status || ""),
          name_status: nameStatus,
        }
      : {};

    return Response.json(
      {
        success: phoneApiReachable,
        connected: phoneApiReachable,
        provider: "meta-cloud-api",
        status: metaState,
        statusLabel: metaStateLabel,
        statusTone: metaStateTone,
        statusSource: metaStateSource,
        statusObservedAt: metaStateAt,
        statusDetail: metaStateDetail,
        wabaConfigured: Boolean(wabaId),
        phoneNumberConfigured: Boolean(phoneNumberId),
        accountReviewStatus,
        paymentIssueDetected: Boolean(latestPayment && !hasRecoveryAfterPayment),
        lastPaymentIssueAt: eventTime(latestPayment),
        lastRestriction: latestLock
          ? {
              code: String(latestLock.error_code || ""),
              message: String(latestLock.error_message || ""),
              at: eventTime(latestLock),
            }
          : null,
        latestDeliveryAt: eventTime(latestDelivered),
        latestBanState: latestBanState || null,
        latestBanStateAt: latestBanStateAt || null,
        data: safePhoneData,
        message: metaStateDetail,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        connected: false,
        status: "error",
        statusLabel: "Erro ao verificar",
        statusTone: "neutral",
        error: error instanceof Error ? error.message : "Erro ao testar a API oficial do WhatsApp.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
