"use client";

import { useEffect, useState } from "react";
import EnqueteArapongasFotosPreviewPage from "../arapongas-fotos-preview/page";
import ArapongasFotosPreviewLayout from "../arapongas-fotos-preview/layout";

const OFFICIAL_PARTICIPANT_KEY = "vf_poll_arapongas_pid_v1";
const VISUAL_PARTICIPANT_KEY = "vf_poll_arapongas_photos_preview_pid_v1";
const RESULT_URL = "https://www.votofortearapongas.com.br/resultado/?v=20260915";

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${name}=`))
      ?.split("=")[1] || ""
  );
}

export default function EnqueteArapongasPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const patchedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      try {
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

        if (method === "POST" && requestUrl.includes("/api/enquete/arapongas-fotos-preview")) {
          let action = "";
          if (typeof init?.body === "string") {
            try {
              action = String(JSON.parse(init.body)?.action || "");
            } catch {
              action = "";
            }
          }

          if (action === "submit" || action === "status") {
            const data = await response.clone().json().catch(() => null);
            const shouldRedirect =
              action === "submit"
                ? response.ok && (data?.success || data?.alreadyAnswered)
                : response.ok && data?.alreadyAnswered;

            if (shouldRedirect) {
              window.setTimeout(() => {
                window.location.assign(RESULT_URL);
              }, action === "status" ? 40 : 180);
            }
          }
        }
      } catch {
        // Se a detecção falhar, preserva o fluxo normal da enquete.
      }

      return response;
    };

    window.fetch = patchedFetch;

    try {
      const officialId =
        window.localStorage.getItem(OFFICIAL_PARTICIPANT_KEY) || readCookie(OFFICIAL_PARTICIPANT_KEY);

      if (officialId) {
        window.localStorage.setItem(VISUAL_PARTICIPANT_KEY, officialId);
        document.cookie = `${VISUAL_PARTICIPANT_KEY}=${officialId}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`;
      }
    } catch {
      // A tela ainda funciona normalmente se o navegador bloquear armazenamento local.
    } finally {
      setReady(true);
    }

    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    };
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f6f8fc",
          color: "#64748b",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Carregando enquete...
      </div>
    );
  }

  return (
    <ArapongasFotosPreviewLayout>
      <EnqueteArapongasFotosPreviewPage />
    </ArapongasFotosPreviewLayout>
  );
}
