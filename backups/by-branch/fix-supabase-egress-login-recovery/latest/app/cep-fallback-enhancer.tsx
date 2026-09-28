"use client";

import { useEffect } from "react";

type BrasilApiCep = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function setInput(input: HTMLInputElement | null, value?: string) {
  if (!input || !value || input.value.trim()) return;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function CepFallbackEnhancer() {
  useEffect(() => {
    const connected = new WeakSet<HTMLInputElement>();
    let animationFrame = 0;

    const connectInput = (cepInput: HTMLInputElement) => {
      if (connected.has(cepInput)) return;
      connected.add(cepInput);

      let timer: number | undefined;
      let lastCep = "";
      let controller: AbortController | null = null;

      const lookup = async () => {
        const cep = digits(cepInput.value);
        if (cep.length !== 8 || cep === lastCep) return;
        lastCep = cep;

        controller?.abort();
        controller = new AbortController();

        try {
          const response = await fetch(
            `https://brasilapi.com.br/api/cep/v1/${cep}`,
            {
              headers: { accept: "application/json" },
              signal: controller.signal,
            },
          );
          if (!response.ok) return;
          const data = (await response.json()) as BrasilApiCep;
          if (data.state !== "PR" || !data.city) return;

          const form = cepInput.closest<HTMLElement>(".modal-form");
          if (!form || !document.body.contains(form)) return;

          const labels = Array.from(form.querySelectorAll("label"));
          const street =
            labels
              .find((item) => item.textContent?.trim().startsWith("Rua"))
              ?.querySelector<HTMLInputElement>("input") || null;
          const district =
            labels
              .find((item) => item.textContent?.trim().startsWith("Bairro"))
              ?.querySelector<HTMLInputElement>("input") || null;

          setInput(street, data.street);
          setInput(district, data.neighborhood);

          const municipality = form.querySelector<HTMLSelectElement>(
            '[data-vf-municipality-field] select',
          );
          if (municipality) {
            const matching = Array.from(municipality.options).find(
              (option) =>
                option.value.localeCompare(data.city || "", "pt-BR", {
                  sensitivity: "base",
                }) === 0,
            );
            if (matching) {
              municipality.value = matching.value;
              municipality.dataset.city = matching.value;
              municipality.dataset.valid = "true";
              municipality.dispatchEvent(
                new Event("change", { bubbles: true }),
              );
            }
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // A consulta principal continua disponível caso a fonte alternativa falhe.
        }
      };

      const schedule = () => {
        window.clearTimeout(timer);
        const currentCep = digits(cepInput.value);
        if (currentCep.length !== 8) {
          lastCep = "";
          controller?.abort();
          return;
        }
        timer = window.setTimeout(() => void lookup(), 500);
      };

      cepInput.addEventListener("input", schedule);
      cepInput.addEventListener("blur", () => void lookup());

      if (digits(cepInput.value).length === 8) void lookup();
    };

    const enhanceNode = (root: ParentNode) => {
      if (
        root instanceof HTMLInputElement &&
        root.matches('.modal-form input[placeholder="00000-000"]')
      ) {
        connectInput(root);
        return;
      }

      root
        .querySelectorAll?.<HTMLInputElement>(
          '.modal-form input[placeholder="00000-000"]',
        )
        .forEach(connectInput);
    };

    const scheduleEnhance = (nodes: Node[]) => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        nodes.forEach((node) => {
          if (node instanceof HTMLElement) enhanceNode(node);
        });
      });
    };

    const observer = new MutationObserver((mutations) => {
      const addedNodes = mutations.flatMap((mutation) =>
        Array.from(mutation.addedNodes),
      );
      if (!addedNodes.length) return;
      scheduleEnhance(addedNodes);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    enhanceNode(document);

    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return null;
}
