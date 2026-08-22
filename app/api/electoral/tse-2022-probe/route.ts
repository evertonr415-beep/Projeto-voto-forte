import { NextResponse } from "next/server";

export async function GET() {
  const url = "https://resultados.tse.jus.br/oficial/ele2022/546/config/pr/pr-e000546-i.json";
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();

  return NextResponse.json({
    status: response.status,
    ok: response.ok,
    url,
    preview: text.slice(0, 12000),
  });
}
