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
  const [userId, setUserId] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
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
      const user = data.user;
      const userEmail = user?.email || "";
      const serverAvatar = String(user?.user_metadata?.avatar_url || "");
      setEmail(userEmail);
      setUserId(user?.id || "");
      if (serverAvatar) setAvatar(serverAvatar);

      const savedPreferences = localStorage.getItem(
        `voto-forte:${userEmail || "usuario"}:agenda-preferences`,
      );
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
    let observer: MutationObserver | null = null;

    const applyAvatarTo = (root: ParentNode) => {
      const elements: HTMLElement[] = [];
      if (
        root instanceof HTMLElement &&
        root.matches(".profile > span, .profile-box > span")
      ) {
        elements.push(root);
      }
      root
        .querySelectorAll?.<HTMLElement>(".profile > span, .profile-box > span")
        .forEach((element) => elements.push(element));

      for (const element of elements) {
        if (avatar) {
          element.style.backgroundImage = `url(${avatar})`;
          element.style.backgroundSize = "cover";
          element.style.backgroundPosition = "center";
          element.style.color = "transparent";
        } else {
          element.style.removeProperty("background-image");
          element.style.removeProperty("background-size");
          element.style.removeProperty("background-position");
          element.style.removeProperty("color");
        }
      }
    };

    const connectAccountButton = (root: ParentNode) => {
      const buttons: HTMLButtonElement[] = [];
      if (root instanceof HTMLButtonElement) buttons.push(root);
      root
        .querySelectorAll?.<HTMLButtonElement>("button")
        .forEach((button) => buttons.push(button));

      for (const button of buttons) {
        if (button.textContent?.trim() !== "Configurações da conta") continue;
        if (button.dataset.vfAccountSettings === "true") return true;
        button.dataset.vfAccountSettings = "true";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          setMessage("");
          setOpen(true);
        });
        return true;
      }
      return false;
    };

    applyAvatarTo(document);
    if (connectAccountButton(document)) return;

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          applyAvatarTo(node);
          if (connectAccountButton(node)) {
            observer?.disconnect();
            observer = null;
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => {
      observer?.disconnect();
      observer = null;
    }, 15_000);

    return () => {
      window.clearTimeout(timeout);
      observer?.disconnect();
    };
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

    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatar(URL.createObjectURL(file));
    setMessage("Foto selecionada. Clique em Salvar preferências.");
  };

  const savePreferences = async () => {
    setSaving(true);
    setMessage("");

    try {
      if (!userId) throw new Error("Sessão do usuário não encontrada.");

      let avatarUrl = avatar;
      const objectPath = `${userId}/avatar`;

      if (removeAvatar) {
        await supabase.storage.from("profile-avatars").remove([
          `${objectPath}.jpg`,
          `${objectPath}.png`,
          `${objectPath}.webp`,
        ]);
        avatarUrl = "";
      } else if (avatarFile) {
        const extension = avatarFile.type === "image/png"
          ? "png"
          : avatarFile.type === "image/webp"
            ? "webp"
            : "jpg";
        const path = `${objectPath}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-avatars")
          .upload(path, avatarFile, {
            upsert: true,
            contentType: avatarFile.type,
            cacheControl: "3600",
          });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("profile-avatars")
          .getPublicUrl(path);
        avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      }

      const { error: profileError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });
      if (profileError) throw profileError;

      setAvatar(avatarUrl);
      setAvatarFile(null);
      setRemoveAvatar(false);
      localStorage.setItem(
        storageKey("agenda-preferences"),
        JSON.stringify(preferences),
      );
      window.dispatchEvent(
        new CustomEvent("voto-forte:agenda-preferences", {
          detail: preferences,
        }),
      );
      window.dispatchEvent(
        new CustomEvent("voto-forte:avatar-updated", {
          detail: { avatarUrl },
        }),
      );
      setMessage("Foto e preferências foram salvas na sua conta.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as configurações.",
      );
    } finally {
      setSaving(false);
    }
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
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
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
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setAvatar("");
                      setAvatarFile(null);
                      setRemoveAvatar(true);
                      setMessage("Clique em Salvar preferências para remover a foto.");
                    }}
                  >
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
              <span><b>WhatsApp</b><small>Receber lembretes no número cadastrado.</small></span>
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
              <span><b>E-mail</b><small>Receber lembretes no e-mail da conta.</small></span>
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
            <button
              className="account-save-preferences"
              type="button"
              onClick={() => void savePreferences()}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar preferências"}
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
          <button type="button" onClick={() => setOpen(false)}>Fechar</button>
        </footer>
      </section>
    </div>
  );
}
