const SOURCE_URL = "https://sistemavotoforte.com.br/api/enquete/arapongas-fotos-preview";

const ALLOWED_ORIGINS = new Set([
  "https://www.votofortearapongas.com.br",
  "https://votofortearapongas.com.br",
]);

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.votofortearapongas.com.br";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403, headers: corsHeaders("") });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json(
      { success: false, error: "Origem não autorizada" },
      { status: 403, headers: corsHeaders("") },
    );
  }

  try {
    const upstream = await fetch(`${SOURCE_URL}?t=${Date.now()}`, { cache: "no-store" });
    const body = await upstream.text();
    const headers = new Headers(corsHeaders(origin));
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");

    return new Response(body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("[public-arapongas-results] upstream failed", error);
    return Response.json(
      { success: false, error: "Falha ao carregar resultados" },
      { status: 502, headers: corsHeaders(origin) },
    );
  }
}
