"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

export default function MapNeighborhoodInfoEnhancer() {
  useEffect(() => {
    let disposed = false;
    let isAdm = false;
    let scheduled = false;

    const sync = () => {
      scheduled = false;
      if (disposed) return;

      document
        .querySelectorAll<HTMLButtonElement>(".vf-district-open-contacts")
        .forEach((button) => {
          if (button.dataset.vfNeighborhoodInfo === "true") return;
          button.dataset.vfNeighborhoodInfo = "true";
          button.textContent = "Ver informações deste bairro →";
          button.addEventListener(
            "click",
            (event) => {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              const popup = button.closest<HTMLElement>(".vf-district-area-popup");
              const district = popup?.querySelector("strong")?.textContent?.trim() || "";
              if (!district) return;
              window.dispatchEvent(
                new CustomEvent("voto-forte:open-neighborhood-info", {
                  detail: { district, initialTab: "contacts" },
                }),
              );
            },
            true,
          );
        });

      document
        .querySelectorAll<HTMLButtonElement>(".vf-district-adjust, .vf-district-save")
        .forEach((button) => {
          if (isAdm) {
            button.style.removeProperty("display");
            button.removeAttribute("aria-hidden");
            button.removeAttribute("tabindex");
          } else {
            button.style.setProperty("display", "none", "important");
            button.setAttribute("aria-hidden", "true");
            button.setAttribute("tabindex", "-1");
          }
        });
    };

    const schedule = () => {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    void apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (disposed || !response.ok) return;
        isAdm = data?.user?.accessRole === "adm";
        schedule();
      })
      .catch(() => {
        isAdm = false;
        schedule();
      });

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", schedule, true);
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("click", schedule, true);
    };
  }, []);

  return null;
}
