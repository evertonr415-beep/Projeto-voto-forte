"use client";

import { useEffect, useState } from "react";
import EnqueteArapongasFotosPreviewPage from "../arapongas-fotos-preview/page";

const OFFICIAL_PARTICIPANT_KEY = "vf_poll_arapongas_pid_v1";
const VISUAL_PARTICIPANT_KEY = "vf_poll_arapongas_photos_preview_pid_v1";

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

  return <EnqueteArapongasFotosPreviewPage />;
}
