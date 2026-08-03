"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase-client";

type Preferences = {
  agendaWhatsapp: boolean;
  agendaEmail: boolean;
};

const defaultPreferences: Preferences = {
  agendaWhatsapp: true,
  agendaEmail: true,
};

export default function AccountSettingsEnhancer() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const storageKey = (name: string) =>
    `voto-forte:${email || "usuario"}:${name}`;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email || "";
      setEmail(userEmail);
      const savedAvatar = localStorage.getItem(
        `voto-forte:${userEmail || "usuario"}:avatar`,
      );
      const savedPreferences = localStorage.getItem(
        `voto-forte:${userEmail || "usuario"}:agenda-preferences`,
      );
      if (savedAvatar) setAvatar(savedAvatar);
      if (savedPreferences) {
        try {
          setPreferences(JSON.parse(savedPreferences) as Preferences);
        } catch {
          setPreferences(defaultPreferences);
        }
      }
    });
  }, []);

  useEffect(() => {
    const applyAvatar = () => {
      if (!avatar) return;
      document
        .querySelectorAll<HTMLElement>(".profile > span, .profile-box > span")
        .forEach((element) => {
          element.style.backgroundImage = `url(${avatar})`;
          element.style.backgroundSize = "cover";
          element.style.backgroundPosition = "center";
          element.style.color = "transparent";
        });
    };

    const connectButton = () => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const accountButton = buttons.find(
        (button) => button.textContent?.trim() === "Configurações da conta",
      );
      if (accountButton && !accountButton.dataset.vfAccountSettings) {
        accountButton.dataset.vfAccountSettings = "true";
        accountButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          setMessage("");
          setOpen(true);
        });
      }
      applyAvatar();
    };

    const observer = new MutationObserver(connectButton);
    observer.observe(document.body, { childList: true, subtree: true });
    connectButton();
    return () => observer.disconnect();
  }, [avatar]);

  const chooseAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("A foto deve ter no máximo 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setAvatar(result);
      setMessage("Foto selecionada. Clique em Salvar preferências.");
    };
    reader.readAsDataURL(file);
  };

  const savePreferences = () => {
    if (avatar) localStorage.setItem(storageKey("avatar"), avatar);
    else localStorage.removeItem(storageKey("avatar"));
    localStorage.setItem(
      storageKey("agenda-preferences"),
      JSON.stringify(preferences),
    );
    window.dispatchEvent(
      new CustomEvent("voto-forte:agenda-preferences", {
        detail: preferences,
      }),
    );
    setMessage("Foto e preferências de notificações foram salvas.");
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("A confirmação da senha não corresponde.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setMessage(error.message || "Não foi possível alterar a senha.");
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setMessage("Senha alterada com sucesso.");
  };

  if (!open) return null;

  return (
    <div className="account-settings-backdrop" role="presentation">
      <section
        className="account-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
      >
        <header>
          <div>
            <small>VOTO FORTE PARANÁ</small>
            <h2 id="account-settings-title">Configurações da conta</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="account-settings-content">
          <section className="account-settings-section">
            <h3>Foto de perfil</h3>
            <div className="account-avatar-row">
              <button
                className="account-avatar-preview"
                type="button"
                onClick={() => fileInput.current?.click()}
                style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
                aria-label="Selecionar foto de perfil"
              >
                {!avatar && "Adicionar foto"}
              </button>
              <div>
                <button type="button" onClick={() => fileInput.current?.click()}>
                  Escolher foto
                </button>
                {avatar && (
                  <button type="button" className="secondary" onClick={() => setAvatar("")}>
                    Remover foto
                  </button>
                )}
                <small>JPG, PNG ou WEBP, com até 2 MB.</small>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={chooseAvatar}
                hidden
              />
            </div>
          </section>

          <section className="account-settings-section">
            <h3>Notificações da Agenda Inteligente</h3>
            <p>Escolha por quais canais deseja receber os lembretes das reuniões.</p>
            <label className="account-toggle-row">
              <span>
                <b>WhatsApp</b>
                <small>Receber lembretes no número cadastrado.</small>
              </span>
              <input
                type="checkbox"
                checked={preferences.agendaWhatsapp}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    agendaWhatsapp: event.target.checked,
                  }))
                }
              />
            </label>
            <label className="account-toggle-row">
              <span>
                <b>E-mail</b>
                <small>Receber lembretes no e-mail da conta.</small>
              </span>
              <input
                type="checkbox"
                checked={preferences.agendaEmail}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    agendaEmail: event.target.checked,
                  }))
                }
              />
            </label>
            <button className="account-save-preferences" type="button" onClick={savePreferences}>
              Salvar preferências
            </button>
          </section>

          <form className="account-settings-section" onSubmit={changePassword}>
            <h3>Alterar senha</h3>
            <label>
              Nova senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres"
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                autoComplete="new-password"
                placeholder="Repita a nova senha"
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "Alterando..." : "Alterar senha"}
            </button>
          </form>

          {message && <div className="account-settings-message">{message}</div>}
        </div>

        <footer>
          <button type="button" onClick={() => setOpen(false)}>
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
}
