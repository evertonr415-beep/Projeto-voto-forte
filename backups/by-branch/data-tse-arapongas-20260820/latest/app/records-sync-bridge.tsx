"use client";

import { useEffect } from "react";

const SYNC_EVENT = "voto-forte:records-changed";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function resolveRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (input instanceof Request) {
    return {
      url: input.url,
      method: String(init?.method || input.method || "GET").toUpperCase(),
    };
  }

  return {
    url: String(input),
    method: String(init?.method || "GET").toUpperCase(),
  };
}

function isRecordsMutation(url: string, method: string) {
  if (!MUTATION_METHODS.has(method)) return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.startsWith("/api/records");
  } catch {
    return url.includes("/api/records");
  }
}

export default function RecordsSyncBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = resolveRequest(input, init);
      const response = await originalFetch(input, init);

      if (response.ok && isRecordsMutation(request.url, request.method)) {
        window.dispatchEvent(
          new CustomEvent(SYNC_EVENT, {
            detail: {
              method: request.method,
              url: request.url,
              changedAt: new Date().toISOString(),
            },
          }),
        );
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

export { SYNC_EVENT };
