"use client";

import { useEffect } from "react";

const candidatePhotos: Record<string, string> = {
  "neto santos": "https://cdn.tnonline.com.br/eleicoes/2026/pr/fotos/FPR160002542284_div.jpg",
  "ricardo barros": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/73788.jpg",
  "pedro lupion": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/204395.jpg",
  "beto preto": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/220698.jpg",
  "luciano ducci": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/178931.jpg",
  "bonin": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/229939.jpg",
  "marco brasil": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/219585.jpg",
  "santin roveda": "https://www.camara.leg.br/internet/deputado/bandep/pagina_do_deputado/236518.jpg",
  "pedro paulo bazana": "https://storage2.assembleia.pr.leg.br/img/dc2F-ZmpbyA27qC0TL7kKnAd088%3D/full-fit-in/800x600/noticias/imagens/6qu4Wqgbgk7dzTzMo4n0yWaj2zYuW9aoOcflw063.jpg",
  "sergio onofre": "https://cdn.tribunadonorte.com/img/Artigo-Destaque/850000/prefeito-de-Arapongas-Sergio-Onofre-00852193-0-202404052122.jpg?xid=1217861",
  "aline franzon": "https://operamundi.uol.com.br/wp-content/uploads/serverdoin-eleicoes/candidate-photos/v1/2026/sha256/3d/3d52390db67b93f272fe787733302a2aa3c14fffa9028456a5cc4388f595cffc.jpg",
  "delegado jacovos": "https://media.agoraparana.com.br/2024/08/c20d1cc3-5fe9sht8pfcain3esshpjrton9xxjqxvrzteehzh.jpg",
  "cobra reporter": "https://storage2.assembleia.pr.leg.br/img/a4si2EuU-5kB4x4DvCPGqXQ2LlU%3D/full-fit-in/800x600/noticias/imagens/wlqX5SAmnwgrjnuxgGGvY2a6fUbg4qoMOcpKcSAd.jpg",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateNameFrom(item: Element) {
  const label = item.querySelector<HTMLElement>(".survey-candidate-name")?.textContent || "";
  return label.replace(/^\s*\d+\s*º\s*/i, "").trim();
}

function initials(name: string) {
  const key = normalize(name);
  if (key.includes("indeciso") || key.includes("ainda nao sabe")) return "?";
  if (key.includes("outro")) return "+";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

function makeFallback(name: string) {
  const fallback = document.createElement("span");
  fallback.className = "vf-survey-candidate-fallback";
  fallback.textContent = initials(name);
  fallback.setAttribute("aria-hidden", "true");
  return fallback;
}

function enhanceRankingItem(item: HTMLElement) {
  const name = candidateNameFrom(item);
  if (!name) return;

  const normalizedName = normalize(name);
  if (item.dataset.vfCandidatePhoto === normalizedName) return;

  item.querySelector(".vf-survey-candidate-avatar")?.remove();

  const line = item.querySelector<HTMLElement>(".survey-ranking-line");
  const candidate = item.querySelector<HTMLElement>(".survey-candidate-name");
  if (!line || !candidate) return;

  const avatar = document.createElement("span");
  avatar.className = "vf-survey-candidate-avatar";
  avatar.setAttribute("aria-label", name);

  const photo = candidatePhotos[normalizedName];
  if (photo) {
    const image = document.createElement("img");
    image.src = photo;
    image.alt = `Foto de ${name}`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.replaceWith(makeFallback(name));
    }, { once: true });
    avatar.appendChild(image);
  } else {
    avatar.appendChild(makeFallback(name));
  }

  line.insertBefore(avatar, candidate);
  item.dataset.vfCandidatePhoto = normalizedName;
}

function enhanceAll() {
  document
    .querySelectorAll<HTMLElement>(".survey-drawer .survey-ranking-item")
    .forEach(enhanceRankingItem);
}

export default function SurveyRankingPhotoEnhancer() {
  useEffect(() => {
    let queued = false;
    const run = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        enhanceAll();
      });
    };

    run();
    window.addEventListener("voto-forte:open-survey-intelligence", run);

    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("voto-forte:open-survey-intelligence", run);
    };
  }, []);

  return (
    <style jsx global>{`
      .survey-drawer .survey-ranking-item {
        padding: 10px 11px !important;
        border: 1px solid rgba(148, 163, 184, 0.16) !important;
        border-radius: 12px !important;
        background: rgba(148, 163, 184, 0.055) !important;
      }

      .survey-drawer .survey-ranking-item:first-child {
        border-color: rgba(34, 197, 94, 0.34) !important;
        background: rgba(34, 197, 94, 0.065) !important;
      }

      .survey-drawer .survey-ranking-line {
        display: grid !important;
        grid-template-columns: 42px minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 9px !important;
        margin-bottom: 8px !important;
      }

      .survey-drawer .vf-survey-candidate-avatar {
        width: 42px;
        height: 42px;
        min-width: 42px;
        border-radius: 50%;
        overflow: hidden;
        display: grid;
        place-items: center;
        background: linear-gradient(145deg, #17324c, #0e2438);
        border: 2px solid rgba(148, 163, 184, 0.32);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
      }

      .survey-drawer .survey-ranking-item:first-child .vf-survey-candidate-avatar {
        border-color: #22c55e;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.12), 0 3px 10px rgba(0, 0, 0, 0.2);
      }

      .survey-drawer .vf-survey-candidate-avatar > img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
      }

      .survey-drawer .vf-survey-candidate-fallback {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #dbeafe;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: -0.02em;
      }

      .survey-drawer .survey-candidate-name {
        display: block !important;
        min-width: 0 !important;
        line-height: 1.25 !important;
        font-size: 13px !important;
        overflow-wrap: anywhere !important;
      }

      .survey-drawer .survey-candidate-name > b {
        display: inline-block;
        margin-right: 4px;
        color: #94a3b8;
        font-size: 11px;
      }

      .survey-drawer .survey-votes {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        justify-content: center !important;
        gap: 1px !important;
        line-height: 1.15 !important;
        font-size: 11px !important;
        white-space: nowrap !important;
      }

      .survey-drawer .survey-progress-track {
        display: block !important;
        width: calc(100% - 51px) !important;
        height: 9px !important;
        margin-left: 51px !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        background: rgba(148, 163, 184, 0.24) !important;
        box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18) !important;
      }

      .survey-drawer .survey-progress-fill {
        display: block !important;
        min-width: 5px !important;
        height: 100% !important;
        border-radius: 999px !important;
        opacity: 1 !important;
      }

      @media (max-width: 760px) {
        .survey-drawer .survey-ranking-list {
          gap: 9px !important;
        }

        .survey-drawer .survey-ranking-item {
          padding: 10px !important;
        }

        .survey-drawer .survey-ranking-line {
          grid-template-columns: 44px minmax(0, 1fr) auto !important;
          gap: 9px !important;
        }

        .survey-drawer .vf-survey-candidate-avatar {
          width: 44px;
          height: 44px;
          min-width: 44px;
        }

        .survey-drawer .survey-candidate-name {
          font-size: 13px !important;
        }

        .survey-drawer .survey-votes {
          font-size: 10.5px !important;
        }

        .survey-drawer .survey-progress-track {
          width: calc(100% - 53px) !important;
          margin-left: 53px !important;
          height: 8px !important;
        }
      }
    `}</style>
  );
}
