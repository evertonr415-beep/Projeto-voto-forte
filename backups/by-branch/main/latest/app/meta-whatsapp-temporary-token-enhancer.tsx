"use client";

import { useEffect } from "react";

const TOKEN_KEY = "voto-forte:meta:temporaryAccessToken";
const LEGACY_TOKEN_KEY = "voto-forte:whaticket:apiToken";
const TEST_STATE_KEY = "voto-forte:meta:live-test:v1";
const TEST_PHONE = "43996867709";
const TOKEN_SELECTOR = 'input[placeholder="Cole o token novo somente para esta sessão"]';
const PHONE_SELECTOR = 'input[placeholder="43999999999"]';

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButton(text: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function findTemplateSelect() {
  return Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find((select) =>
    Array.from(select.options).some((option) => option.value.includes("::")),
  );
}

export default function MetaWhatsappTemporaryTokenEnhancer() {
  useEffect(() => {
    let workflowTimer = 0;
    let resultTimer = 0;
    let workflowRunning = false;

    const savedToken = () => {
      try {
        const current = localStorage.getItem(TOKEN_KEY)?.trim() || "";
        if (current) return current;
        const legacy = localStorage.getItem(LEGACY_TOKEN_KEY)?.trim() || "";
        if (/^EAA/i.test(legacy)) {
          localStorage.setItem(TOKEN_KEY, legacy);
          return legacy;
        }
      } catch {}
      return "";
    };

    const persistToken = (value: string) => {
      const token = value.trim();
      try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      } catch {}
    };

    const hydrate = () => {
      const tokenInput = document.querySelector<HTMLInputElement>(TOKEN_SELECTOR);
      if (!tokenInput) return;

      const formGroup = tokenInput.closest(".wt-form-group");
      const note = formGroup?.querySelector("small");
      if (note) {
        note.textContent =
          "Para o teste atual, este token fica salvo somente neste navegador. Depois vamos mover para o segredo do servidor.";
      }

      const token = savedToken();
      if (token && !tokenInput.value) setReactInputValue(tokenInput, token);

      const phoneInput = document.querySelector<HTMLInputElement>(PHONE_SELECTOR);
      if (phoneInput && !phoneInput.value) setReactInputValue(phoneInput, TEST_PHONE);
    };

    const watchResult = () => {
      window.clearInterval(resultTimer);
      resultTimer = window.setInterval(() => {
        const bodyText = document.body.textContent || "";
        if (bodyText.includes("✅ Mensagem enviada pela API oficial da Meta.")) {
          try {
            localStorage.setItem(TEST_STATE_KEY, "sent");
          } catch {}
          window.clearInterval(resultTimer);
          workflowRunning = false;
        } else if (bodyText.includes("❌") && bodyText.includes("Meta")) {
          try {
            if (localStorage.getItem(TEST_STATE_KEY) === "running") {
              localStorage.setItem(TEST_STATE_KEY, "failed");
            }
          } catch {}
        }
      }, 700);
    };

    const maybeRunLiveTest = () => {
      if (workflowRunning) return;
      const token = savedToken();
      const tokenInput = document.querySelector<HTMLInputElement>(TOKEN_SELECTOR);
      if (!token || !tokenInput) return;

      let state = "";
      try {
        state = localStorage.getItem(TEST_STATE_KEY) || "";
      } catch {}
      if (state === "sent" || state === "running") return;

      workflowRunning = true;
      try {
        localStorage.setItem(TEST_STATE_KEY, "running");
      } catch {}

      hydrate();
      findButton("Testar Meta API")?.click();

      window.clearTimeout(workflowTimer);
      workflowTimer = window.setTimeout(() => {
        findButton("Carregar modelos")?.click();

        let attempts = 0;
        const waitForTemplate = window.setInterval(() => {
          attempts += 1;
          hydrate();
          const select = findTemplateSelect();
          const usableOption = select
            ? Array.from(select.options).find((option) => option.value && option.value.includes("::"))
            : undefined;

          if (select && usableOption) {
            if (!select.value) {
              select.value = usableOption.value;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
            window.clearInterval(waitForTemplate);
            window.setTimeout(() => {
              hydrate();
              findButton("Enviar modelo de teste")?.click();
              watchResult();
            }, 1200);
            return;
          }

          if (attempts >= 20) {
            window.clearInterval(waitForTemplate);
            try {
              localStorage.setItem(TEST_STATE_KEY, "failed");
            } catch {}
            workflowRunning = false;
          }
        }, 700);
      }, 1200);
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.matches(TOKEN_SELECTOR)) return;
      persistToken(target.value);
      try {
        localStorage.setItem(TEST_STATE_KEY, "pending");
      } catch {}
      window.setTimeout(maybeRunLiveTest, 250);
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);

    const observer = new MutationObserver(() => {
      hydrate();
      window.setTimeout(maybeRunLiveTest, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    hydrate();
    window.setTimeout(maybeRunLiveTest, 600);

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      observer.disconnect();
      window.clearTimeout(workflowTimer);
      window.clearInterval(resultTimer);
    };
  }, []);

  return null;
}
