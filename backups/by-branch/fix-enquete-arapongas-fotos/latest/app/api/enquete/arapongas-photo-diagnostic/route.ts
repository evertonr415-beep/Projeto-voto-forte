const photos: Record<string, string> = {
  alexandre_curi: "https://storage2.assembleia.pr.leg.br/img/y3n1sE1n35-E4-L_2B8B_P5U3qQ=/full-fit-in/300x300/deputados/alexandre-curi.png",
  cristina_graeml: "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/foto/2/160002005080/2024/75353",
  deltan_dallagnol: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220559.jpg",
  dr_rosinha: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73459.jpg",
  filipe_barros: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204374.jpg",
  gleisi: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/74416.jpg",
  lula_pt: "https://www.gov.br/planejamento/pt-br/assuntos/noticias/2026/imagens/55156120202_eb131de887_o.jpg",
  flavio_bolsonaro_pl: "https://legis.senado.leg.br/senadores/fotos-oficiais/5894",
  augusto_cury_avante: "https://media.gcmais.com.br/site-assets/articles/politica/augusto-cury--rimg.webp",
  renan_santos_missao: "https://static.poder360.com.br/2025/11/Renan-Santos-se-colocou-como-pre-candidato-para-presidencia-para-eleicoes-de-2026-2048x1152.jpg",
  ronaldo_caiado_psd: "https://www.portalolavodutra.com.br/uploads/69ca9a1f5783a.webp",
  romeu_zema_novo: "https://eleicoes.patria.agr.br/assets/romeu-zema-60E3nFzS.png",
  sergio_moro_pl: "https://www.adjoriparana.com.br/uploads/images/2025/07/sergio-moro-lidera-corrida-para-o-governo-do-parana-em-2026-aponta-pesquisa-3887.webp",
  requiao_filho_pdt: "https://media.extraguarapuava.com.br/2026/03/c116e75b-requiao-filho--scaled.jpg",
  sandro_alex_psd: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/160621.jpg",
  luiz_franca_missao: "https://busaocuritiba.com/wp-content/uploads/2025/09/Luiz-Franca-pre-candidato-ao-governo-do-Parana-pelo-MBL-1600x900.jpg",
  neto_santos: "https://cdn.tnonline.com.br/eleicoes/2026/pr/fotos/FPR160002542284_div.jpg",
  ricardo_barros: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73788.jpg",
  pedro_lupion: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204395.jpg",
  beto_preto: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220698.jpg",
  luciano_ducci: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  bonin: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  marco_brasil: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/219585.jpg",
  santin_roveda: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/236518.jpg",
  pedro_paulo_bazana: "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  sergio_onofre: "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  aline_franzon: "https://operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/3d/3d52390db67b93f272fe787733302a2aa3c14fffa9028456a5cc4388f595cffc.jpg",
  delegado_jacovos: "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  cobra_reporter: "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
};

async function inspect(name: string, url: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-32",
        "User-Agent": "Mozilla/5.0 VotoFortePhotoDiagnostic/1.0",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const contentType = response.headers.get("content-type") || "";
    return {
      name,
      status: response.status,
      ok: response.ok,
      contentType,
      image: response.ok && contentType.toLowerCase().startsWith("image/"),
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      name,
      status: 0,
      ok: false,
      contentType: "",
      image: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const results = await Promise.all(Object.entries(photos).map(([name, url]) => inspect(name, url)));
  return Response.json({
    total: results.length,
    broken: results.filter((item) => !item.image),
    results,
  }, { headers: { "Cache-Control": "no-store" } });
}
