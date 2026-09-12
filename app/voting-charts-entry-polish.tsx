"use client";

import { useEffect } from "react";

const DISTRICT_HEADER_CLASS = "vf-voting-district-header-filter";
const MOBILE_QUERY = "(max-width: 760px)";

function optionSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}\u0000${option.text}`)
    .join("\u0001");
}

function compactDistrictLabel(option: HTMLOptionElement) {
  if (option.value === "all") return "Todos os Bairros";
  return option.text.replace(/\s*\(\d+\)\s*$/, "").trim();
}

export default function VotingChartsEntryPolish() {
  useEffect(() => {
    let disposed = false;
    let scheduled = false;

    const removeHeaderFilter = () => {
      document
        .querySelectorAll<HTMLElement>(`.${DISTRICT_HEADER_CLASS}`)
        .forEach((element) => element.remove());
    };

    const scheduleSync = () => {
      if (disposed || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    const sync = () => {
      scheduled = false;
      if (disposed) return;

      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      const charts = document.querySelector<HTMLElement>(".voting-charts-container");
      const pageId = document.querySelector<HTMLElement>(
        ".app-shell .main > .topbar .page-id",
      );
      const source = charts?.querySelector<HTMLSelectElement>(
        ".district-selector-wrap select",
      );

      if (!isMobile || !charts || !pageId || !source) {
        removeHeaderFilter();
        return;
      }

      let wrap = pageId.querySelector<HTMLLabelElement>(
        `:scope > .${DISTRICT_HEADER_CLASS}`,
      );
      let compactSelect = wrap?.querySelector<HTMLSelectElement>("select");

      if (!wrap || !compactSelect) {
        wrap?.remove();
        wrap = document.createElement("label");
        wrap.className = DISTRICT_HEADER_CLASS;
        wrap.setAttribute("aria-label", "Filtrar gráficos por bairro");

        const pin = document.createElement("span");
        pin.className = "vf-voting-district-header-pin";
        pin.textContent = "📍";
        pin.setAttribute("aria-hidden", "true");

        compactSelect = document.createElement("select");
        compactSelect.className = "vf-voting-district-header-select";
        compactSelect.setAttribute("aria-label", "Selecionar bairro da apuração");

        compactSelect.addEventListener("change", () => {
          const liveSource = document.querySelector<HTMLSelectElement>(
            ".voting-charts-container .district-selector-wrap select",
          );
          if (!liveSource || !compactSelect) return;

          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value",
          )?.set;
          if (nativeSetter) nativeSetter.call(liveSource, compactSelect.value);
          else liveSource.value = compactSelect.value;

          liveSource.dispatchEvent(new Event("change", { bubbles: true }));
          scheduleSync();
        });

        wrap.append(pin, compactSelect);
        const brand = pageId.querySelector<HTMLElement>(
          ":scope > .vf-mobile-header-brand",
        );
        if (brand) brand.insertAdjacentElement("afterend", wrap);
        else pageId.appendChild(wrap);
      }

      const signature = optionSignature(source);
      if (compactSelect.dataset.optionsSignature !== signature) {
        compactSelect.replaceChildren(
          ...Array.from(source.options).map((option) => {
            const clone = document.createElement("option");
            clone.value = option.value;
            clone.text = compactDistrictLabel(option);
            clone.disabled = option.disabled;
            return clone;
          }),
        );
        compactSelect.dataset.optionsSignature = signature;
      }

      if (compactSelect.value !== source.value) {
        compactSelect.value = source.value;
      }

      const selected = compactSelect.selectedOptions[0]?.text || "Todos os Bairros";
      wrap.title = selected;
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    const handleChange = (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLSelectElement &&
        target.matches(".voting-charts-container .district-selector-wrap select")
      ) {
        scheduleSync();
      }
    };

    document.addEventListener("change", handleChange, true);
    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("change", handleChange, true);
      window.removeEventListener("resize", scheduleSync);
      removeHeaderFilter();
    };
  }, []);

  return (
    <style>{`
      @media (max-width: 760px) {
        body:has(.voting-charts-container) .app-shell .main > .topbar .scope-picker,
        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-header-scope {
          display: none !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar[data-vf-mobile-compact-tab-header="true"] {
          min-height: 58px !important;
          height: auto !important;
          padding-bottom: 7px !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar[data-vf-mobile-compact-tab-header="true"] .page-id {
          min-width: 0 !important;
          grid-template-columns: 36px minmax(0, 1fr) 116px !important;
          column-gap: 6px !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-mobile-header-brand {
          min-width: 0 !important;
          max-width: 100% !important;
          overflow: hidden !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-mobile-header-title {
          display: block !important;
          min-width: 0 !important;
          max-width: 100% !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          -webkit-line-clamp: unset !important;
          font-size: clamp(10.5px, 2.9vw, 13px) !important;
          line-height: 1.1 !important;
          letter-spacing: -0.025em !important;
        }

        body:has(.voting-charts-container) .app-shell .main > .topbar .vf-mobile-header-logo {
          width: 25px !important;
          height: 25px !important;
          flex: 0 0 25px !important;
        }

        body:has(.voting-charts-container) .${DISTRICT_HEADER_CLASS} {
          grid-column: 3 !important;
          grid-row: 1 !important;
          position: relative !important;
          width: 116px !important;
          min-width: 116px !important;
          max-width: 116px !important;
          height: 34px !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          padding: 0 22px 0 7px !important;
          box-sizing: border-box !important;
          border: 1px solid rgba(56, 189, 248, 0.26) !important;
          border-radius: 10px !important;
          background: rgba(11, 29, 49, 0.92) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025) !important;
          overflow: hidden !important;
        }

        body:has(.voting-charts-container) .${DISTRICT_HEADER_CLASS}::after {
          content: "⌄";
          position: absolute;
          right: 7px;
          top: 50%;
          transform: translateY(-55%);
          color: #7dd3fc;
          font-size: 13px;
          line-height: 1;
          pointer-events: none;
        }

        body:has(.voting-charts-container) .vf-voting-district-header-pin {
          flex: 0 0 auto;
          font-size: 10px;
          line-height: 1;
        }

        body:has(.voting-charts-container) .vf-voting-district-header-select {
          appearance: none !important;
          -webkit-appearance: none !important;
          min-width: 0 !important;
          width: 100% !important;
          height: 100% !important;
          padding: 0 !important;
          border: 0 !important;
          outline: 0 !important;
          color: #e8f4ff !important;
          background: transparent !important;
          font: inherit !important;
          font-size: 9.2px !important;
          line-height: 1 !important;
          font-weight: 760 !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
          cursor: pointer !important;
        }

        body:has(.voting-charts-container) .vf-voting-district-header-select option {
          color: #fff !important;
          background: #0f172a !important;
        }

        /* O filtro de bairro passa para o cabeçalho no mobile. */
        .voting-charts-container .district-selector-wrap {
          display: none !important;
        }

        /* O menu hambúrguer já cumpre a função de voltar/navegar. */
        .voting-charts-container .voting-actions-row > .voting-btn-primary {
          display: none !important;
        }

        /* Card inicial mais baixo e focado só em status + ações. */
        .voting-charts-container .voting-charts-header {
          padding: 12px 13px !important;
          border-radius: 14px !important;
        }

        .voting-charts-container .voting-charts-title-group p {
          margin-top: 5px !important;
          font-size: 0.68rem !important;
          line-height: 1.34 !important;
        }

        .voting-charts-container .voting-actions-row {
          margin-top: 10px !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 7px !important;
        }

        .voting-charts-container .voting-actions-row .voting-btn {
          min-height: 38px !important;
          border-radius: 10px !important;
        }
      }

      @media (max-width: 430px) {
        body:has(.voting-charts-container) .app-shell .main > .topbar[data-vf-mobile-compact-tab-header="true"] .page-id {
          grid-template-columns: 34px minmax(0, 1fr) 108px !important;
          column-gap: 5px !important;
        }

        body:has(.voting-charts-container) .${DISTRICT_HEADER_CLASS} {
          width: 108px !important;
          min-width: 108px !important;
          max-width: 108px !important;
          height: 32px !important;
          padding-left: 6px !important;
          padding-right: 20px !important;
          border-radius: 9px !important;
        }

        body:has(.voting-charts-container) .vf-voting-district-header-select {
          font-size: 8.6px !important;
        }

        body:has(.voting-charts-container) .vf-mobile-header-title {
          font-size: 10px !important;
        }
      }

      @media (max-width: 360px) {
        body:has(.voting-charts-container) .app-shell .main > .topbar[data-vf-mobile-compact-tab-header="true"] .page-id {
          grid-template-columns: 32px minmax(0, 1fr) 98px !important;
        }

        body:has(.voting-charts-container) .${DISTRICT_HEADER_CLASS} {
          width: 98px !important;
          min-width: 98px !important;
          max-width: 98px !important;
        }

        body:has(.voting-charts-container) .vf-voting-district-header-select {
          font-size: 8.1px !important;
        }
      }

      .voting-charts-container:not(:has(.voting-last-update)) {
        position: relative !important;
        min-height: min(640px, calc(100dvh - 96px)) !important;
        overflow: hidden !important;
      }

      .voting-charts-container:not(:has(.voting-last-update)) > * {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      .voting-charts-container:not(:has(.voting-last-update))::before {
        content: "Carregando apuração…\\A Atualizando votos e percentuais em tempo real";
        white-space: pre-line;
        position: absolute;
        z-index: 5;
        top: 20px;
        left: 20px;
        right: 20px;
        min-height: 148px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 64px 24px 24px;
        border: 1px solid rgba(56, 189, 248, 0.22);
        border-radius: 18px;
        color: #e7f4ff;
        background:
          radial-gradient(circle at 50% 18%, rgba(56, 189, 248, 0.13), transparent 34%),
          linear-gradient(145deg, rgba(15, 30, 50, 0.98), rgba(10, 21, 37, 0.98));
        box-shadow: 0 14px 38px rgba(2, 8, 23, 0.28);
        font-size: 0.88rem;
        line-height: 1.55;
        font-weight: 700;
        text-align: center;
        visibility: visible !important;
      }

      .voting-charts-container:not(:has(.voting-last-update))::after {
        content: "";
        position: absolute;
        z-index: 6;
        top: 47px;
        left: 50%;
        width: 24px;
        height: 24px;
        margin-left: -12px;
        border: 3px solid rgba(56, 189, 248, 0.22);
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: vf-voting-entry-spin 0.8s linear infinite;
        visibility: visible !important;
      }

      @keyframes vf-voting-entry-spin {
        to { transform: rotate(360deg); }
      }

      @media (max-width: 760px) {
        .voting-charts-container:not(:has(.voting-last-update)) {
          min-height: calc(100dvh - 76px) !important;
        }

        .voting-charts-container:not(:has(.voting-last-update))::before {
          top: 12px;
          left: 10px;
          right: 10px;
          min-height: 144px;
          padding: 64px 18px 22px;
          border-radius: 15px;
          font-size: 0.76rem;
          line-height: 1.5;
        }

        .voting-charts-container:not(:has(.voting-last-update))::after {
          top: 35px;
          width: 22px;
          height: 22px;
          margin-left: -11px;
        }
      }
    `}</style>
  );
}
