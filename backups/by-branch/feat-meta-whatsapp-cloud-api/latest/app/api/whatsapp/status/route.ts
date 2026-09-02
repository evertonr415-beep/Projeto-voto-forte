import { getAccount } from "../../../server-identity";
import { getMetaConfig, metaErrorMessage, readMetaResponse } from "../meta";

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as { apiToken?: string };
    const { accessToken: serverToken, graphVersion, phoneNumberId, wabaId } = getMetaConfig();
    const accessToken = serverToken || body.apiToken?.trim() || "";

    if (!accessToken) {
      return Response.json(
        {
          success: false,
          connected: false,
          error: "Configure o token permanente da Meta WhatsApp Cloud API.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
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

    return Response.json({
      success: true,
      connected: true,
      provider: "meta-cloud-api",
      status: "online",
      phoneNumberId,
      wabaId,
      data,
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
