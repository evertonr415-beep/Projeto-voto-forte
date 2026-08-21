"use client";

import { useEffect } from "react";

type DistrictItem = {
  district?: string;
};

const ENHANCED_ATTR = "data-vf-neighborhood-options-enhanced";
const ORIGINAL_HIDDEN_ATTR = "data-vf-neighborhood-original-hidden";

function findNeighborhoodSelect() {
  return Array.from(
    document.querySelectorAll<HTMLSelectElement>(".wt-drawer .wt-select"),
  ).find((select) =>
    Array.from(select.options).some((option) =>
      option.textContent?.trim().toLocaleLowerCase("pt-BR").startsWith("todos os bairros"),
    ),
  );
}

function buildVisualSelect(
  original: HTMLSelectElement,
  districts: string[],
) {
  let visual = original.parentElement?.querySelector<HTMLSelectElement>(
    `select[${ENHANCED_ATTR}="true"]`,
  );

  if (!visual) {
    visual = document.createElement("select");
    visual.className = original.className;
    visual.setAttribute(ENHANCED_ATTR, "true");
    visual.setAttribute("aria-label", "Selecionar bairro para organização da tela");
    visual.title = "Bairros disponíveis no município atual";
    original.insertAdjacentElement("afterend", visual);
  }

  const previousValue = visual.value;
  visual.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "Todos";
  allOption.textContent = "Todos os Bairros";
  visual.appendChild(allOption);

  for (const district of districts) {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    visual.appendChild(option);
  }

  if (previousValue && Array.from(visual.options).some((option) => option.value === previousValue)) {
    visual.value = previousValue;
  } else {
    visual.value = "Todos";
  }

  // Mantém o seletor original do fluxo operacional em "Todos" e apenas o
  // substitui visualmente. Assim, a lista de bairros serve para organização
  // da interface sem alterar a seleção de destinatários do disparo.
  original.value = "Todos";
  original.style.setProperty("display", "none", "important");
  original.setAttribute(ORIGINAL_HIDDEN_ATTR, "true");
}

export default function BroadcastNeighborhoodOptionsEnhancer() {
  useEffect(() => {
    let disposed = false;
    let loading = false;
    let loaded = false;
    let districts: string[] = [];
    let frame = 0;

    const sync = () => {
      if (disposed) return;
      const original = findNeighborhoodSelect();
      if (!original || !loaded) return;
      buildVisualSelect(original, districts);
    };

    const loadDistricts = async () => {
      if (disposed || loading || loaded) return;
      const drawer = document.querySelector<HTMLElement>(".wt-drawer.is-open");
      if (!drawer) return;

      loading = true;
      try {
        const response = await fetch("/api/map-district-markers", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;

        const payload = await response.json();
        const rows = Array.isArray(payload?.districts)
          ? (payload.districts as DistrictItem[])
          : [];

        districts = Array.from(
          new Set(
            rows
              .map((item) => String(item?.district || "").trim())
              .filter(Boolean),
          ),
        ).sort((left, right) => left.localeCompare(right, "pt-BR"));

        loaded = true;
        sync();
      } catch {
        // Mantém o seletor original caso a lista territorial não esteja disponível.
      } finally {
        loading = false;
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        void loadDistricts();
        sync();
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();

      const original = document.querySelector<HTMLSelectElement>(
        `.wt-drawer select[${ORIGINAL_HIDDEN_ATTR}="true"]`,
      );
      original?.style.removeProperty("display");
      original?.removeAttribute(ORIGINAL_HIDDEN_ATTR);
      document
        .querySelectorAll(`.wt-drawer select[${ENHANCED_ATTR}="true"]`)
        .forEach((node) => node.remove());
    };
  }, []);

  return null;
}
