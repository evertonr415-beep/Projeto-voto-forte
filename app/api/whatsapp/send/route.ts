import { getAccount } from "../../../server-identity";

type SendMessagePayload = {
  apiUrl?: string;
  apiToken?: string;
  phone?: string;
  message?: string;
  contactName?: string;
  mediaBase64?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMimeType?: string;
};

const ZAPAPI_BASE_URL = "https://zapapi.dgsis.com.br";
const ZAPAPI_TEXT_ENDPOINT = `${ZAPAPI_BASE_URL}/api/messages/send`;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // A ZapAPI exige país + DDD + número, sem máscara.
  // Mantemos a compatibilidade com contatos brasileiros já salvos só com DDD + número.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

async function readResponseData(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return { ok: response.ok };
  try {
    return JSON.parse(raw);
  } catch {
    return { raw: raw.slice(0, 500) };
  }
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SendMessagePayload;
    const {
      apiUrl,
      apiToken,
      phone,
      message,
      contactName,
      mediaBase64,
      mediaUrl,
      mediaName,
      mediaMimeType,
    } = body;

    if (!apiToken?.trim()) {
      return Response.json(
        { error: "Configure o Token da conexão ZapAPI antes de enviar mensagens." },
        { status: 400 },
      );
    }

    if (!phone || (!message && !mediaBase64 && !mediaUrl)) {
      return Response.json(
        { error: "Telefone e conteúdo da mensagem ou imagem são obrigatórios." },
        { status: 400 },
      );
    }

    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 12 || cleanPhone.length > 15) {
      return Response.json(
        {
          error:
            "Número inválido. Informe país + DDD + número, sem máscara ou caracteres especiais.",
        },
        { status: 400 },
      );
    }

    const token = apiToken.trim();
    const hasMedia = Boolean(mediaBase64 || mediaUrl);

    // Mensagens de texto: implementação estrita da documentação oficial fornecida.
    // POST https://zapapi.dgsis.com.br/api/messages/send
    // Authorization: Bearer <token>
    // Content-Type: application/json
    // Body: { number, body }
    if (!hasMedia) {
      if (!message?.trim()) {
        return Response.json({ error: "A mensagem de texto é obrigatória." }, { status: 400 });
      }

      let response: Response;
      try {
        response = await fetch(ZAPAPI_TEXT_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            number: cleanPhone,
            body: message,
          }),
          signal: AbortSignal.timeout(12_000),
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            phone: cleanPhone,
            contactName: contactName || "Contato",
            error:
              error instanceof Error
                ? error.message
                : "Falha ao conectar com o servidor ZapAPI.",
          },
          { status: 502 },
        );
      }

      const responseData = await readResponseData(response);
      if (!response.ok) {
        const detail =
          responseData && typeof responseData === "object" && "raw" in responseData
            ? String((responseData as { raw?: unknown }).raw || "")
            : JSON.stringify(responseData).slice(0, 300);
        return Response.json(
          {
            success: false,
            phone: cleanPhone,
            contactName: contactName || "Contato",
            error: `ZapAPI recusou o envio (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
          },
          { status: 502 },
        );
      }

      return Response.json({
        success: true,
        phone: cleanPhone,
        contactName: contactName || "Contato",
        status: "enviado",
        endpoint: ZAPAPI_TEXT_ENDPOINT,
        data: responseData,
      });
    }

    // Mídia: a documentação fornecida neste ajuste não informa o contrato do endpoint
    // de mídia. Para não regredir o recurso já existente na Central de Disparos,
    // preservamos aqui a compatibilidade anterior exclusivamente para anexos.
    const cleanApiUrl = (apiUrl || ZAPAPI_BASE_URL).replace(/\/+$/, "");
    const endpoints = [
      `${cleanApiUrl}/api/messages/send`,
      `${cleanApiUrl}/messages/send`,
      `${cleanApiUrl}/api/v1/send`,
      `${cleanApiUrl}/send-message`,
      `${cleanApiUrl}/send-media`,
    ];

    let lastError = "";
    let responseData: unknown = null;

    for (const endpoint of endpoints) {
      try {
        const payload: Record<string, unknown> = {
          number: cleanPhone,
          body: message || "",
          phone: cleanPhone,
          message: message || "",
          caption: message || "",
          readChat: true,
          media: mediaBase64 || mediaUrl,
          mediaUrl,
          mediaBase64,
          medias: [
            {
              url: mediaUrl,
              base64: mediaBase64,
              filename: mediaName || "santinho.jpg",
              mimetype: mediaMimeType || "image/jpeg",
            },
          ],
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: token,
            "X-Token": token,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12_000),
        });

        if (response.ok) {
          responseData = await readResponseData(response);
          return Response.json({
            success: true,
            phone: cleanPhone,
            contactName: contactName || "Contato",
            status: "enviado",
            data: responseData,
          });
        }

        const errorData = await readResponseData(response);
        lastError = `Status ${response.status}: ${JSON.stringify(errorData).slice(0, 180)}`;
        if (response.status === 401 || response.status === 403) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return Response.json(
      {
        success: false,
        phone: cleanPhone,
        contactName: contactName || "Contato",
        error: lastError || "Falha ao conectar com o servidor ZapAPI para envio de mídia.",
      },
      { status: 502 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao processar disparo.",
      },
      { status: 500 },
    );
  }
}
