import { getAccount } from "../../../server-identity";

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
  apiUrl?: string;
  apiToken?: string;
  contacts?: BroadcastContact[];
  messageTemplate?: string;
  delaySeconds?: number;
  dryRun?: boolean;
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function parseTemplate(template: string, contact: BroadcastContact): string {
  const firstName = (contact.name || "").trim().split(/\s+/)[0] || "";
  return template
    .replace(/\{nome\}/gi, contact.name || "")
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{bairro\}/gi, contact.district || "sua região")
    .replace(/\{cidade\}/gi, contact.city || "Arapongas")
    .replace(/\{lideranca\}/gi, contact.leader || "");
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as BroadcastPayload;
    const {
      apiUrl,
      apiToken,
      contacts,
      messageTemplate,
      delaySeconds = 3,
      dryRun = false,
    } = body;

    if (!apiUrl || !apiToken) {
      return Response.json(
        { error: "Configure a URL da API e o Token da ZapAPI/Whaticket." },
        { status: 400 },
      );
    }

    if (!Array.isArray(contacts) || !contacts.length) {
      return Response.json(
        { error: "Nenhum contato fornecido para o disparo." },
        { status: 400 },
      );
    }

    if (!messageTemplate || !messageTemplate.trim()) {
      return Response.json(
        { error: "O modelo de mensagem é obrigatório." },
        { status: 400 },
      );
    }

    const cleanApiUrl = apiUrl.replace(/\/+$/, "");
    const total = contacts.length;
    const estimatedSeconds = total * Math.max(1, delaySeconds);

    // If dry run, return summary and previews without sending
    if (dryRun) {
      const samplePreviews = contacts.slice(0, 3).map((c) => ({
        contact: c.name,
        phone: normalizePhone(c.phone),
        message: parseTemplate(messageTemplate, c),
      }));

      return Response.json({
        success: true,
        dryRun: true,
        totalContacts: total,
        estimatedMinutes: Math.ceil(estimatedSeconds / 60),
        delaySeconds,
        samplePreviews,
      });
    }

    // Standard endpoints for Whaticket / ZapAPI
    const sendEndpoint = `${cleanApiUrl}/api/messages/send`;

    let successCount = 0;
    let failCount = 0;
    const logs: Array<{
      contact: string;
      phone: string;
      status: "enviado" | "falha";
      error?: string;
    }> = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const cleanPhone = normalizePhone(contact.phone);

      if (!cleanPhone || cleanPhone.length < 10) {
        failCount++;
        logs.push({
          contact: contact.name,
          phone: contact.phone,
          status: "falha",
          error: "Telefone inválido",
        });
        continue;
      }

      const personalizedMessage = parseTemplate(messageTemplate, contact);

      try {
        const payload = {
          number: cleanPhone,
          body: personalizedMessage,
          phone: cleanPhone,
          message: personalizedMessage,
          readChat: true,
        };

        const res = await fetch(sendEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken.trim()}`,
            apikey: apiToken.trim(),
            "X-Token": apiToken.trim(),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (res.ok) {
          successCount++;
          logs.push({
            contact: contact.name,
            phone: cleanPhone,
            status: "enviado",
          });
        } else {
          const errText = await res.text();
          failCount++;
          logs.push({
            contact: contact.name,
            phone: cleanPhone,
            status: "falha",
            error: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
          });
        }
      } catch (err) {
        failCount++;
        logs.push({
          contact: contact.name,
          phone: cleanPhone,
          status: "falha",
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Delay between sends to prevent blocking (except after last message)
      if (i < contacts.length - 1 && delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    // Register audit log
    account.supabase
      .from("vf_audit_logs")
      .insert({
        actor_email: account.email,
        action: "Disparo em Massa WhatsApp",
        detail: `Enviados: ${successCount} | Falhas: ${failCount} | Total: ${total}`,
      })
      .then(() => undefined)
      .catch(() => undefined);

    return Response.json({
      success: true,
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao processar disparo em massa.",
      },
      { status: 500 },
    );
  }
}
