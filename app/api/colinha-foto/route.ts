import { NextRequest, NextResponse } from "next/server";

const ELEICAO = "20322002026";
const TSE_ORIGIN = "https://divulgacandcontas.tse.jus.br";
const TSE_API = `${TSE_ORIGIN}/divulga/rest/v1`;
const cargos: Record<string, { local: string; codigo: string }> = {
  "Deputado Federal": { local: "PR", codigo: "6" },
  "Deputado Estadual": { local: "PR", codigo: "7" },
  "Senador 1": { local: "PR", codigo: "5" },
  "Senador 2": { local: "PR", codigo: "5" },
  Governador: { local: "PR", codigo: "3" },
  Presidente: { local: "BR", codigo: "1" },
};

export const revalidate = 21600;

const headers = {
  Accept: "application/json, text/plain, */*",
  Referer: `${TSE_ORIGIN}/divulga/`,
  "User-Agent": "Mozilla/5.0 (compatible; VotoForte/1.0)",
};

function normalizarNumero(valor: unknown) {
  return String(valor ?? "").replace(/\D/g, "").replace(/^0+/, "") || "0";
}

export async function GET(req: NextRequest) {
  const cargo = req.nextUrl.searchParams.get("cargo") || "";
  const numero = req.nextUrl.searchParams.get("numero") || "";
  const cfg = cargos[cargo];
  if (!cfg || !/^\d+$/.test(numero)) return new NextResponse(null, { status: 400 });

  try {
    const listaUrl = `${TSE_API}/candidatura/listar/2026/${cfg.local}/${ELEICAO}/${cfg.codigo}/candidatos`;
    const listaRes = await fetch(listaUrl, { next: { revalidate: 21600 }, headers });
    if (!listaRes.ok) return new NextResponse(null, { status: 502 });

    const dados = await listaRes.json();
    const candidatos = Array.isArray(dados?.candidatos) ? dados.candidatos : [];
    const candidato = candidatos.find((c: any) => normalizarNumero(c?.numero ?? c?.nr_CANDIDATO) === normalizarNumero(numero));
    if (!candidato?.id) return new NextResponse(null, { status: 404 });

    // O endpoint de listagem nem sempre devolve fotoUrl. A imagem oficial do TSE
    // é servida de forma estável pelo identificador sequencial da candidatura.
    const fotoDireta = `${TSE_ORIGIN}/divulga/rest/arquivo/img/${ELEICAO}/${encodeURIComponent(String(candidato.id))}/${cfg.local}`;
    const urls = [fotoDireta, candidato?.fotoUrl, candidato?.urlFoto].filter(Boolean) as string[];

    for (const url of urls) {
      try {
        const fotoRes = await fetch(url.startsWith("http") ? url : `${TSE_ORIGIN}${url}`, {
          next: { revalidate: 21600 },
          headers: { Referer: `${TSE_ORIGIN}/divulga/`, "User-Agent": headers["User-Agent"] },
        });
        if (!fotoRes.ok) continue;
        const tipo = fotoRes.headers.get("content-type") || "";
        if (!tipo.startsWith("image/")) continue;
        const bytes = await fotoRes.arrayBuffer();
        return new NextResponse(bytes, {
          status: 200,
          headers: {
            "Content-Type": tipo || "image/jpeg",
            "Cache-Control": "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400",
          },
        });
      } catch {
        // tenta a próxima origem disponível
      }
    }

    return new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
