"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./supabase-client";

type SessionPayload = {
  user?: {
    accessRole?: string;
  };
};

type Municipality = {
  id: number;
  name: string;
  state: string;
  status: string;
};

type GestorUser = {
  id: number;
  name: string;
  email: string;
  accessRole: string;
  status: string;
  municipalityIds?: number[];
};

type UsersPayload = {
  users?: GestorUser[];
  municipalities?: Municipality[];
};

export default function GestorAccessUi() {
  const [accessRole, setAccessRole] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [users, setUsers] = useState<GestorUser[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [drafts, setDrafts] = useState<Record<number, number[]>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const loadAdministration = useCallback(async () => {
    if (accessRole !== "adm") return;
    const response = await apiFetch("/api/users", { cache: "no-store" });
    const data = (await response.json()) as UsersPayload & { error?: string };
    if (!response.ok)
      throw new Error(data.error || "Não foi possível carregar os Gestores.");

    const gestores = (data.users || []).filter(
      (user) => user.accessRole === "gestor" && user.status === "active",
    );
    setUsers(gestores);
    setMunicipalities(
      (data.municipalities || []).filter((item) => item.status === "active"),
    );
    setDrafts(
      Object.fromEntries(
        gestores.map((user) => [
          user.id,
          Array.from(new Set((user.municipalityIds || []).map(Number))).filter(
            Boolean,
          ),
        ]),
      ),
    );
  }, [accessRole]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => ({
        response,
        data: (await response.json()) as SessionPayload,
      }))
      .then(({ response, data }) => {
        if (cancelled || !response.ok) return;
        setAccessRole(String(data.user?.accessRole || ""));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessRole) return;

    const decorate = () => {
      if (accessRole === "gestor") {
        document
          .querySelectorAll<HTMLElement>(".profile small")
          .forEach((node) => {
            if (node.textContent !== "Gestor Multimunicipal")
              node.textContent = "Gestor Multimunicipal";
          });
        document
          .querySelectorAll<HTMLButtonElement>(".management-filter button")
          .forEach((button) => {
            if (button.textContent?.includes("Banco de Dados e Backup"))
              button.hidden = true;
          });

        document
          .querySelectorAll<HTMLElement>(".admin-kpis > article")
          .forEach((card) => {
            const label = card
              .querySelector("small")
              ?.textContent?.trim()
              .toUpperCase();
            if (label === "ADMINISTRADORES") card.hidden = true;
          });

        document
          .querySelectorAll<HTMLElement>(".security-banner")
          .forEach((banner) => {
            const paragraph = banner.querySelector<HTMLElement>("p");
            if (paragraph?.textContent?.includes("Administradores")) {
              paragraph.textContent =
                "As consultas e gravações usam o e-mail autenticado como proprietário. Cada ambiente permanece isolado conforme as permissões da equipe.";
            }
          });

        const hierarchyPanel = document.querySelector<HTMLElement>(
          ".vf-hierarchy-panel",
        );
        if (hierarchyPanel) {
          const hierarchyDescription =
            hierarchyPanel.querySelector<HTMLElement>("header p");
          const gestorHierarchy =
            "Gestor → Master → Liderança → Liderado → Eleitor.";
          if (
            hierarchyDescription &&
            hierarchyDescription.textContent !== gestorHierarchy
          ) {
            hierarchyDescription.textContent = gestorHierarchy;
          }

          hierarchyPanel
            .querySelectorAll<HTMLElement>(".vf-hierarchy-summary > article")
            .forEach((card) => {
              const label = card
                .querySelector("small")
                ?.textContent?.trim()
                .toUpperCase();
              if (label === "ADM") card.hidden = true;
            });

          hierarchyPanel
            .querySelectorAll<HTMLElement>(".vf-hierarchy-help")
            .forEach((node) => {
              node.hidden = true;
            });

          hierarchyPanel
            .querySelectorAll<HTMLElement>(".vf-hierarchy-user.role-adm")
            .forEach((node) => {
              node.hidden = true;
            });
        }
      }

      if (accessRole === "adm") {
        const panel = document.querySelector<HTMLElement>(
          ".vf-hierarchy-panel",
        );
        if (panel) {
          let node = panel.querySelector<HTMLElement>(
            ":scope > [data-vf-gestor-municipalities-host]",
          );
          if (!node) {
            node = document.createElement("div");
            node.dataset.vfGestorMunicipalitiesHost = "true";
            const tabs = panel.querySelector(".vf-access-tabs");
            tabs?.insertAdjacentElement("afterend", node);
          }
          setHost((current) => (current === node ? current : node));
        }
      }
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [accessRole]);

  useEffect(() => {
    if (accessRole !== "adm") return;
    void loadAdministration().catch((error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os Gestores.",
      ),
    );
  }, [accessRole, loadAdministration]);

  const activeMunicipalities = useMemo(
    () =>
      municipalities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [municipalities],
  );

  function toggleMunicipality(userId: number, municipalityId: number) {
    setDrafts((current) => {
      const selected = new Set(current[userId] || []);
      if (selected.has(municipalityId)) selected.delete(municipalityId);
      else selected.add(municipalityId);
      return { ...current, [userId]: Array.from(selected) };
    });
  }

  async function saveMunicipalities(user: GestorUser) {
    const municipalityIds = drafts[user.id] || [];
    if (!municipalityIds.length) {
      setMessage(`Selecione pelo menos um município para ${user.name}.`);
      return;
    }

    setBusyId(user.id);
    setMessage("");
    try {
      const response = await apiFetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, municipalityIds }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Não foi possível salvar os municípios.");
      setMessage(`Municípios de ${user.name} atualizados.`);
      await loadAdministration();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar os municípios.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (accessRole !== "adm" || !host) return null;

  return createPortal(
    <section
      className="vf-gestor-municipality-admin"
      aria-label="Gestores multimunicipais"
    >
      <header>
        <div>
          <small>GESTÃO DE CONFIANÇA</small>
          <h4>Gestores multimunicipais</h4>
          <p>
            Defina exatamente quais municípios cada Gestor pode visualizar e
            alternar. O Gestor nunca recebe acesso a contas ADM, backup ou
            segurança global.
          </p>
        </div>
        <span>{users.length}</span>
      </header>

      {message && (
        <div className="vf-gestor-municipality-message" role="status">
          {message}
        </div>
      )}

      {users.length ? (
        <div className="vf-gestor-municipality-list">
          {users.map((user) => (
            <article key={user.id}>
              <div className="vf-gestor-identity">
                <b>{user.name}</b>
                <small>{user.email}</small>
              </div>
              <div className="vf-gestor-municipality-checks">
                {activeMunicipalities.map((municipality) => (
                  <label key={municipality.id}>
                    <input
                      type="checkbox"
                      checked={(drafts[user.id] || []).includes(municipality.id)}
                      onChange={() =>
                        toggleMunicipality(user.id, municipality.id)
                      }
                    />
                    <span>
                      {municipality.name} - {municipality.state}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busyId === user.id}
                onClick={() => void saveMunicipalities(user)}
              >
                {busyId === user.id ? "Salvando…" : "Salvar municípios"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="vf-gestor-empty">
          Nenhum Gestor ativo. Crie o primeiro acesso usando a opção “Gestor” em
          Cadastrar acesso.
        </p>
      )}
    </section>,
    host,
  );
}
