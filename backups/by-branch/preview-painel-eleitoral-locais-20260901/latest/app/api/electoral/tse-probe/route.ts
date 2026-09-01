export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const probes: Record<string, string> = {
  config2024: "https://resultados.tse.jus.br/oficial/ele2024/arquivo-urna/452/config/pr/pr-p000452-cs.json",
  aux2024s1: "https://resultados.tse.jus.br/oficial/ele2024/arquivo-urna/452/dados/pr/74276/0061/0001/p000452-pr-m74276-z0061-s0001-aux.json",
  mun2024: "https://resultados.tse.jus.br/oficial/ele2024/619/dados/pr/pr74276-c0011-e000619-u.json",
  zone2024: "https://resultados.tse.jus.br/oficial/ele2024/619/dados/pr/pr74276-z0061-c0011-e000619-u.json",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key") || "config2024";
  const url = probes[key];
  if (!url) return Response.json({ error: "Probe inválido" }, { status: 400 });

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "VotoForte/1.0 electoral-data-validation" },
    });
    const text = await response.text();
    return Response.json({
      key,
      url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      sample: text.slice(0, 5000),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha no probe", key, url },
      { status: 502 },
    );
  }
}
