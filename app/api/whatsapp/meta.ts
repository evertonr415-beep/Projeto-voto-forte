const DEFAULT_GRAPH_VERSION = "v20.0";
const DEFAULT_PHONE_NUMBER_ID = "1319478581243565";
const DEFAULT_WABA_ID = "3428932017267478";
export const DEFAULT_ACCESS_TOKEN =
  "EAAe90I6QErgBSczCCsWmktZBfwS8laOpcIzIYeIu1BqXl3PKt1wcSVx2eryizsXPZAZA358LTIHQqhXiWvJHPOP83KaCVW7DVh6FEXJurytbK4zjoO5ZCw4oU2XWYwGZB9kYZCKkKTYo9FCqq8pWpLmpjxFe9bLOUTq5ravVYZAdqU0zSbWHYYZBdARMN5y1IREnvgZDZD";

const EXPIRED_TOKENS = [
  "EAAe90I6QErgBSbTwmPPgavGXLH9G6P0BshwH5sUY6yzAA4IZCqvX2ngHA4nY9sJZBlH8EpFxvCdilYiAGR1ofZCGQ8h5aNOjEPy1NofZAsVGoo6aEMRHv1JDJNy0giKxMImyKEbNo2MFAJDfZA6sAgtxMjwzjJ2EtZAxSA5l2xzzjLKu52BHPquUy9tUnauizxMpPJOFKg9o8iWcd0fNU5FuMpT5shPQOgxOA2Ew2jijbFkOKu9bjZBo0XxCmjLTZB79k1Oih0YPx9RrgdZBughy2HnUIJbK1Ek2NKHMZD",
  "EAAe90I6QErgBSb0tnTUCcyv2mhog84Cjlrd7ZBkgfeSx1kYEBTjTsTIQMPZCQSoJEohkxNsGGPdDOdb6g4R0R5zXzRPasBcBP2gJpyuDLMexV5X5MmuXb608ofdSlO1lUBxLe1GmcijhoHiL6gksHnjwea8AILRgx8wDitjKtlu0qSRZBvEOwKmpy4gEtEhCxcqwUvPnYk6hHQhMPNE1asMd1KyUeqPUOIlqQ93LB6xRhsmLC73ix141chkCLvEi1RINuCiqimXtWRAekt5Td1vT1ZA5LqmOvpiVmgZDZD",
];

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
  let envToken = (
    process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() ||
    process.env.META_WA_ACCESS_TOKEN?.trim() ||
    ""
  );

  // Se o token de ambiente for um dos tokens expirados conhecidos, ignora e usa o ativo
  if (!envToken || EXPIRED_TOKENS.some((exp) => envToken.includes(exp.slice(0, 30)))) {
    envToken = DEFAULT_ACCESS_TOKEN;
  }

  return {
    graphVersion:
      process.env.META_WHATSAPP_API_VERSION?.trim() ||
      process.env.META_WA_API_VERSION?.trim() ||
      DEFAULT_GRAPH_VERSION,
    phoneNumberId:
      process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
      process.env.META_WA_PHONE_NUMBER_ID?.trim() ||
      DEFAULT_PHONE_NUMBER_ID,
    wabaId:
      process.env.META_WHATSAPP_WABA_ID?.trim() ||
      process.env.META_WA_WABA_ID?.trim() ||
      DEFAULT_WABA_ID,
    accessToken: envToken || DEFAULT_ACCESS_TOKEN,
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
          message: "Token da Meta não configurado no servidor.",
        },
      },
    };
  }

  const execute = async (token: string) => {
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${path.replace(/^\/+/, "")}`,
      {
        ...init,
        headers,
        signal: init.signal || AbortSignal.timeout(20_000),
      },
    );

    const data = await readMetaResponse(response);
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  };

  let res = await execute(accessToken);

  // Auto-recovery: Se falhou por token expirado/inválido (190), tenta imediatamente com DEFAULT_ACCESS_TOKEN
  if (!res.ok && accessToken !== DEFAULT_ACCESS_TOKEN) {
    const errCode = (res.data as { error?: { code?: number } })?.error?.code;
    if (errCode === 190) {
      res = await execute(DEFAULT_ACCESS_TOKEN);
    }
  }

  return res;
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
  filename: string,
) {
  const { phoneNumberId } = getMetaConfig();
  const buffer = Buffer.from(base64Value, "base64");
  const blob = new Blob([buffer], { type: mimeType });
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", blob, filename);
  form.append("type", mimeType);

  return metaRequest(`${phoneNumberId}/media`, {
    method: "POST",
    body: form,
  });
}
