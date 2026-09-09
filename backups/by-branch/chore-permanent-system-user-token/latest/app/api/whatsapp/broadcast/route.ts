import { getAccount } from "../../../server-identity";
import {
  getMetaConfig,
  metaErrorMessage,
  normalizeWhatsappPhone,
  readMetaResponse,
} from "../meta";

type BroadcastContact = {
  id?: number | string;
  name: string;
  phone: string;
  district?: string;
  city?: string;
  leader?: string;
  kind?: string;
};

type BroadcastPayload = {
  contacts?: BroadcastContact[];
  messageTemplate?: string;
  delaySeconds?: number;
  dryRun?: boolean;
  templateName?: string;
  templateLanguage?: string;
};

function parsePreview(template: string, contact: BroadcastContact): string {
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "";
  return template
    .replace(/\{nome\}/gi, contact.name || "")
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{bairro\}/gi, contact.district || "sua região")
    .replace(/\{cidade\}/gi, contact.city || "Arapongas")
    .replace(/\{lideranca\}/gi, contact.leader || "");
}

async function graphSend(accessToken: string, payload: Record<string, unknown>) {
  const { graphVersion, phoneNumberId } = getMetaConfig();
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  return { response, data: await readMetaResponse(response) };
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const body = (await request.json()) as BroadcastPayload;
    const {
      contacts,
      messageTemplate = "",
      delaySeconds = 3,
      dryRun = false,
      templateName,
      templateLanguage = "pt_BR",
    } = body;

    const { accessToken } = getMetaConfig();
    if (!accessToken) {
      return Response.json(
        { error: "Integração Meta ainda não ativada no servidor. Configure o token permanente no ambiente de produção." },
        { status: 503 },
      );
    }

    if (!Array.isArray(contacts) || !contacts.length) {
      return Response.json({ error: "Nenhum contato fornecido para o disparo." }, { status: 400 });
    }

    if (!dryRun && !templateName?.trim()) {
      return Response.json(
        {
          error:
            "Informe o nome exato do modelo aprovado pela Meta. Disparos iniciados pela empresa precisam usar template aprovado.",
        },
        { status: 400 },
      );
    }

    const total = contacts.length;
    const estimatedSeconds = total * Math.max(1, delaySeconds);

    if (dryRun) {
      const samplePreviews = contacts.slice(0, 3).map((contact) => ({
        contact: contact.name,
        phone: normalizeWhatsappPhone(contact.phone),
        message: parsePreview(messageTemplate, contact),
      }));
      return Response.json({
        success: true,
        provider: "meta-cloud-api",
        dryRun: true,
        templateName: templateName?.trim() || null,
        templateLanguage,
        totalContacts: total,
        estimatedMinutes: Math.ceil(estimatedSeconds / 60),
        delaySeconds,
        samplePreviews,
      });
    }

    let successCount = 0;
    let failCount = 0;
    const logs: Array<{
      contact: string;
      phone: string;
      status: "enviado" | "falha";
      error?: string;
    }> = [];

    for (let index = 0; index < contacts.length; index++) {
      const contact = contacts[index];
      const cleanPhone = normalizeWhatsappPhone(contact.phone);
      if (!cleanPhone || cleanPhone.length < 12 || cleanPhone.length > 15) {
        failCount++;
        logs.push({ contact: contact.name, phone: contact.phone, status: "falha", error: "Telefone inválido" });
        continue;
      }

      try {
        const result = await graphSend(accessToken, {
          to: cleanPhone,
          type: "template",
          template: {
            name: templateName!.trim(),
            language: { code: templateLanguage.trim() || "pt_BR" },
          },
        });

        if (result.response.ok) {
          successCount++;
          logs.push({ contact: contact.name, phone: cleanPhone, status: "enviado" });
        } else {
          failCount++;
          logs.push({
            contact: contact.name,
            phone: cleanPhone,
            status: "falha",
            error: metaErrorMessage(result.data, result.response.status),
          });
        }
      } catch (error) {
        failCount++;
        logs.push({
          contact: contact.name,
          phone: cleanPhone,
          status: "falha",
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (index < contacts.length - 1 && delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    account.supabase
      .from("vf_audit_logs")
      .insert({
        actor_email: account.email,
        action: "Disparo em Massa WhatsApp Meta",
        detail: `Template: ${templateName} | Enviados: ${successCount} | Falhas: ${failCount} | Total: ${total}`,
      })
      .then(() => undefined)
      .catch(() => undefined);

    return Response.json({
      success: true,
      provider: "meta-cloud-api",
      templateName,
      templateLanguage,
      summary: {
        total,
        enviados: successCount,
        falhas: failCount,
        tempoExecucaoSegundos: Math.round(total * delaySeconds),
      },
      logs,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao processar disparo em massa." },
      { status: 500 },
    );
  }
}
