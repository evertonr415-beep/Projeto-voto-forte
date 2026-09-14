"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase-client";
import WhatsappSurveyOriginMonitorV4 from "./whatsapp-survey-origin-monitor-v4";

export default function WhatsappSurveyOriginTabEnhancer() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const patchedFetch: typeof window.fetch = async (input, init) => {
      let pathname = "";

      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        pathname = new URL(rawUrl, window.location.origin).pathname;
      } catch {
        pathname = "";
      }

      if (pathname !== "/api/whatsapp/survey-origin") {
        return originalFetch(input, init);
      }

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set("authorization", `Bearer ${token}`);

      return originalFetch(input, { ...init, headers });
    };

    window.fetch = patchedFetch;
    setReady(true);

    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    };
  }, []);

  if (!ready) return null;
  return <WhatsappSurveyOriginMonitorV4 />;
}
