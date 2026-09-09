"use client";

import { useEffect } from "react";

export default function PwaInstaller() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[VOTO FORTE PWA] Service Worker registrado:", reg.scope);
          })
          .catch((err) => {
            console.warn("[VOTO FORTE PWA] Falha ao registrar Service Worker:", err);
          });
      });
    }
  }, []);

  return null;
}
