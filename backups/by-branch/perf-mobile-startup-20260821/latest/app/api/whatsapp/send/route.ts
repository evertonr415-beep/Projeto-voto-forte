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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // If Brazilian number without country code (10 or 11 digits), prepend 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
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

    if (!apiUrl || !apiToken) {
      return Response.json(
        { error: "Configure a URL da API e o Token do Whaticket/ZapAPI." },
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
    if (cleanPhone.length < 10) {
      return Response.json(
        { error: "Número de telefone inválido." },
        { status: 400 },
      );
    }

    const cleanApiUrl = apiUrl.replace(/\/+$/, "");
    
    // Try Whaticket / ZapAPI standard endpoints
    const endpoints = [
      `${cleanApiUrl}/api/messages/send`,
      `${cleanApiUrl}/messages/send`,
      `${cleanApiUrl}/api/v1/send`,
      `${cleanApiUrl}/send-message`,
      `${cleanApiUrl}/send-media`,
    ];

    let lastError = "";
    let sendSuccess = false;
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
        };

        if (mediaBase64 || mediaUrl) {
          payload.media = mediaBase64 || mediaUrl;
          payload.mediaUrl = mediaUrl;
          payload.mediaBase64 = mediaBase64;
          payload.medias = [
            {
              url: mediaUrl,
              base64: mediaBase64,
              filename: mediaName || "santinho.jpg",
              mimetype: mediaMimeType || "image/jpeg",
            },
          ];
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken.trim()}`,
            apikey: apiToken.trim(),
            "X-Token": apiToken.trim(),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12_000),
        });

        if (res.ok) {
          try {
            responseData = await res.json();
          } catch {
            responseData = { ok: true };
          }
          sendSuccess = true;
          break;
        } else {
          const errText = await res.text();
          lastError = `Status ${res.status}: ${errText.slice(0, 150)}`;
          // If 404, try next endpoint variant. If 401/403, stop and report auth issue.
          if (res.status === 401 || res.status === 403) {
            break;
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!sendSuccess) {
      return Response.json(
        {
          success: false,
          phone: cleanPhone,
          contactName: contactName || "Contato",
          error: lastError || "Falha ao conectar com o servidor Whaticket/ZapAPI.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      phone: cleanPhone,
      contactName: contactName || "Contato",
      status: "enviado",
      data: responseData,
    });
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
