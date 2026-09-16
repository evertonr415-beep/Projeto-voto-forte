"use client";

import { useCallback, useEffect, useRef } from "react";

const VERSION_CHECK_INTERVAL_MS = 120_000;
const BUILD_VERSION = String(process.env.NEXT_PUBLIC_VF_BUILD_VERSION || "").trim();

type VersionPayload = {
  version?: string;
};

export default function RuntimeVersionGuard() {
  const baselineVersion = useRef(BUILD_VERSION);
  const checking = useRef(false);

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

      // Evita recarregamento abrupto forçado de página (window.location.reload)
      // para não causar tela branca nem interromper o usuário com o site aberto.
      if (nextVersion !== baselineVersion.current) {
        baselineVersion.current = nextVersion;
      }
    } catch {
      // Não bloqueia o sistema se a verificação falhar.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void checkVersion();
    const timer = window.setInterval(checkVersion, VERSION_CHECK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [checkVersion]);

  return null;
}

