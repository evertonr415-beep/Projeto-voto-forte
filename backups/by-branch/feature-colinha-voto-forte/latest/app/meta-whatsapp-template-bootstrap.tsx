"use client";

import { useEffect } from "react";

const TOKEN_STORAGE_KEY = "voto-forte:meta:temporaryAccessToken";
const BUTTON_CLASS = "vf-meta-template-bootstrap-btn";

function findButton(text: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

export default function MetaWhatsappTemplateBootstrap() {
  useEffect(() => {
    let timer = 0;

    const installButton = () => {
      if (document.querySelector(`.${BUTTON_CLASS}`)) return;
      const select = Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find((item) =>
        Array.from(item.options).some((option) => option.textContent?.includes("Selecione")),
      );
      if (!select) return;
      const section = select.closest(".wt-card");
      if (!section || !section.textContent?.includes("Modelo da campanha")) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = `wt-secondary-btn ${BUTTON_CLASS}`;
      button.style.width = "100%";
      button.style.marginTop = "10px";
      button.textContent = "Criar modelo oficial para produção";

      const status = document.createElement("div");
      status.style.marginTop = "8px";
      status.style.fontSize = "12px";

      button.addEventListener("click", async () => {
        let apiToken = "";
        try {
          apiToken = localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() || "";
        } catch {}

        if (!apiToken) {
          status.textContent = "❌ Informe o token da Meta primeiro.";
          return;
        }

        button.disabled = true;
        status.textContent = "⏳ Preparando modelo oficial na Meta...";
        try {
          const response = await fetch("/api/whatsapp/templates/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiToken }),
          });
          const data = await response.json();
          if (!response.ok || !data.success) throw new Error(data.error || "Falha ao criar o modelo.");

          const templateStatus = String(data.template?.status || "PENDING").toUpperCase();
          if (templateStatus === "APPROVED") {
            status.textContent = "✅ Modelo oficial aprovado. Carregando na lista...";
            window.setTimeout(() => findButton("Carregar modelos")?.click(), 600);
          } else {
            status.textContent = `🕒 Modelo enviado à Meta. Status: ${templateStatus}. A aprovação é feita pela Meta; use Carregar modelos para consultar novamente.`;
          }
        } catch (error) {
          status.textContent = `❌ ${error instanceof Error ? error.message : String(error)}`;
        } finally {
          button.disabled = false;
        }
      });

      section.append(button, status);
    };

    const onClick = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(installButton, 120);
    };

    document.addEventListener("click", onClick, true);
    timer = window.setTimeout(installButton, 500);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
      document.querySelector(`.${BUTTON_CLASS}`)?.remove();
    };
  }, []);

  return null;
}
