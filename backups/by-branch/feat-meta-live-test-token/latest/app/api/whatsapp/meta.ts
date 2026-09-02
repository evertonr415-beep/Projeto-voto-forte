const DEFAULT_GRAPH_VERSION = "v25.0";
const DEFAULT_PHONE_NUMBER_ID = "1319478581243565";
const DEFAULT_WABA_ID = "3428932017267478";

export type MetaTemplateParameter = {
  type: "text";
  text: string;
};

export type MetaApiResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

export function getMetaConfig() {
  return {
    graphVersion:
      process.env.META_WHATSAPP_API_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
    phoneNumberId:
      process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() || DEFAULT_PHONE_NUMBER_ID,
    wabaId: process.env.META_WHATSAPP_WABA_ID?.trim() || DEFAULT_WABA_ID,
    accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() || "",
  };
}

export function normalizeWhatsappPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function readMetaResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return { ok: response.ok };
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 1000) };
  }
}

export function metaErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as {
      error?: {
        message?: string;
        code?: number;
        error_subcode?: number;
        error_data?: { details?: string };
      };
    }).error;
    const detail = error?.error_data?.details || error?.message || "Erro da Meta";
    const code = error?.code ? ` (código ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ""})` : "";
    return `${detail}${code}`;
  }
  return `Meta WhatsApp API respondeu HTTP ${status}.`;
}

export async function metaRequest(
  path: string,
  init: RequestInit = {},
): Promise<MetaApiResult> {
  const { graphVersion, accessToken } = getMetaConfig();
  if (!accessToken) {
    return {
      ok: false,
      status: 503,
      data: {
        error: {
          message:
            "Token da Meta não configurado no servidor. Defina META_WHATSAPP_ACCESS_TOKEN na Vercel.",
        },
      },
    };
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${path.replace(/^\/+/, "")}`,
    {
      ...init,
      headers,
      signal: init.signal || AbortSignal.timeout(20_000),
    },
  );

  return {
    ok: response.ok,
    status: response.status,
    data: await readMetaResponse(response),
  };
}

export async function sendMetaMessage(payload: Record<string, unknown>) {
  const { phoneNumberId } = getMetaConfig();
  return metaRequest(`${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
}

export async function uploadMetaMedia(
  base64Value: string,
  mimeType: string,
  fileName: string,
): Promise<{ ok: boolean; status: number; mediaId?: string; data: unknown }> {
  const { phoneNumberId } = getMetaConfig();
  const commaIndex = base64Value.indexOf(",");
  const encoded = commaIndex >= 0 ? base64Value.slice(commaIndex + 1) : base64Value;

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
  } catch {
    return {
      ok: false,
      status: 400,
      data: { error: { message: "Arquivo em base64 inválido." } },
    };
  }

  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("file", new Blob([bytes], { type: mimeType || "image/jpeg" }), fileName || "arquivo.jpg");

  const result = await metaRequest(`${phoneNumberId}/media`, {
    method: "POST",
    body: form,
  });

  const mediaId =
    result.data && typeof result.data === "object" && "id" in result.data
      ? String((result.data as { id?: unknown }).id || "")
      : "";

  return { ...result, mediaId: mediaId || undefined };
}
