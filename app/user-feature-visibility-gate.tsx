"use client";

import { useEffect } from "react";
import { supabase } from "./supabase-client";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function restrictedEntry(value: string) {
  const text = normalize(value);
  return ["whatsapp", "gestao de votos", "apuracao"].some((label) => text.includes(label));
}

export default function UserFeatureVisibilityGate() {
  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;

    const hide = () => {
      document.querySelectorAll<HTMLElement>(".sidebar nav button, .sidebar nav a").forEach((entry) => {
        if (!restrictedEntry(entry.textContent || "")) return;
        entry.style.setProperty("display", "none", "important");
        entry.setAttribute("aria-hidden", "true");
        entry.dataset.vfAccessHidden = "true";
      });
    };

    void supabase.auth.getUser().then(({ data }) => {
      if (disposed) return;
      const permissions = data.user?.app_metadata?.vf_permissions;
      if (permissions?.disparos !== false && permissions?.votacao_numeros !== false) return;
      document.documentElement.dataset.vfRestrictedCampaignFeatures = "1";
      hide();
      observer = new MutationObserver(hide);
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      delete document.documentElement.dataset.vfRestrictedCampaignFeatures;
    };
  }, []);

  return (
    <style>{`
      html[data-vf-restricted-campaign-features="1"] .vf-individual-whatsapp-sidebar-btn {
        display: none !important;
      }
      html[data-vf-restricted-campaign-features="1"] body:has(.voting-charts-container) .voting-charts-container,
      html[data-vf-restricted-campaign-features="1"] body:has(.wa-layout) .wa-layout {
        display: none !important;
      }
    `}</style>
  );
}
