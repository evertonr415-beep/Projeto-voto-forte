import { getAccount } from "../../../server-identity";
import {
  getMetaConfig,
  metaErrorMessage,
  normalizeWhatsappPhone,
  readMetaResponse,
} from "../meta";

type SendMessagePayload = {
  phone?: string;
  message?: string;
  contactName?: string;
  mediaBase64?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
};

async function graphRequest(
  accessToken: string,
  path: string,
  init: RequestInit,
) {
  const { graphVersion } = getMetaConfig();
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
  return { response, data: await readMetaResponse(response) };
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const body = (await request.json()) as SendMessagePayload;
    const {
      phone,
      message,
      contactName,
      mediaBase64,
      mediaUrl,
      mediaName,
      mediaMimeType,
      templateName,
      templateLanguage,
      templateParameters,
    } = body;

    const { accessToken, phoneNumberId } = getMetaConfig();
    if (!accessToken) {
      return Response.json(
        { error: "Integração Meta ainda não ativada no servidor." },
        { status: 503 },
      );
    }

    const cleanPhone = normalizeWhatsappPhone(phone || "");
    if (!cleanPhone || cleanPhone.length < 12 || cleanPhone.length > 15) {
      return Response.json(
        { error: "Número inválido. Informe país + DDD + número." },
        { status: 400 },
      );
    }

    let payload: Record<string, unknown>;

    if (templateName?.trim()) {
      const components = Array.isArray(templateParameters) && templateParameters.length
        ? [
            {
              type: "body",
              parameters: templateParameters.map((text) => ({ type: "text", text: String(text) })),
            },
          ]
        : undefined;

      payload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "template",
        template: {
          name: templateName.trim(),
          language: { code: templateLanguage?.trim() || "pt_BR" },
          ...(components ? { components } : {}),
        },
      };
    } else if (mediaBase64) {
      const commaIndex = mediaBase64.indexOf(",");
      const encoded = commaIndex >= 0 ? mediaBase64.slice(commaIndex + 1) : mediaBase64;
      const bytes = Uint8Array.from(Buffer.from(encoded, "base64"));
      const form = new FormData();
      form.set("messaging_product", "whatsapp");
      form.set(
        "file",
        new Blob([bytes], { type: mediaMimeType || "image/jpeg" }),
        mediaName || "imagem.jpg",
      );
      const upload = await graphRequest(accessToken, `${phoneNumberId}/media`, {
        method: "POST",
        body: form,
      });
      if (!upload.response.ok) {
        return Response.json(
          { success: false, error: metaErrorMessage(upload.data, upload.response.status) },
          { status: 502 },
        );
      }
      const mediaId =
        upload.data && typeof upload.data === "object" && "id" in upload.data
          ? String((upload.data as { id?: unknown }).id || "")
          : "";
      payload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "image",
        image: { id: mediaId, caption: message?.trim() || undefined },
      };
    } else if (mediaUrl) {
      payload = {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "image",
        image: { link: mediaUrl, caption: message?.trim() || undefined },
      };
    } else {
      if (!message?.trim()) {
        return Response.json({ error: "A mensagem é obrigatória." }, { status: 400 });
      }
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { preview_url: false, body: message.trim() },
      };
    }

    const result = await graphRequest(accessToken, `${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!result.response.ok) {
      return Response.json(
        {
          success: false,
          contactName: contactName || "Contato",
          error: metaErrorMessage(result.data, result.response.status),
        },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      contactName: contactName || "Contato",
      status: "enviado",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao enviar mensagem." },
      { status: 500 },
    );
  }
}
