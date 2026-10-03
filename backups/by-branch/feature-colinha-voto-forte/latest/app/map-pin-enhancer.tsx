"use client";

import { useEffect } from "react";

function buildGoogleMapsUrl(text: string) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/Abrir no Google Maps/gi, "")
    .trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}`;
}

export default function MapPinEnhancer() {
  useEffect(() => {
    const enhancePopup = () => {
      document
        .querySelectorAll<HTMLElement>(".leaflet-popup-content")
        .forEach((popup) => {
          if (popup.querySelector("[data-vf-google-maps]")) return;

          const name = popup.querySelector("strong")?.textContent?.trim() || "";
          const details = popup.querySelector("small")?.textContent?.trim() || "";
          const address = popup.querySelector("p")?.textContent?.trim() || "";
          const query = [address, details, "Paraná, Brasil"]
            .filter(Boolean)
            .join(", ");

          const link = document.createElement("a");
          link.dataset.vfGoogleMaps = "true";
          link.className = "vf-google-maps-link";
          link.href = buildGoogleMapsUrl(query || name);
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.innerHTML = "<span>⌖</span> Abrir no Google Maps";
          link.setAttribute(
            "aria-label",
            `Abrir localização de ${name || "cadastro"} no Google Maps`,
          );
          popup.appendChild(link);
        });
    };

    const observer = new MutationObserver(enhancePopup);
    observer.observe(document.body, { childList: true, subtree: true });
    enhancePopup();
    return () => observer.disconnect();
  }, []);

  return null;
}
