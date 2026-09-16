"use client";

import { useEffect } from "react";

const PHOTO_FIXES = [
  {
    label: "Lula",
    url: "https://live.staticflickr.com/65535/55450244258_b5195947f7.jpg",
  },
  {
    label: "Sandro Alex",
    url: "https://upload.wikimedia.org/wikipedia/commons/9/95/Sandro_Alex_em_fevereiro_de_2015.jpg",
  },
] as const;

function applyPhotoFixes() {
  for (const { label, url } of PHOTO_FIXES) {
    document.querySelectorAll<HTMLImageElement>(`img[alt="${label}"]`).forEach((img) => {
      if (img.dataset.photoFix === "1") return;
      img.dataset.photoFix = "1";
      img.src = url;
    });
  }

  // Fallback somente para o card imediato do candidato correto.
  // Não percorre mais ancestrais da página, evitando aplicar a foto em
  // opções genéricas como Outro, Branco/Nulo e Ainda não sei.
  document.querySelectorAll<HTMLElement>('div[aria-hidden="true"]').forEach((avatar) => {
    if (avatar.dataset.photoFix === "1") return;

    const card = avatar.parentElement;
    if (!card) return;

    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    const match = PHOTO_FIXES.find(({ label }) =>
      text === label ||
      text.startsWith(`${label} `) ||
      text.includes(`${label} (`) ||
      text.includes(`${label} PT`) ||
      text.includes(`${label} PSD`),
    );

    if (!match) return;

    avatar.dataset.photoFix = "1";
    avatar.textContent = "";
    avatar.style.backgroundImage = `url("${match.url}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.backgroundRepeat = "no-repeat";
    avatar.style.color = "transparent";
  });
}

function applyRankingLayoutFixes() {
  document.querySelectorAll<HTMLElement>("strong").forEach((percentage) => {
    if (!/^\d+(?:[.,]\d+)?%$/.test((percentage.textContent || "").trim())) return;

    const header = percentage.parentElement as HTMLElement | null;
    const content = header?.parentElement as HTMLElement | null;
    const row = content?.parentElement as HTMLElement | null;
    const identity = header?.firstElementChild as HTMLElement | null;

    if (!header || !content || !row || !identity || row.children.length < 2) return;

    row.dataset.rankingLayoutFix = "1";
    row.style.display = "grid";
    row.style.gridTemplateColumns = row.children.length >= 3
      ? "48px minmax(0, 1fr) 24px"
      : "48px minmax(0, 1fr)";
    row.style.alignItems = "center";
    row.style.columnGap = "11px";
    row.style.width = "100%";
    row.style.boxSizing = "border-box";
    row.style.overflow = "hidden";

    content.style.minWidth = "0";
    content.style.width = "100%";
    content.style.overflow = "hidden";

    header.style.display = "grid";
    header.style.gridTemplateColumns = "minmax(0, 1fr) minmax(50px, auto)";
    header.style.alignItems = "start";
    header.style.columnGap = "8px";
    header.style.width = "100%";
    header.style.minWidth = "0";

    identity.style.display = "grid";
    identity.style.gridTemplateColumns = "minmax(0, 1fr)";
    identity.style.alignItems = "start";
    identity.style.minWidth = "0";
    identity.style.overflow = "hidden";

    const identityParts = Array.from(identity.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const candidateName = identityParts[0];
    const party = identityParts[1];

    if (candidateName) {
      candidateName.style.display = "block";
      candidateName.style.minWidth = "0";
      candidateName.style.maxWidth = "100%";
      candidateName.style.overflow = "hidden";
      candidateName.style.textOverflow = "ellipsis";
      candidateName.style.whiteSpace = "nowrap";
    }

    if (party) {
      party.style.justifySelf = "start";
      party.style.marginLeft = "0";
      party.style.marginTop = "3px";
      party.style.maxWidth = "100%";
      party.style.overflow = "hidden";
      party.style.textOverflow = "ellipsis";
      party.style.whiteSpace = "nowrap";
    }

    percentage.style.display = "block";
    percentage.style.minWidth = "50px";
    percentage.style.textAlign = "right";
    percentage.style.justifySelf = "end";
    percentage.style.whiteSpace = "nowrap";
    percentage.style.lineHeight = "1.25";

    if (row.children.length >= 3) {
      const trophy = row.lastElementChild as HTMLElement | null;
      if (trophy && trophy !== content) {
        trophy.style.width = "24px";
        trophy.style.minWidth = "24px";
        trophy.style.textAlign = "center";
        trophy.style.justifySelf = "center";
      }
    }
  });
}

function applyPreviewFixes() {
  applyPhotoFixes();
  applyRankingLayoutFixes();
}

export default function ArapongasFotosPreviewLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyPreviewFixes();

    const observer = new MutationObserver(() => applyPreviewFixes());
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", applyRankingLayoutFixes);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applyRankingLayoutFixes);
    };
  }, []);

  return children;
}
