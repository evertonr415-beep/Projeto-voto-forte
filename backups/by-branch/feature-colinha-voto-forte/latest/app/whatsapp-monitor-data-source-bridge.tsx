"use client";

import { useLayoutEffect } from "react";

export default function WhatsappMonitorDataSourceBridge() {
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const bridgedFetch: typeof window.fetch = (input, init) => {
      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const method = String(init?.method || (input instanceof Request ? input.method : "GET"))
          .trim()
          .toUpperCase();
        const url = new URL(rawUrl, window.location.origin);

        if (
          method === "GET" &&
          url.origin === window.location.origin &&
          url.pathname === "/api/whatsapp/live-feed"
        ) {
          url.pathname = "/api/whatsapp/monitor";

          if (input instanceof Request) {
            return originalFetch(new Request(url.toString(), input), init);
          }

          const target = /^https?:\/\//i.test(rawUrl)
            ? url.toString()
            : `${url.pathname}${url.search}${url.hash}`;
          return originalFetch(target, init);
        }
      } catch {
        // Em qualquer URL não reconhecida, preserva o comportamento original.
      }

      return originalFetch(input, init);
    };

    window.fetch = bridgedFetch;

    return () => {
      if (window.fetch === bridgedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
