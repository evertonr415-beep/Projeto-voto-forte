export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2024_PR.zip";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return Response.json({ error: "Disponível apenas no preview" }, { status: 404 });
  }

  try {
    const response = await fetch(SOURCE, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
        accept: "application/zip,application/octet-stream;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        referer: "https://dadosabertos.tse.jus.br/",
        range: "bytes=0-63",
      },
    });

    const body = Buffer.from(await response.arrayBuffer());
    return Response.json({
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      server: response.headers.get("server"),
      firstBytesHex: body.subarray(0, 16).toString("hex"),
      bytesReceived: body.length,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha no teste" }, { status: 502 });
  }
}
