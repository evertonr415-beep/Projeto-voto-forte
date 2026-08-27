type IbgeMunicipality = {
  id: number;
  nome: string;
};

const IBGE_PR_MUNICIPALITIES_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios?orderBy=nome";

export async function GET() {
  try {
    const response = await fetch(IBGE_PR_MUNICIPALITIES_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error("Falha ao consultar os municípios do IBGE");

    const data = (await response.json()) as IbgeMunicipality[];
    const municipalities = data.map((item) => ({
      id: item.id,
      name: item.nome,
      state: "PR",
    }));

    return Response.json(
      { municipalities, count: municipalities.length, source: "IBGE" },
      { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch {
    return Response.json(
      { error: "Não foi possível carregar os municípios do Paraná" },
      { status: 502 },
    );
  }
}
