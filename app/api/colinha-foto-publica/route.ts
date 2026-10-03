import { NextRequest, NextResponse } from "next/server";

const slugs: Record<string,string> = {
  "Senador 2:131":"gleisi-pr-131","Senador 2:132":"dr-rosinha-pr-132","Senador 2:144":"karen-guerreiro-pr-144","Senador 2:222":"filipe-barros-pr-222","Senador 2:290":"marcelo-marcelino-pr-290","Senador 2:300":"deltan-dallagnol-pr-300","Senador 2:555":"cristina-reis-graeml-pr-555","Senador 2:800":"joaquim-do-mlb-pr-800",
  "Governador:29":"adriano-funileiro-pr-29","Governador:33":"alexandre-salomao-pr-33","Governador:14":"luiz-franca-pr-14","Governador:12":"requiao-filho-pr-12","Governador:16":"samuel-de-mattos-pr-16","Governador:55":"sandro-alex-pr-55","Governador:22":"sergio-moro-pr-22","Governador:80":"tayna-miessa-pr-80",
  "Presidente:27":"clariana-barao-br-27","Presidente:21":"edmilson-costa-br-21","Presidente:70":"escritor-augusto-cury-br-70","Presidente:22":"flavio-bolsonaro-br-22","Presidente:16":"hertz-dias-br-16","Presidente:13":"lula-br-13","Presidente:14":"renan-santos-br-14","Presidente:55":"ronaldo-caiado-br-55","Presidente:29":"rui-costa-pimenta-br-29","Presidente:80":"samara-br-80","Presidente:35":"veterinario-wilson-grassi-br-35","Presidente:30":"zema-br-30"
};

export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const cargo=req.nextUrl.searchParams.get("cargo")||"";
  const numero=req.nextUrl.searchParams.get("numero")||"";
  const slug=slugs[`${cargo}:${numero}`];
  if(!slug) return new NextResponse(null,{status:404});
  try {
    const page=await fetch(`https://nortiva.io/eleicoes/2026/candidatos/${slug}`,{next:{revalidate:86400},headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});
    if(!page.ok) return new NextResponse(null,{status:502});
    const html=await page.text();
    const match=html.match(/(?:https:\/\/nortiva\.io)?(\/eleicoes\/foto\/\d+\.jpg)/i);
    if(!match) return new NextResponse(null,{status:404});
    const foto=await fetch(`https://nortiva.io${match[1]}`,{next:{revalidate:86400},headers:{"User-Agent":"Mozilla/5.0","Referer":"https://nortiva.io/"}});
    if(!foto.ok) return new NextResponse(null,{status:502});
    const tipo=foto.headers.get("content-type")||"image/jpeg";
    const bytes=await foto.arrayBuffer();
    return new NextResponse(bytes,{status:200,headers:{"Content-Type":tipo,"Cache-Control":"public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"}});
  } catch {
    return new NextResponse(null,{status:502});
  }
}
