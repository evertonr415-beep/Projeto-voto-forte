import { getAccount } from "../../../../server-identity";
import { getMetaConfig, metaErrorMessage, readMetaResponse } from "../../meta";

const TEMPLATE_NAME = "voto_forte_contato_oficial";
const TEMPLATE_LANGUAGE = "pt_BR";
const TEMPLATE_CATEGORY = "MARKETING";
const TEMPLATE_BODY =
  "Olá! Este é o canal oficial do Sistema Voto Forte. Estamos entrando em contato pelo WhatsApp para comunicação e atendimento. Se não quiser receber novas mensagens, responda SAIR.";

type MetaTemplate = {
  id?: string;
  name?: string;
  status?: string;
  language?: string;
  category?: string;
};

async function listTemplates(accessToken: string, graphVersion: string, wabaId: string) {
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates?fields=id,name,status,language,category&limit=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    },
  );
  const data = await readMetaResponse(response);
  return { response, data };
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as { apiToken?: string };
    const { accessToken: serverToken, graphVersion, wabaId } = getMetaConfig();
    const accessToken = serverToken || body.apiToken?.trim() || "";

    if (!accessToken) {
      return Response.json(
        { error: "Informe o token permanente da Meta para consultar ou criar o modelo." },
        { status: 400 },
      );
    }

    const current = await listTemplates(accessToken, graphVersion, wabaId);
    if (!current.response.ok) {
      return Response.json(
        { error: metaErrorMessage(current.data, current.response.status) },
        { status: 502 },
      );
    }

    const existing =
      current.data &&
      typeof current.data === "object" &&
      Array.isArray((current.data as { data?: unknown[] }).data)
        ? ((current.data as { data: MetaTemplate[] }).data || []).find(
            (template) =>
              String(template.name || "").toLowerCase() === TEMPLATE_NAME &&
              String(template.language || "") === TEMPLATE_LANGUAGE,
          )
        : undefined;

    if (existing) {
      return Response.json({
        success: true,
        created: false,
        template: {
          id: existing.id || "",
          name: existing.name || TEMPLATE_NAME,
          status: existing.status || "UNKNOWN",
          language: existing.language || TEMPLATE_LANGUAGE,
          category: existing.category || TEMPLATE_CATEGORY,
        },
      });
    }

    const createResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: TEMPLATE_NAME,
          language: TEMPLATE_LANGUAGE,
          category: TEMPLATE_CATEGORY,
          components: [
            {
              type: "BODY",
              text: TEMPLATE_BODY,
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    const createData = await readMetaResponse(createResponse);

    if (!createResponse.ok) {
      return Response.json(
        { error: metaErrorMessage(createData, createResponse.status) },
        { status: 502 },
      );
    }

    const result =
      createData && typeof createData === "object"
        ? (createData as { id?: unknown; status?: unknown; category?: unknown })
        : {};

    return Response.json({
      success: true,
      created: true,
      template: {
        id: result.id ? String(result.id) : "",
        name: TEMPLATE_NAME,
        status: result.status ? String(result.status) : "PENDING",
        language: TEMPLATE_LANGUAGE,
        category: result.category ? String(result.category) : TEMPLATE_CATEGORY,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao preparar modelo da Meta." },
      { status: 500 },
    );
  }
}
