"use client";

import { useEffect, useRef } from "react";

type Municipality = {
  id: number;
  name: string;
  state: "PR";
};

type CepResult = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  error?: string;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function MunicipalityFieldEnhancer() {
  const municipalities = useRef<Municipality[]>([]);
  const municipalitiesRequest = useRef<Promise<Municipality[]> | null>(null);

  useEffect(() => {
    let active = true;
    let observer: MutationObserver | null = null;
    let animationFrame = 0;

    const loadMunicipalities = () => {
      if (municipalities.current.length) {
        return Promise.resolve(municipalities.current);
      }
      if (municipalitiesRequest.current) return municipalitiesRequest.current;

      municipalitiesRequest.current = fetch("/api/municipalities")
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.municipalities)) return [];
          municipalities.current = data.municipalities as Municipality[];
          return municipalities.current;
        })
        .catch(() => [] as Municipality[])
        .finally(() => {
          municipalitiesRequest.current = null;
        });

      return municipalitiesRequest.current;
    };

    const enhanceForm = async () => {
      const cepInput = document.querySelector<HTMLInputElement>(
        '.modal-form input[placeholder="00000-000"]',
      );
      if (!cepInput) return;

      const form = cepInput.closest<HTMLElement>(".modal-form");
      const addressGrid = cepInput.closest<HTMLElement>(".address-grid");
      if (!form || !addressGrid) return;
      if (form.querySelector("[data-vf-municipality-field]")) return;

      const municipalityList = await loadMunicipalities();
      if (!active || !document.body.contains(form)) return;

      const label = document.createElement("label");
      label.dataset.vfMunicipalityField = "true";
      label.textContent = "Município do Paraná";

      const select = document.createElement("select");
      select.disabled = true;
      select.required = true;
      select.setAttribute("aria-label", "Município identificado pelo CEP");

      const initial = document.createElement("option");
      initial.value = "";
      initial.textContent = "Informe um CEP do Paraná";
      select.appendChild(initial);

      for (const municipality of municipalityList) {
        const option = document.createElement("option");
        option.value = municipality.name;
        option.textContent = `${municipality.name} - PR`;
        select.appendChild(option);
      }

      const help = document.createElement("small");
      help.textContent =
        "O município é definido automaticamente pelo CEP e não pode ser alterado manualmente.";

      label.append(select, help);
      addressGrid.insertAdjacentElement("afterend", label);

      let requestId = 0;
      let lastCep = "";

      const identifyMunicipality = async () => {
        const cep = digits(cepInput.value);
        if (cep.length !== 8) {
          lastCep = "";
          select.value = "";
          initial.textContent = "Informe um CEP válido com 8 números";
          select.dataset.valid = "false";
          return;
        }
        if (cep === lastCep && select.dataset.valid === "true") return;

        lastCep = cep;
        const currentRequest = ++requestId;
        select.value = "";
        select.dataset.valid = "false";
        initial.textContent = "Consultando CEP e município...";

        try {
          const response = await fetch(`/api/address?action=cep&cep=${cep}`);
          const data = (await response.json()) as CepResult;
          if (currentRequest !== requestId) return;

          if (!response.ok || data.uf !== "PR" || !data.localidade) {
            initial.textContent =
              data.error || "O CEP informado não pertence ao Paraná";
            return;
          }

          if (
            !Array.from(select.options).some(
              (option) => option.value === data.localidade,
            )
          ) {
            initial.textContent =
              "Município não localizado na lista oficial do Paraná";
            return;
          }

          select.value = data.localidade;
          select.dataset.city = data.localidade;
          select.dataset.valid = "true";
          help.textContent = `Município confirmado pela base oficial: ${data.localidade} - PR.`;

          const labels = Array.from(form.querySelectorAll("label"));
          const streetInput = labels
            .find((item) => item.textContent?.trim().startsWith("Rua"))
            ?.querySelector<HTMLInputElement>("input");
          const districtInput = labels
            .find((item) => item.textContent?.trim().startsWith("Bairro"))
            ?.querySelector<HTMLInputElement>("input");

          if (streetInput && data.logradouro && !streetInput.value.trim()) {
            setReactInputValue(streetInput, data.logradouro);
          }
          if (districtInput && data.bairro && !districtInput.value.trim()) {
            setReactInputValue(districtInput, data.bairro);
          }

          cepInput.dispatchEvent(new Event("blur", { bubbles: true }));
        } catch {
          if (currentRequest !== requestId) return;
          initial.textContent = "Não foi possível consultar o CEP agora";
        }
      };

      let timer: number | undefined;
      const scheduleLookup = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void identifyMunicipality(), 350);
      };

      cepInput.addEventListener("input", scheduleLookup);
      cepInput.addEventListener("blur", () => void identifyMunicipality());

      const locateButton = Array.from(form.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Localizar e conferir no mapa"),
      );
      locateButton?.addEventListener(
        "click",
        (event) => {
          if (select.dataset.valid !== "true") {
            event.preventDefault();
            event.stopImmediatePropagation();
            void identifyMunicipality();
          }
        },
        true,
      );

      if (cepInput.value.trim()) void identifyMunicipality();
    };

    const scheduleEnhance = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        void enhanceForm();
      });
    };

    observer = new MutationObserver((mutations) => {
      if (
        mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) =>
              node instanceof HTMLElement &&
              (node.matches(".modal-form") || node.querySelector(".modal-form")),
          ),
        )
      ) {
        scheduleEnhance();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhance();

    return () => {
      active = false;
      observer?.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return null;
}
