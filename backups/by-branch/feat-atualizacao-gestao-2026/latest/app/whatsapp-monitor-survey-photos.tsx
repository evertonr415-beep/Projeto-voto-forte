"use client";

import { useEffect } from "react";

type VisualAsset = {
  url?: string;
  fallback: string;
  alt: string;
  kind?: "portrait" | "flag" | "symbol";
};

const RAFAEL_CITA_PHOTO =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/2024_RAFAEL_CITA_CANDIDATO_PREFEITO_PR_ARAPONGAS_TSE_%28160002071893%29.jpg";
const PARANA_FLAG =
  "https://commons.wikimedia.org/wiki/Special:Redirect/file/Bandeira_do_Paran%C3%A1.svg?width=330";

const CANDIDATE_PHOTOS: Record<string, string> = {
  lula: "https://live.staticflickr.com/65535/55450244258_b5195947f7.jpg",
  "flavio bolsonaro": "https://legis.senado.leg.br/senadores/fotos-oficiais/5894",
  "augusto cury": "https://media.gcmais.com.br/site-assets/articles/politica/augusto-cury--rimg.webp",
  "renan santos": "https://static.poder360.com.br/2025/11/Renan-Santos-se-colocou-como-pre-candidato-para-presidencia-para-eleicoes-de-2026-2048x1152.jpg",
  "ronaldo caiado": "https://www.portalolavodutra.com.br/uploads/69ca9a1f5783a.webp",
  "romeu zema": "https://eleicoes.patria.agr.br/assets/romeu-zema-60E3nFzS.png",
  "sergio moro": "https://www.adjoriparana.com.br/uploads/images/2025/07/sergio-moro-lidera-corrida-para-o-governo-do-parana-em-2026-aponta-pesquisa-3887.webp",
  "requiao filho": "https://media.extraguarapuava.com.br/2026/03/c116e75b-requiao-filho--scaled.jpg",
  "sandro alex": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/160621.jpg",
  "luiz franca": "https://upload.wikimedia.org/wikipedia/commons/f/fd/2026_LUIZ_FRAN%C3%87A_CANDIDATO_GOVERNADOR_PR_TSE_%28160002551353%29.jpg",
  "neto santos": "https://cdn.tnonline.com.br/eleicoes/2026/pr/fotos/FPR160002542284_div.jpg",
  "ricardo barros": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73788.jpg",
  "pedro lupion": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204395.jpg",
  "beto preto": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220698.jpg",
  "luciano ducci": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  bonin: "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  "marco brasil": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/219585.jpg",
  "santin roveda": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/236518.jpg",
  "pedro paulo bazana": "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  "sergio onofre": "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  "aline franzon": "https://operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/3d/3d52390db67b93f272fe787733302a2aa3c14fffa9028456a5cc4388f595cffc.jpg",
  "delegado jacovos": "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  "cobra reporter": "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
};

const SURVEY_LABELS = new Set([
  "Deputado Estadual",
  "Deputado Federal",
  "Governador",
  "Presidente",
  "Gestão Municipal",
  "Gestão Estadual",
  "Região",
]);

const PRECONNECT_HOSTS = [
  "https://commons.wikimedia.org",
  "https://upload.wikimedia.org",
  "https://www.camara.leg.br",
  "https://live.staticflickr.com",
  "https://storage2.assembleia.pr.leg.br",
];

const warmedImages = new Set<string>();

function warmConnections() {
  PRECONNECT_HOSTS.forEach((href) => {
    if (document.head.querySelector(`link[data-vf-survey-preconnect="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.vfSurveyPreconnect = href;
    document.head.appendChild(link);
  });
}

function warmImage(url: string) {
  if (!url || warmedImages.has(url)) return;
  warmedImages.add(url);
  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.setAttribute("fetchpriority", "high");
  image.referrerPolicy = "no-referrer";
  image.src = url;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "VF";
}

function assetFor(label: string, value: string): VisualAsset {
  const normalized = normalize(value);

  if (label === "Gestão Municipal") {
    return {
      url: RAFAEL_CITA_PHOTO,
      fallback: "RC",
      alt: "Rafael Cita",
      kind: "portrait",
    };
  }

  if (label === "Gestão Estadual") {
    return {
      url: PARANA_FLAG,
      fallback: "PR",
      alt: "Bandeira oficial do Paraná",
      kind: "flag",
    };
  }

  if (label === "Região") {
    return { fallback: "⌖", alt: "Região", kind: "symbol" };
  }

  if (normalized.includes("outro candidato") || normalized === "outro") {
    return { fallback: "+", alt: "Outro candidato", kind: "symbol" };
  }
  if (normalized.includes("branco") || normalized.includes("nulo")) {
    return { fallback: "—", alt: "Branco ou nulo", kind: "symbol" };
  }
  if (normalized.includes("indeciso") || normalized.includes("ainda nao")) {
    return { fallback: "?", alt: "Ainda não sabe", kind: "symbol" };
  }

  return {
    url: CANDIDATE_PHOTOS[normalized],
    fallback: initials(value),
    alt: value,
    kind: "portrait",
  };
}

function makeAvatar(asset: VisualAsset) {
  const avatar = document.createElement("span");
  avatar.className = "vf-survey-answer-avatar";
  avatar.setAttribute("aria-label", asset.alt);
  if (asset.kind === "flag") avatar.classList.add("is-flag");

  const fallback = document.createElement("span");
  fallback.className = "vf-survey-answer-avatar-fallback";
  fallback.textContent = asset.fallback;

  if (!asset.url) {
    fallback.style.display = "grid";
    avatar.appendChild(fallback);
    return avatar;
  }

  warmImage(asset.url);

  const image = document.createElement("img");
  image.src = asset.url;
  image.alt = asset.alt;
  image.loading = "eager";
  image.decoding = "async";
  image.setAttribute("fetchpriority", "high");
  image.referrerPolicy = "no-referrer";
  image.addEventListener(
    "error",
    () => {
      image.style.display = "none";
      fallback.style.display = "grid";
    },
    { once: true },
  );

  avatar.append(image, fallback);
  return avatar;
}

function parseLine(line: string) {
  const clean = line.replace(/^[🏛️🇧🇷📍🗳️⭐📌\s]+/u, "").trim();
  const separator = clean.indexOf(":");
  if (separator < 1) return null;
  const label = clean.slice(0, separator).trim();
  const value = clean.slice(separator + 1).trim();
  if (!SURVEY_LABELS.has(label) || !value) return null;
  return { label, value };
}

function decorateSurveyReplies() {
  document.querySelectorAll<HTMLElement>(".wt-reply-detail").forEach((reply) => {
    const content = Array.from(reply.children).find((child) => {
      const text = (child.textContent || "").trim();
      return (
        child instanceof HTMLElement &&
        /(?:Deputado Estadual|Deputado Federal|Governador|Presidente|Gestão Municipal|Gestão Estadual):/.test(text)
      );
    }) as HTMLElement | undefined;

    if (!content || content.dataset.vfSurveyPhotos === "1") return;

    const originalText = (content.textContent || "").trim();
    const parsed = originalText
      .split(/\n+/)
      .map((line) => parseLine(line.trim()))
      .filter((item): item is { label: string; value: string } => Boolean(item));

    if (!parsed.length) return;

    parsed.forEach(({ label, value }) => {
      const asset = assetFor(label, value);
      if (asset.url) warmImage(asset.url);
    });

    content.dataset.vfSurveyPhotos = "1";
    content.dataset.vfSurveyOriginal = originalText;
    content.textContent = "";
    content.classList.add("vf-survey-answer-box");

    const list = document.createElement("div");
    list.className = "vf-survey-answer-list";

    parsed.forEach(({ label, value }) => {
      const row = document.createElement("div");
      row.className = "vf-survey-answer-row";

      const avatar = makeAvatar(assetFor(label, value));
      const copy = document.createElement("div");
      copy.className = "vf-survey-answer-copy";

      const labelNode = document.createElement("span");
      labelNode.className = "vf-survey-answer-label";
      labelNode.textContent = label;

      const valueNode = document.createElement("strong");
      valueNode.className = "vf-survey-answer-value";
      valueNode.textContent = value;

      copy.append(labelNode, valueNode);
      row.append(avatar, copy);
      list.appendChild(row);
    });

    content.appendChild(list);
  });
}

export default function WhatsappMonitorSurveyPhotos() {
  useEffect(() => {
    warmConnections();

    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        decorateSurveyReplies();
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("voto-forte:dashboard-route-view", schedule as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener("voto-forte:dashboard-route-view", schedule as EventListener);
    };
  }, []);

  return (
    <style>{`
      .vf-survey-answer-box {
        white-space: normal !important;
        padding: 8px !important;
      }
      .vf-survey-answer-list {
        display: grid;
        gap: 7px;
      }
      .vf-survey-answer-row {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 8px;
        border: 1px solid rgba(148, 163, 184, 0.13);
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.54);
      }
      .vf-survey-answer-avatar {
        width: 38px;
        height: 38px;
        min-width: 38px;
        overflow: hidden;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: linear-gradient(145deg, #eff6ff, #dbeafe);
        border: 2px solid rgba(255, 255, 255, 0.92);
        box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.35), 0 3px 10px rgba(2, 8, 23, 0.28);
      }
      .vf-survey-answer-avatar.is-flag {
        width: 44px;
        height: 31px;
        min-width: 44px;
        border-radius: 7px;
        background: #fff;
      }
      .vf-survey-answer-avatar img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
        object-position: center;
        background: #e2e8f0;
      }
      .vf-survey-answer-avatar.is-flag img {
        object-fit: cover;
        object-position: center;
        background: #fff;
      }
      .vf-survey-answer-avatar-fallback {
        width: 100%;
        height: 100%;
        display: none;
        place-items: center;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 900;
        line-height: 1;
      }
      .vf-survey-answer-copy {
        min-width: 0;
        flex: 1;
        display: grid;
        gap: 1px;
      }
      .vf-survey-answer-label {
        color: #94a3b8;
        font-size: 10px;
        line-height: 1.2;
        font-weight: 750;
        letter-spacing: .02em;
      }
      .vf-survey-answer-value {
        min-width: 0;
        color: #f8fafc;
        font-size: 13px;
        line-height: 1.3;
        font-weight: 760;
        overflow-wrap: anywhere;
      }
      @media (max-width: 760px) {
        .vf-survey-answer-list { gap: 6px; }
        .vf-survey-answer-row {
          gap: 9px;
          padding: 6px 7px;
          border-radius: 9px;
        }
        .vf-survey-answer-avatar {
          width: 36px;
          height: 36px;
          min-width: 36px;
        }
        .vf-survey-answer-avatar.is-flag {
          width: 42px;
          height: 30px;
          min-width: 42px;
          border-radius: 6px;
        }
        .vf-survey-answer-label { font-size: 9.5px; }
        .vf-survey-answer-value { font-size: 12.5px; }
      }
    `}</style>
  );
}
