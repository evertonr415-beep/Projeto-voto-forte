"use client";

import { useEffect, useRef } from "react";
import { apiFetch, supabase } from "./supabase-client";

type Municipality = { id: number; name: string; state: string };

const EMAIL_CONFIRMATION_URL = "https://sistemavotoforte.com.br/auth/confirm";

function fieldByAutocomplete(form: HTMLFormElement, value: string) {
  return form.querySelector<HTMLInputElement>(`input[autocomplete="${value}"]`);
}

function showMessage(form: HTMLFormElement, text: string) {
  let box = form.querySelector<HTMLElement>("[data-vf-signup-message]");
  const native = form.querySelector<HTMLElement>(".auth-message");
  if (native) {
    native.textContent = text;
    return;
  }
  if (!box) {
    box = document.createElement("div");
    box.className = "auth-message";
    box.dataset.vfSignupMessage = "true";
    box.setAttribute("role", "status");
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"], button.auth-submit');
    if (submit) form.insertBefore(box, submit);
    else form.appendChild(box);
  }
  box.textContent = text;
}

export default function SignupMunicipalityEnhancer() {
  const municipalities = useRef<Municipality[]>([]);
  const request = useRef<Promise<Municipality[]> | null>(null);
  const submitting = useRef(false);
  const registrationInFlight = useRef<string | null>(null);
  const registrationCompleted = useRef(new Set<string>());

  useEffect(() => {
    let active = true;

    const loadMunicipalities = () => {
      if (municipalities.current.length) return Promise.resolve(municipalities.current);
      if (request.current) return request.current;
      request.current = fetch("/api/municipalities")
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.municipalities)) return [];
          municipalities.current = data.municipalities;
          return municipalities.current;
        })
        .catch(() => [] as Municipality[])
        .finally(() => {
          request.current = null;
        });
      return request.current;
    };

    async function enhanceSignupForm() {
      const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form.auth-card"));
      const form = forms.find((item) => fieldByAutocomplete(item, "name"));
      if (!form || form.querySelector("[data-vf-signup-municipality]")) return;

      const list = await loadMunicipalities();
      if (!active || !document.body.contains(form)) return;

      const emailLabel = fieldByAutocomplete(form, "email")?.closest("label");
      if (!emailLabel) return;

      const label = document.createElement("label");
      label.dataset.vfSignupMunicipality = "true";
      label.textContent = "Município";

      const select = document.createElement("select");
      select.required = true;
      select.setAttribute("aria-label", "Município de atuação");

      const initial = document.createElement("option");
      initial.value = "";
      initial.textContent = list.length ? "Selecione seu município" : "Municípios indisponíveis agora";
      select.appendChild(initial);

      for (const municipality of list) {
        const option = document.createElement("option");
        option.value = municipality.name;
        option.dataset.id = String(municipality.id);
        option.dataset.state = municipality.state || "PR";
        option.textContent = `${municipality.name} - ${municipality.state || "PR"}`;
        select.appendChild(option);
      }

      const help = document.createElement("small");
      help.textContent = "A cidade escolhida será enviada para aprovação. Ela não libera acesso automaticamente.";
      label.append(select, help);
      emailLabel.insertAdjacentElement("beforebegin", label);
    }

    async function registerConfirmedRequest() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user?.email_confirmed_at) return;

      const municipalityName = String(session.user.user_metadata?.municipalityName ?? "").trim();
      if (!municipalityName) return;

      const registrationKey = `${session.user.id}:${municipalityName.toLocaleLowerCase("pt-BR")}`;
      if (registrationCompleted.current.has(registrationKey)) return;
      if (registrationInFlight.current === registrationKey) return;

      registrationInFlight.current = registrationKey;
      try {
        const response = await apiFetch("/api/municipality-registration", { method: "POST" });
        if (response.ok) registrationCompleted.current.add(registrationKey);
      } catch {
        // A tela de acesso continuará bloqueada e permitirá nova tentativa no próximo login.
      } finally {
        if (registrationInFlight.current === registrationKey) {
          registrationInFlight.current = null;
        }
      }
    }

    async function handleSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.classList.contains("auth-card") || !fieldByAutocomplete(form, "name")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (submitting.current) return;

      const name = fieldByAutocomplete(form, "name")?.value.trim() || "";
      const email = fieldByAutocomplete(form, "email")?.value.trim() || "";
      const passwords = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'));
      const password = passwords[0]?.value || "";
      const confirmation = passwords[1]?.value || "";
      const select = form.querySelector<HTMLSelectElement>("[data-vf-signup-municipality] select");
      const municipalityName = select?.value.trim() || "";
      const municipalityState = select?.selectedOptions[0]?.dataset.state || "PR";

      if (!name || !email || !municipalityName) {
        showMessage(form, "Informe nome, e-mail e município.");
        return;
      }
      if (password.length < 8) {
        showMessage(form, "A senha deve ter pelo menos 8 caracteres.");
        return;
      }
      if (password !== confirmation) {
        showMessage(form, "As senhas informadas não são iguais.");
        return;
      }

      submitting.current = true;
      showMessage(form, "Criando sua conta…");
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, municipalityName, municipalityState },
            emailRedirectTo: EMAIL_CONFIRMATION_URL,
          },
        });
        if (error) throw error;
        showMessage(
          form,
          data.session
            ? `Conta criada. Sua solicitação para ${municipalityName} será preparada após a confirmação do e-mail.`
            : `Conta criada para ${municipalityName}. Confirme o e-mail e depois entre no sistema para concluir a solicitação de acesso.`,
        );
      } catch (error) {
        showMessage(form, error instanceof Error ? error.message : "Não foi possível criar sua conta.");
      } finally {
        submitting.current = false;
      }
    }

    const observer = new MutationObserver(() => void enhanceSignupForm());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("submit", handleSubmit, true);

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "USER_UPDATED") return;
      window.setTimeout(() => void registerConfirmedRequest(), 0);
    });

    void enhanceSignupForm();
    void registerConfirmedRequest();

    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener("submit", handleSubmit, true);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
