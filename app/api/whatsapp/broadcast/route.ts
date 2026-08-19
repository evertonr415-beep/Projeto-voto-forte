import { getAccount } from "../../../server-identity";

type BroadcastContact = {
  id?: number | string;
  name: string;
  phone: string;
  district?: string;
  leader?: string;
};

type BroadcastPayload = {
  apiUrl?: string;
  apiToken?: string;
  contacts?: BroadcastContact[];
  messageTemplate?: string;
  delaySeconds?: number;
};

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as BroadcastPayload;
    const { apiUrl, apiToken, contacts, messageTemplate, delaySeconds = 5 } = body;

    if (!apiUrl || !apiToken) {
      return Response.json(
        { error: "Configure a URL da API e o Token do Whaticket/ZapAPI." },
        { status: 400 },
      );
    }

    if (!Array.isArray(contacts) || !contacts.length) {
      return Response.json(
        { error: "Nenhum contato selecionado para o disparo." },
        { status: 400 },
      );
    }

    if (!messageTemplate || !messageTemplate.trim()) {
      return Response.json(
        { error: "O modelo de mensagem é obrigatório." },
        { status: 400 },
      );
    }

    return Response.json({
      success: true,
      totalQueued: contacts.length,
      estimatedMinutes: Math.ceil((contacts.length * delaySeconds) / 60),
      delaySeconds,
      ready: true,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao validar campanha de disparo.",
      },
      { status: 500 },
    );
  }
}
