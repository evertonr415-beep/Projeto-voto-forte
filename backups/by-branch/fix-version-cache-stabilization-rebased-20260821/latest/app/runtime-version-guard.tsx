"use client";

import { useCallback, useEffect, useRef } from "react";

const VERSION_CHECK_INTERVAL_MS = 60_000;
const RELOAD_TARGET_KEY = "vf-runtime-version-reload-target";
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

      if (nextVersion === baselineVersion.current) {
        sessionStorage.removeItem(RELOAD_TARGET_KEY);
        return;
      }

      const reloadedVersion = sessionStorage.getItem(RELOAD_TARGET_KEY);
      if (reloadedVersion !== nextVersion) {
        sessionStorage.setItem(RELOAD_TARGET_KEY, nextVersion);
        window.location.reload();
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
