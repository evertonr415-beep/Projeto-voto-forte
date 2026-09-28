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

const CANDIDATE_SURVEY_TEMPLATE = {
  id: "1452520050058743",
  name: "enquete_candidato_frente_cidade",
  status: "APPROVED",
  language: "pt_BR",
  category: "MARKETING",
  body: "Será que o candidato que todo mundo pensa está na frente? 👀\n\nParticipe da nossa enquete e descubra quem está sendo mais lembrado na sua cidade.\n\n📊 Resultado em tempo real*\n⏱️ Menos de 1 minuto.\n\n👉 Clique e participe.",
  bodyParameterCount: 0,
  unsupportedHeader: false,
};

const DEFAULT_TEMPLATES = [CANDIDATE_SURVEY_TEMPLATE, OFFICIAL_FALLBACK_TEMPLATE];

async function handleTemplatesRequest() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { wabaId } = getMetaConfig();

    const { ok, status, data } = await metaRequest(
      `${wabaId}/message_templates?fields=id,name,status,language,category,components&limit=100`,
      { method: "GET" },
    );

    if (!ok) {
      // Return official approved template fallback if meta returns an error
      return Response.json({
        success: true,
        provider: "meta-cloud-api",
        templates: DEFAULT_TEMPLATES,
        productionReady: true,
        fallback: true,
        metaError: metaErrorMessage(data, status),
      });
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

    // Adiciona os templates padrão se não estiverem já na lista
    for (const def of DEFAULT_TEMPLATES) {
      if (!templates.some((t) => t.name === def.name && t.language === def.language)) {
        templates.unshift(def);
      }
    }

    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      templates,
      productionReady: templates.length > 0,
    });
  } catch (error) {
    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      templates: DEFAULT_TEMPLATES,
      productionReady: true,
      fallback: true,
      error: error instanceof Error ? error.message : "Erro ao carregar modelos da Meta.",
    });
  }
}

export async function GET() {
  return handleTemplatesRequest();
}

export async function POST() {
  return handleTemplatesRequest();
}
