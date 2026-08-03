"use client";

import { useEffect } from "react";

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function SafeMapContactTools() {
  useEffect(() => {
    const enhance = () => {
      document
        .querySelectorAll<HTMLElement>(".leaflet-popup-content")
        .forEach((popup) => {
          if (popup.querySelector("[data-vf-google-maps-link]")) return;

          const name = popup.querySelector("strong")?.textContent?.trim() || "Cadastro";
          const details = popup.querySelector("small")?.textContent?.trim() || "";
          const address = popup.querySelector("p")?.textContent?.trim() || "";
          const query = [address, details, "Paraná", "Brasil"]
            .filter(Boolean)
            .join(", ");

          const link = document.createElement("a");
          link.dataset.vfGoogleMapsLink = "true";
          link.className = "vf-safe-google-maps-link";
          link.href = mapsUrl(query || name);
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Abrir no Google Maps";
          popup.appendChild(link);
        });
    };

    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();
    return () => observer.disconnect();
  }, []);

  return null;
}
