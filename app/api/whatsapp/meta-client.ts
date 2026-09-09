/**
 * Meta WhatsApp Cloud API Client
 * Versão da Graph API: v20.0
 * Suporta envio de Templates (HSM), Texto Livre (janela 24h), Mídias,
 * Listagem de Templates e Verificação de Conta/Número.
 */

const META_GRAPH_URL = "https://graph.facebook.com/v20.0";

export interface MetaConfig {
  phoneNumberId: string;
  wabaId?: string;
  accessToken: string;
}

export interface MetaTemplateComponentParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  image?: { link: string };
  document?: { link: string; filename?: string };
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "url" | "quick_reply";
  index?: number;
  parameters: MetaTemplateComponentParameter[];
}

export interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
  headerImageUrl?: string;
}

export interface SendTextOptions {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export interface SendMediaOptions {
  to: string;
  mediaUrl: string;
  mediaType: "image" | "document" | "video" | "audio";
  caption?: string;
  filename?: string;
}

export interface MetaMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MetaTemplateItem {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: string;
    text?: string;
    example?: { body_text?: string[][] };
  }>;
}

/**
 * Normaliza número para formato internacional exigido pela Meta (ex: 5543999998888)
 */
export function normalizeMetaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Envia uma mensagem baseada em Template Aprovado (HSM) - Obrigatório para disparos em massa
 */
export async function sendMetaTemplate(
  config: MetaConfig,
  options: SendTemplateOptions,
): Promise<{ success: boolean; messageId?: string; error?: string; raw?: unknown }> {
  const phone = normalizeMetaPhone(options.to);
  if (!phone || phone.length < 10) {
    return { success: false, error: "Número de telefone inválido" };
  }

  const endpoint = `${META_GRAPH_URL}/${config.phoneNumberId.trim()}/messages`;
  const components: MetaTemplateComponent[] = [];

  // Header image se houver
  if (options.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: options.headerImageUrl },
        },
      ],
    });
  }

  // Body parameters {{1}}, {{2}}, etc.
  if (options.bodyParameters && options.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: options.bodyParameters.map((param) => ({
        type: "text",
        text: param,
      })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: options.templateName.trim(),
      language: {
        code: options.languageCode || "pt_BR",
      },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg =
        data?.error?.message ||
        data?.error?.error_user_msg ||
        `Erro Meta HTTP ${res.status}`;
      return { success: false, error: errorMsg, raw: data };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId, raw: data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Envia mensagem de texto livre (permitido somente dentro da janela de atendimento de 24h)
 */
export async function sendMetaText(
  config: MetaConfig,
  options: SendTextOptions,
): Promise<{ success: boolean; messageId?: string; error?: string; raw?: unknown }> {
  const phone = normalizeMetaPhone(options.to);
  if (!phone || phone.length < 10) {
    return { success: false, error: "Número de telefone inválido" };
  }

  const endpoint = `${META_GRAPH_URL}/${config.phoneNumberId.trim()}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "text",
    text: {
      preview_url: options.previewUrl ?? false,
      body: options.text,
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Erro Meta HTTP ${res.status}`;
      return { success: false, error: errorMsg, raw: data };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId, raw: data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Envia mensagem de mídia (imagem / documento / vídeo)
 */
export async function sendMetaMedia(
  config: MetaConfig,
  options: SendMediaOptions,
): Promise<{ success: boolean; messageId?: string; error?: string; raw?: unknown }> {
  const phone = normalizeMetaPhone(options.to);
  if (!phone || phone.length < 10) {
    return { success: false, error: "Número de telefone inválido" };
  }

  const endpoint = `${META_GRAPH_URL}/${config.phoneNumberId.trim()}/messages`;
  const mediaObj: Record<string, unknown> = { link: options.mediaUrl };
  if (options.caption && (options.mediaType === "image" || options.mediaType === "video" || options.mediaType === "document")) {
    mediaObj.caption = options.caption;
  }
  if (options.filename && options.mediaType === "document") {
    mediaObj.filename = options.filename;
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: options.mediaType,
    [options.mediaType]: mediaObj,
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Erro Meta HTTP ${res.status}`;
      return { success: false, error: errorMsg, raw: data };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId, raw: data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Busca templates aprovados da conta WABA da Meta
 */
export async function fetchMetaTemplates(
  wabaId: string,
  accessToken: string,
): Promise<{ success: boolean; templates?: MetaTemplateItem[]; error?: string }> {
  if (!wabaId || !accessToken) {
    return { success: false, error: "WABA ID e Access Token são obrigatórios" };
  }

  const endpoint = `${META_GRAPH_URL}/${wabaId.trim()}/message_templates?limit=100`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
      signal: AbortSignal.timeout(12_000),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Erro HTTP ${res.status}`;
      return { success: false, error: errorMsg };
    }

    const templates: MetaTemplateItem[] = Array.isArray(data?.data) ? data.data : [];
    return { success: true, templates };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verifica integridade do Phone Number ID e Token da Meta
 */
export async function verifyMetaConnection(
  phoneNumberId: string,
  accessToken: string,
): Promise<{
  success: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  codeVerificationStatus?: string;
  error?: string;
}> {
  if (!phoneNumberId || !accessToken) {
    return { success: false, error: "Phone Number ID e Token são obrigatórios" };
  }

  const endpoint = `${META_GRAPH_URL}/${phoneNumberId.trim()}?fields=verified_name,display_phone_number,quality_rating,code_verification_status,status`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Erro HTTP ${res.status}`;
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      verifiedName: data.verified_name || "Conta WhatsApp Business",
      displayPhoneNumber: data.display_phone_number || "",
      qualityRating: data.quality_rating || "GREEN",
      codeVerificationStatus: data.code_verification_status || "VERIFIED",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
