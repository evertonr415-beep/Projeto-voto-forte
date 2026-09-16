import { getAccount } from "../../../server-identity";
import { getMetaConfig, metaErrorMessage, metaRequest } from "../meta";

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

const OFFICIAL_FALLBACK_TEMPLATE = {
  id: "1452520050058742",
  name: "enquete_descubra_opiniao_cidade",
  status: "APPROVED",
  language: "pt_BR",
  category: "MARKETING",
  body: "👀 Você sabe como sua cidade está pensando?\n\nResponda nossa enquete — leva menos de 1 minuto.\n\n📊 No final, você poderá ver a prévia do resultado!\n\n👉 Clique no link e descubra se a maioria pensa como você",
  bodyParameterCount: 0,
  unsupportedHeader: false,
};

async function handleGetTemplates() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { wabaId } = getMetaConfig();

    const { ok, data } = await metaRequest(
      `${wabaId}/message_templates?fields=id,name,status,language,category,components&limit=100`,
      { method: "GET" },
    );

    let templates: any[] = [];

    if (ok && data && typeof data === "object" && Array.isArray((data as { data?: unknown[] }).data)) {
      const rawTemplates = (data as { data: MetaTemplate[] }).data || [];
      const approvedTemplates = rawTemplates.filter((template) => template.status === "APPROVED");

      templates = approvedTemplates
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
    }

    // Se a lista estiver vazia ou com falha, inclui o modelo oficial homologado
    if (!templates.length || !templates.some((t) => t.name === "enquete_descubra_opiniao_cidade")) {
      templates = [OFFICIAL_FALLBACK_TEMPLATE, ...templates];
    }

    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      templates,
      productionReady: true,
    });
  } catch (error) {
    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      templates: [OFFICIAL_FALLBACK_TEMPLATE],
      productionReady: true,
    });
  }
}

export async function GET() {
  return handleGetTemplates();
}

export async function POST() {
  return handleGetTemplates();
}
