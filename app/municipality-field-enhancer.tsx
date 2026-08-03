"use client";

import { useEffect, useRef } from "react";

type Municipality = {
  id: number;
  name: string;
  state: "PR";
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export default function MunicipalityFieldEnhancer() {
  const municipalities = useRef<Municipality[]>([]);
  const currentCep = useRef("");

  useEffect(() => {
    let active = true;

    fetch("/api/municipalities")
      .then((response) => response.json())
      .then((data) => {
        if (active && Array.isArray(data.municipalities)) {
          municipalities.current = data.municipalities;
        }
      })
      .catch(() => undefined);

    const ensureMunicipalityField = () => {
      const cepInput = document.querySelector<HTMLInputElement>(
        '.modal-form input[placeholder="00000-000"]',
      );
      if (!cepInput) return;

      const form = cepInput.closest(".modal-form");
      if (!form || form.querySelector("[data-vf-municipality-field]")) return;

      const addressGrid = cepInput.closest(".address-grid");
      if (!addressGrid) return;

      const label = document.createElement("label");
      label.dataset.vfMunicipalityField = "true";
      label.textContent = "Município do Paraná (definido pelo CEP)";

      const select = document.createElement("select");
      select.disabled = true;
      select.setAttribute("aria-label", "Município identificado pelo CEP");

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Informe um CEP do Paraná";
      select.appendChild(empty);

      for (const municipality of municipalities.current) {
        const option = document.createElement("option");
        option.value = municipality.name;
        option.textContent = `${municipality.name} - PR`;
        select.appendChild(option);
      }

      label.appendChild(select);
      addressGrid.insertAdjacentElement("afterend", label);

      let timer: number | undefined;
      const identifyMunicipality = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(async () => {
          const cep = digits(cepInput.value);
          if (cep.length !== 8 || cep === currentCep.current) return;
          currentCep.current = cep;
          empty.textContent = "Identificando município...";
          select.value = "";

          try {
            const response = await fetch(`/api/address?action=cep&cep=${cep}`);
            const data = await response.json();
            if (!response.ok || data.uf !== "PR" || !data.localidade) {
              empty.textContent = data.error || "CEP não pertence ao Paraná";
              return;
            }

            if (
              !Array.from(select.options).some(
                (option) => option.value === data.localidade,
              )
            ) {
              const option = document.createElement("option");
              option.value = data.localidade;
              option.textContent = `${data.localidade} - PR`;
              select.appendChild(option);
            }

            select.value = data.localidade;
            select.dataset.city = data.localidade;
            empty.textContent = "Município identificado pelo CEP";
          } catch {
            empty.textContent = "Não foi possível identificar o município";
          }
        }, 250);
      };

      cepInput.addEventListener("input", identifyMunicipality);
      cepInput.addEventListener("blur", identifyMunicipality);
      identifyMunicipality();
    };

    const observer = new MutationObserver(ensureMunicipalityField);
    observer.observe(document.body, { childList: true, subtree: true });
    ensureMunicipalityField();

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  return null;
}
