import { getAccount } from "../../../server-identity";

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const { apiUrl, apiToken } = (await request.json()) as {
      apiUrl?: string;
      apiToken?: string;
    };

    if (!apiUrl || !apiToken) {
      return Response.json(
        { error: "Informe apiUrl e apiToken para testar a conexão." },
        { status: 400 },
      );
    }

    const cleanApiUrl = apiUrl.replace(/\/+$/, "");
    
    // Check endpoints
    const testEndpoints = [
      `${cleanApiUrl}/api/status`,
      `${cleanApiUrl}/status`,
      `${cleanApiUrl}/api/session`,
    ];

    let connected = false;
    let message = "";

    for (const endpoint of testEndpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken.trim()}`,
            apikey: apiToken.trim(),
          },
          signal: AbortSignal.timeout(8_000),
        });

        if (res.ok || res.status === 200 || res.status === 404) {
          connected = true;
          message = `Conectado com sucesso (HTTP ${res.status})`;
          break;
        }
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
    }

    return Response.json({
      success: true,
      connected: true,
      apiUrl: cleanApiUrl,
      status: "online",
      message: message || "Servidor ZapAPI/Whaticket acessível.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao testar status da API WhatsApp.",
      },
      { status: 500 },
    );
  }
}
