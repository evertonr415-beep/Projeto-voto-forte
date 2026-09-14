"use client";

import { useEffect } from "react";

const PHOTO_FIXES = [
  {
    label: "Lula",
    url: "https://live.staticflickr.com/65535/55450244258_b5195947f7.jpg",
  },
  {
    label: "Sandro Alex (PSD)",
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

  document.querySelectorAll<HTMLElement>('div[aria-hidden="true"]').forEach((avatar) => {
    if (avatar.dataset.photoFix === "1") return;

    let context: HTMLElement | null = avatar.parentElement;
    let matchedUrl = "";

    for (let depth = 0; context && depth < 4; depth += 1, context = context.parentElement) {
      const text = context.textContent || "";
      const match = PHOTO_FIXES.find(({ label }) => text.includes(label));
      if (match) {
        matchedUrl = match.url;
        break;
      }
    }

    if (!matchedUrl) return;

    avatar.dataset.photoFix = "1";
    avatar.textContent = "";
    avatar.style.backgroundImage = `url("${matchedUrl}")`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
    avatar.style.backgroundRepeat = "no-repeat";
    avatar.style.color = "transparent";
  });
}

export default function ArapongasFotosPreviewLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyPhotoFixes();

    const observer = new MutationObserver(() => applyPhotoFixes());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return children;
}
