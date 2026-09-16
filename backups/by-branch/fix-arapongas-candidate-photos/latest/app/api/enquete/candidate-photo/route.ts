import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "storage2.assembleia.pr.leg.br",
  "divulgacandcontas.tse.jus.br",
  "www.camara.leg.br",
  "upload.wikimedia.org",
  "legis.senado.leg.br",
  "media.gcmais.com.br",
  "media.gazetadopovo.com.br",
  "static.poder360.com.br",
  "www.portalolavodutra.com.br",
  "eleicoes.patria.agr.br",
  "www.adjoriparana.com.br",
  "media.extraguarapuava.com.br",
  "www.bemparana.com.br",
  "cdn.tnonline.com.br",
  "www.jornalafolha.com.br",
  "cdn.tribunadonorte.com",
  "operamundi.uol.com.br",
  "media.agoraparana.com.br",
  "images.weserv.nl",
]);

const SOURCE_OVERRIDES = new Map<string, string>([
  [
    "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
    "https://media.gazetadopovo.com.br/2024/10/05065054/cristina-graeml.jpg",
  ],
]);

const IMAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
};

async function fetchImage(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: IMAGE_HEADERS,
      cache: "force-cache",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      return null;
    }

    return response;
  } catch {
    return null;
  }
}

function weservFallback(source: string) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(source)}&w=320&h=320&fit=cover&output=webp`;
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("url");

  if (!source) {
    return new Response("URL da foto não informada", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return new Response("URL inválida", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response("Origem da foto não permitida", { status: 403 });
  }

  const resolvedSource = SOURCE_OVERRIDES.get(parsed.toString()) || parsed.toString();

  let resolved: URL;
  try {
    resolved = new URL(resolvedSource);
  } catch {
    return new Response("URL da foto inválida", { status: 400 });
  }

  if (resolved.protocol !== "https:" || !ALLOWED_HOSTS.has(resolved.hostname)) {
    return new Response("Origem alternativa da foto não permitida", { status: 403 });
  }

  let image = await fetchImage(resolved.toString());

  if (!image && resolved.hostname !== "images.weserv.nl") {
    image = await fetchImage(weservFallback(resolved.toString()));
  }

  if (!image) {
    return new Response("Foto indisponível", { status: 404 });
  }

  const body = await image.arrayBuffer();
  const contentType = image.headers.get("content-type") || "image/jpeg";

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
