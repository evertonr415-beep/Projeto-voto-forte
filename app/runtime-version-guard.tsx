"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VERSION_CHECK_INTERVAL_MS = 30 * 1000;

type VersionPayload = {
  version?: string;
};

export default function RuntimeVersionGuard() {
  const baselineVersion = useRef("");
  const checking = useRef(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkVersion = useCallback(async () => {
    if (checking.current || updateAvailable) return;
    checking.current = true;
    try {
      const response = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      if (!response.ok) return;
      const data = (await response.json()) as VersionPayload;
      const nextVersion = String(data.version || "").trim();
      if (!nextVersion) return;

      if (!baselineVersion.current) {
        baselineVersion.current = nextVersion;
        return;
      }

      if (nextVersion !== baselineVersion.current) setUpdateAvailable(true);
    } catch {
      // Version checks are best-effort and must never block the application.
    } finally {
      checking.current = false;
    }
  }, [updateAvailable]);

  useEffect(() => {
    void checkVersion();

    const handleFocus = () => void checkVersion();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const timer = window.setInterval(
      () => void checkVersion(),
      VERSION_CHECK_INTERVAL_MS,
    );

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkVersion]);

  if (!updateAvailable) return null;

  return (
    <aside className="vf-runtime-update" role="status" aria-live="polite">
      <div>
        <strong>Nova versão do VOTO FORTE disponível</strong>
        <span>
          Atualize quando for conveniente. O sistema não recarrega sozinho para
          evitar perda de trabalho em andamento.
        </span>
      </div>
      <button type="button" onClick={() => window.location.reload()}>
        Atualizar sistema
      </button>
    </aside>
  );
}
