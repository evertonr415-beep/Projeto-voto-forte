import { getAccount } from "../../../server-identity";
import { getMetaConfig, metaErrorMessage, readMetaResponse } from "../meta";

type TemplateComponent = {
  type?: string;
  text?: string;
  format?: string;
};

type MetaTemplate = {
  id?: string;
  name?: string;
  status?: string;
  language?: string;
  category?: string;
  components?: TemplateComponent[];
};

function bodyParameterCount(components: TemplateComponent[] | undefined) {
  const body = components?.find((component) => component.type === "BODY");
  const matches = String(body?.text || "").match(/\{\{\d+\}\}/g) || [];
  return new Set(matches).size;
}

export async function POST() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { accessToken, graphVersion, wabaId } = getMetaConfig();

    if (!accessToken) {
      return Response.json(
        { error: "Integração Meta ainda não ativada no servidor." },
        { status: 503 },
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates?fields=id,name,status,language,category,components&limit=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const data = await readMetaResponse(response);

    if (!response.ok) {
      return Response.json(
        { error: metaErrorMessage(data, response.status) },
        { status: 502 },
      );
    }

    const rawTemplates =
      data && typeof data === "object" && Array.isArray((data as { data?: unknown[] }).data)
        ? ((data as { data: MetaTemplate[] }).data || [])
        : [];

    const approvedTemplates = rawTemplates.filter((template) => template.status === "APPROVED");

    const templates = approvedTemplates
      .map((template) => {
        const components = Array.isArray(template.components) ? template.components : [];
        const bodyComponent = components.find((component) => component.type === "BODY");
        const unsupportedHeader = components.some(
          (component) =>
            component.type === "HEADER" && component.format && component.format !== "TEXT",
        );
        return {
          id: template.id || "",
          name: template.name || "",
          status: template.status || "",
          language: template.language || "pt_BR",
          category: template.category || "",
          body: bodyComponent?.text || "",
          bodyParameterCount: bodyParameterCount(components),
          unsupportedHeader,
        };
      })
      .filter((template) => template.name);

    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      templates,
      productionReady: templates.length > 0,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao carregar modelos da Meta." },
      { status: 500 },
    );
  }
}
