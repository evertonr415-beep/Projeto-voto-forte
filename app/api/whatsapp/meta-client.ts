/**
 * Meta WhatsApp Cloud API Client
 * Versão da Graph API: v26.0
 * Suporta envio de Templates (HSM), Texto Livre (janela 24h), Mídias,
 * Listagem de Templates e Verificação de Conta/Número.
 */

const META_GRAPH_URL = "https://graph.facebook.com/v26.0";

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

export function normalizeMetaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function sendMetaTemplate(config: MetaConfig, options: SendTemplateOptions) {
  const phone = normalizeMetaPhone(options.to);
  if (!phone || phone.length < 10) return { success: false, error: "Número de telefone inválido" };
  const endpoint = `${META_GRAPH_URL}/${config.phoneNumberId.trim()}/messages`;
  const components: MetaTemplateComponent[] = [];
  if (options.headerImageUrl) {
    components.push({ type: "header", parameters: [{ type: "image", image: { link: options.headerImageUrl } }] });
  }
  if (options.bodyParameters?.length) {
    components.push({ type: "body", parameters: options.bodyParameters.map((text) => ({ type: "text", text })) });
  }
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: "template",
    template: {
      name: options.templateName.trim(),
      language: { code: options.languageCode || "pt_BR" },
      ...(components.length ? { components } : {}),
    },
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken.trim()}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error?.message || data?.error?.error_user_msg || `Erro Meta HTTP ${res.status}`, raw: data };
    return { success: true, messageId: data?.messages?.[0]?.id, raw: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendMetaText(config: MetaConfig, options: SendTextOptions) {
  const phone = normalizeMetaPhone(options.to);
  if (!phone || phone.length < 10) return { success: false, error: "Número de telefone inválido" };
  const endpoint = `${META_GRAPH_URL}/${config.phoneNumberId.trim()}/messages`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken.trim()}` },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { preview_url: options.previewUrl ?? false, body: options.text } }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error?.message || `Erro Meta HTTP ${res.status}`, raw: data };
    return { success: true, messageId: data?.messages?.[0]?.id, raw: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendMetaMedia(config: MetaConfig, options: SendMediaOptions) {
  const phone = normalizeMetaPhone(options.to);
  if (!phone || phone.length < 10) return { success: false, error: "Número de telefone inválido" };
  const endpoint = `${META_GRAPH_URL}/${config.phoneNumberId.trim()}/messages`;
  const mediaObj: Record<string, unknown> = { link: options.mediaUrl };
  if (options.caption && ["image", "video", "document"].includes(options.mediaType)) mediaObj.caption = options.caption;
  if (options.filename && options.mediaType === "document") mediaObj.filename = options.filename;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.accessToken.trim()}` },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: options.mediaType, [options.mediaType]: mediaObj }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error?.message || `Erro Meta HTTP ${res.status}`, raw: data };
    return { success: true, messageId: data?.messages?.[0]?.id, raw: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchMetaTemplates(wabaId: string, accessToken: string) {
  if (!wabaId || !accessToken) return { success: false, error: "WABA ID e Access Token são obrigatórios" };
  try {
    const res = await fetch(`${META_GRAPH_URL}/${wabaId.trim()}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
      signal: AbortSignal.timeout(12_000),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error?.message || `Erro HTTP ${res.status}` };
    return { success: true, templates: Array.isArray(data?.data) ? data.data : [] };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createMetaTemplate(
  wabaId: string,
  accessToken: string,
  templateData: {
    name: string;
    category: "MARKETING" | "UTILITY";
    language?: string;
    headerText?: string;
    bodyText: string;
    footerText?: string;
    buttonText?: string;
    buttonUrl?: string;
    exampleBodyParams?: string[];
  },
) {
  if (!wabaId || !accessToken) return { success: false, error: "WABA ID e Access Token são obrigatórios" };
  const components: Array<Record<string, unknown>> = [];
  if (templateData.headerText) components.push({ type: "HEADER", format: "TEXT", text: templateData.headerText });
  const bodyComponent: Record<string, unknown> = { type: "BODY", text: templateData.bodyText };
  if (templateData.exampleBodyParams?.length) bodyComponent.example = { body_text: [templateData.exampleBodyParams] };
  components.push(bodyComponent);
  if (templateData.footerText) components.push({ type: "FOOTER", text: templateData.footerText });
  if (templateData.buttonText && templateData.buttonUrl) {
    components.push({ type: "BUTTONS", buttons: [{ type: "URL", text: templateData.buttonText, url: templateData.buttonUrl }] });
  }
  try {
    const res = await fetch(`${META_GRAPH_URL}/${wabaId.trim()}/message_templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken.trim()}` },
      body: JSON.stringify({
        name: templateData.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        category: templateData.category || "MARKETING",
        language: templateData.language || "pt_BR",
        components,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.error?.message || data?.error?.error_user_msg || `Erro HTTP ${res.status}`, raw: data };
    return { success: true, id: data.id, status: data.status || "PENDING", raw: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
