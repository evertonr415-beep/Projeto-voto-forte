"use client";

import { useEffect } from "react";

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function SafeMapContactTools() {
  useEffect(() => {
    const enhancePopup = (popup: HTMLElement) => {
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
    };

    const enhanceNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(".leaflet-popup-content")) enhancePopup(node);
      node
        .querySelectorAll<HTMLElement>(".leaflet-popup-content")
        .forEach(enhancePopup);
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) enhanceNode(node);
      }
    });

    const mapRoot = document.querySelector(".leaflet-container")?.parentElement || document.body;
    observer.observe(mapRoot, { childList: true, subtree: true });
    document
      .querySelectorAll<HTMLElement>(".leaflet-popup-content")
      .forEach(enhancePopup);

    return () => observer.disconnect();
  }, []);

  return null;
}
