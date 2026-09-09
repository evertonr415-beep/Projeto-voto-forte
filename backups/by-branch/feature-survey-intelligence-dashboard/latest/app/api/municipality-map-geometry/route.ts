import { getAccount } from "../../server-identity";

const IBGE_CODE = /^\d{7}$/;
const IBGE_MESH_BASE = "https://servicodados.ibge.gov.br/api/v3/malhas/municipios";

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const ibgeCode = String(url.searchParams.get("ibgeCode") || "").trim();
  if (!IBGE_CODE.test(ibgeCode)) {
    return Response.json({ error: "Código IBGE inválido" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(
      `${IBGE_MESH_BASE}/${ibgeCode}?formato=application/vnd.geo%2Bjson&qualidade=minima`,
      {
        headers: { accept: "application/vnd.geo+json, application/json" },
        signal: controller.signal,
        next: { revalidate: 604800 },
      },
    );

    if (!response.ok) {
      return Response.json(
        { error: "Malha municipal indisponível" },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const geometry = await response.json();
    return Response.json(
      { ibgeCode, geometry },
      {
        headers: {
          "cache-control": "private, max-age=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return Response.json({ error: "Malha municipal indisponível" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
