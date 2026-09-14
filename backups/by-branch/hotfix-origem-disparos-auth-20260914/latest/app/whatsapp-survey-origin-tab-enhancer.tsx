"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase-client";
import WhatsappSurveyOriginMonitorV4 from "./whatsapp-survey-origin-monitor-v4";

const MOBILE_FIX_STYLE_ID = "vf-survey-origin-mobile-frame-fix";

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

    let style = document.getElementById(MOBILE_FIX_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = MOBILE_FIX_STYLE_ID;
      style.textContent = `
        @media (max-width: 760px) {
          #vf-survey-origin-panel {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            overflow-x: hidden !important;
            box-sizing: border-box !important;
          }

          #vf-survey-origin-panel *,
          #vf-survey-origin-panel *::before,
          #vf-survey-origin-panel *::after {
            box-sizing: border-box;
          }

          #vf-survey-origin-panel .vf-origin-head,
          #vf-survey-origin-panel .vf-origin-tools,
          #vf-survey-origin-panel .vf-origin-list,
          #vf-survey-origin-panel .vf-origin-pagination {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          #vf-survey-origin-panel .vf-origin-filters {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            overflow: visible !important;
            gap: 7px !important;
            padding-bottom: 0 !important;
          }

          #vf-survey-origin-panel .vf-origin-filter {
            width: 100% !important;
            min-width: 0 !important;
            white-space: normal !important;
            text-align: center !important;
            line-height: 1.2 !important;
            padding: 8px 6px !important;
          }

          #vf-survey-origin-panel .vf-origin-filter:nth-child(3) {
            grid-column: 1 / -1;
          }

          #vf-survey-origin-panel .vf-origin-search {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          #vf-survey-origin-panel .vf-origin-card,
          #vf-survey-origin-panel .vf-origin-reply,
          #vf-survey-origin-panel .vf-origin-raw {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          #vf-survey-origin-panel .vf-origin-card {
            overflow: hidden !important;
          }

          #vf-survey-origin-panel .vf-origin-card-head {
            width: 100% !important;
            min-width: 0 !important;
            flex-wrap: wrap !important;
          }

          #vf-survey-origin-panel .vf-origin-person {
            flex: 1 1 180px !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }

          #vf-survey-origin-panel .vf-origin-person strong,
          #vf-survey-origin-panel .vf-origin-person span,
          #vf-survey-origin-panel .vf-origin-raw {
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          #vf-survey-origin-panel .vf-origin-pagination {
            display: grid !important;
            grid-template-columns: auto minmax(0, 1fr) auto !important;
            align-items: center !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    setReady(true);

    return () => {
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
      document.getElementById(MOBILE_FIX_STYLE_ID)?.remove();
    };
  }, []);

  if (!ready) return null;
  return <WhatsappSurveyOriginMonitorV4 />;
}
