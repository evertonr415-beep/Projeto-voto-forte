"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VERSION_CHECK_INTERVAL_MS = 30 * 1000;
const RELOAD_TARGET_KEY = "vf-runtime-version-reload-target";
const BUILD_VERSION = String(process.env.NEXT_PUBLIC_VF_BUILD_VERSION || "").trim();

type VersionPayload = {
  version?: string;
};

export default function RuntimeVersionGuard() {
  const baselineVersion = useRef(BUILD_VERSION);
  const checking = useRef(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkVersion = useCallback(async () => {
    if (checking.current) return;
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

      if (nextVersion === baselineVersion.current) {
        sessionStorage.removeItem(RELOAD_TARGET_KEY);
        setUpdateAvailable(false);
        return;
      }

      const lastReloadTarget = sessionStorage.getItem(RELOAD_TARGET_KEY);
      if (lastReloadTarget !== nextVersion) {
        sessionStorage.setItem(RELOAD_TARGET_KEY, nextVersion);
        window.location.reload();
        return;
      }

      // Se o navegador ainda estiver preso ao build anterior depois de uma
      // recarga, evitamos loop infinito e oferecemos uma tentativa manual.
      setUpdateAvailable(true);
    } catch {
      // A verificação de versão nunca deve bloquear o uso do sistema.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void checkVersion();

    const handleFocus = () => void checkVersion();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);

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
          O sistema tentou atualizar automaticamente. Toque abaixo para concluir
          a atualização caso o navegador ainda esteja usando a versão anterior.
        </span>
      </div>
      <button type="button" onClick={() => window.location.reload()}>
        Atualizar sistema
      </button>
    </aside>
  );
}
