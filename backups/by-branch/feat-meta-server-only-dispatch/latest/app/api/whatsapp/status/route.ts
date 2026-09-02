import { getAccount } from "../../../server-identity";
import { getMetaConfig, metaErrorMessage, readMetaResponse } from "../meta";

export async function POST() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.accessRole !== "adm") {
    return Response.json({ error: "Acesso restrito aos superusuários." }, { status: 403 });
  }

  try {
    const { accessToken, graphVersion, phoneNumberId, wabaId } = getMetaConfig();

    if (!accessToken) {
      return Response.json(
        {
          success: false,
          connected: false,
          error: "Integração Meta ainda não ativada no servidor.",
        },
        { status: 503 },
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=id,verified_name,quality_rating`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = await readMetaResponse(response);

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          connected: false,
          provider: "meta-cloud-api",
          error: metaErrorMessage(data, response.status),
        },
        { status: 502 },
      );
    }

    const safeData =
      data && typeof data === "object"
        ? {
            id: "id" in data ? String((data as { id?: unknown }).id || "") : "",
            verified_name:
              "verified_name" in data
                ? String((data as { verified_name?: unknown }).verified_name || "")
                : "",
            quality_rating:
              "quality_rating" in data
                ? String((data as { quality_rating?: unknown }).quality_rating || "")
                : "",
          }
        : {};

    return Response.json({
      success: true,
      connected: true,
      provider: "meta-cloud-api",
      status: "online",
      wabaConfigured: Boolean(wabaId),
      phoneNumberConfigured: Boolean(phoneNumberId),
      data: safeData,
      message: "Conectado à API oficial do WhatsApp da Meta.",
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : "Erro ao testar a API oficial do WhatsApp.",
      },
      { status: 500 },
    );
  }
}
