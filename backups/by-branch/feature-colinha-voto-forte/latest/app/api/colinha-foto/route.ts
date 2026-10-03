import { NextRequest, NextResponse } from "next/server";

const ELEICAO = "20322002026";
const cargos: Record<string, { local: string; codigo: string }> = {
  "Deputado Federal": { local: "PR", codigo: "6" },
  "Deputado Estadual": { local: "PR", codigo: "7" },
  "Senador 1": { local: "PR", codigo: "5" },
  "Senador 2": { local: "PR", codigo: "5" },
  Governador: { local: "PR", codigo: "3" },
  Presidente: { local: "BR", codigo: "1" },
};

export const revalidate = 21600;

export async function GET(req: NextRequest) {
  const cargo = req.nextUrl.searchParams.get("cargo") || "";
  const numero = req.nextUrl.searchParams.get("numero") || "";
  const cfg = cargos[cargo];
  if (!cfg || !/^\d+$/.test(numero)) return new NextResponse(null, { status: 400 });

  try {
    const listaUrl = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/2026/${cfg.local}/${ELEICAO}/${cfg.codigo}/candidatos`;
    const listaRes = await fetch(listaUrl, {
      next: { revalidate: 21600 },
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: "https://divulgacandcontas.tse.jus.br/divulga/",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!listaRes.ok) return new NextResponse(null, { status: 404 });
    const dados = await listaRes.json();
    const candidatos = Array.isArray(dados?.candidatos) ? dados.candidatos : [];
    const candidato = candidatos.find((c: any) => String(c?.numero ?? c?.nr_CANDIDATO ?? "") === numero);
    const fotoUrl = candidato?.fotoUrl || candidato?.urlFoto;
    if (!fotoUrl) return new NextResponse(null, { status: 404 });

    const fotoRes = await fetch(fotoUrl, {
      next: { revalidate: 21600 },
      headers: { Referer: "https://divulgacandcontas.tse.jus.br/divulga/", "User-Agent": "Mozilla/5.0" },
    });
    if (!fotoRes.ok) return new NextResponse(null, { status: 404 });
    const bytes = await fotoRes.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": fotoRes.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
