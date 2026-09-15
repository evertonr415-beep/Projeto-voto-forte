"use client";

import { useEffect, useState } from "react";
import EnqueteArapongasFotosPreviewPage from "../arapongas-fotos-preview/page";
import ArapongasFotosPreviewLayout from "../arapongas-fotos-preview/layout";

const OFFICIAL_PARTICIPANT_KEY = "vf_poll_arapongas_pid_v1";
const VISUAL_PARTICIPANT_KEY = "vf_poll_arapongas_photos_preview_pid_v1";
const CANONICAL_ORIGIN = "https://sistemavotoforte.com.br";
const CANONICAL_PATH = "/enquete/arapongas";

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
    // A enquete pública deve permanecer no endereço oficial. URLs únicas de preview
    // da Vercel não entram nesta regra para continuarem disponíveis para testes.
    const host = window.location.hostname.toLowerCase();
    const publicAliases = new Set([
      "www.sistemavotoforte.com.br",
      "voto-forte-parana.vercel.app",
      "voto-forte-parana-evertonr415-1150s-projects.vercel.app",
      "voto-forte-parana-git-main-evertonr415-1150s-projects.vercel.app",
    ]);

    if (publicAliases.has(host)) {
      const canonicalUrl = `${CANONICAL_ORIGIN}${CANONICAL_PATH}${window.location.search}${window.location.hash}`;
      window.location.replace(canonicalUrl);
      return;
    }

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
