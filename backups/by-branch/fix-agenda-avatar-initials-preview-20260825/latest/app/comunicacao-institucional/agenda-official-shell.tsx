"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../supabase-client";
import { Icons } from "../ui-icons";
import "./agenda-official-shell.css";

type SessionUser = {
  email: string;
  name: string;
  role: string;
};

const coreMenu = [
  { label: "Visão Geral", icon: <Icons.Overview size={17} />, href: "/" },
  { label: "Contatos", icon: <Icons.Contacts size={17} />, href: "/contatos" },
  {
    label: "Mapa Eleitoral",
    icon: <Icons.ElectoralMap size={17} />,
    href: "/sistema-completo?view=Mapa%20Eleitoral",
  },
  {
    label: "Painel Eleitoral",
    icon: <Icons.ElectoralPanel size={17} />,
    href: "/sistema-completo?view=Painel%20Eleitoral",
  },
  {
    label: "WhatsApp",
    icon: <Icons.WhatsApp size={17} />,
    href: "/sistema-completo?view=WhatsApp",
  },
] as const;

const AGENDA_HEADER_TITLE = "Agenda Eleitoral";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function roleLabel(role: string) {
  const normalized = role.toLowerCase();
  if (normalized === "master") return "Administrador Master";
  if (normalized === "admin") return "Administrador";
  return "Usuário";
}

export default function AgendaOfficialShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: SessionUser;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser>(
    initialUser || {
      email: "",
      name: "",
      role: "user",
    },
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && data?.user) {
          setUser({
            email: String(data.user.email || ""),
            name: String(data.user.name || data.user.email || ""),
            role: String(data.user.role || "user"),
          });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const close = () => setCollapsed(false);
    window.addEventListener("voto-forte:close-mobile-sidebar", close);
    return () => window.removeEventListener("voto-forte:close-mobile-sidebar", close);
  }, []);

  const navigate = (href: string) => {
    setCollapsed(false);
    router.push(href);
  };

  const isAdmin = ["master", "admin"].includes(user.role.toLowerCase());
  const profileTitle = user.name || "Perfil";
  const profileAriaLabel = user.name ? `Perfil de ${user.name}` : "Perfil";

  return (
    <div className={`app-shell vf-agenda-official-shell ${collapsed ? "collapsed" : ""}`}>
      <div
        className={`sidebar-backdrop ${collapsed ? "is-active" : ""}`}
        onClick={() => setCollapsed(false)}
        aria-hidden={!collapsed}
      />

      <aside className="sidebar">
        <div className="sidebar-header-row">
          <button
            className="brand-button"
            type="button"
            onClick={() => navigate("/")}
            aria-label="Voltar à Visão Geral"
          >
            <div className="brand-lockup">
              <div className="brand-icons">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="parana-icon"
                  src="/voto-forte-bandeira-icon.jpg"
                  alt="Bandeira do Estado do Paraná - Voto Forte"
                />
              </div>
              <div>
                <strong>VOTO FORTE</strong>
                <div className="brand-state">
                  <b>PARANÁ</b>
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            className="sidebar-close-mobile-btn"
            onClick={() => setCollapsed(false)}
            aria-label="Fechar menu lateral"
            title="Fechar menu"
          >
            ✕
          </button>
        </div>

        <div className="menu-label">NAVEGAÇÃO</div>

        <nav>
          {coreMenu.map((item) => (
            <React.Fragment key={item.label}>
              <button
                type="button"
                title={item.label}
                onClick={() => navigate(item.href)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-name">{item.label}</span>
              </button>

              {item.label === "WhatsApp" && (
                <>
                  <button
                    type="button"
                    className="whaticket-broadcast-sidebar-btn"
                    onClick={() => {
                      setCollapsed(false);
                      window.dispatchEvent(new CustomEvent("voto-forte:open-whaticket-drawer"));
                    }}
                    title="Disparo em Massa"
                  >
                    <span
                      className="nav-icon"
                      style={{ color: "#2ddd7f", display: "inline-flex", alignItems: "center" }}
                    >
                      <Icons.Lightning size={17} color="#2ddd7f" />
                    </span>
                    <span className="nav-name">Disparo em Massa</span>
                  </button>

                  <button
                    type="button"
                    className="vf-comunicacao-sidebar-btn active"
                    title="Agenda Inteligente"
                    onClick={() => setCollapsed(false)}
                    aria-current="page"
                  >
                    <span className="nav-icon" aria-hidden="true">📅</span>
                    <span className="nav-name">Agenda Inteligente</span>
                  </button>
                </>
              )}
            </React.Fragment>
          ))}

          {isAdmin && (
            <button
              type="button"
              className="administration-nav-item"
              onClick={() => navigate("/sistema-completo?view=Administra%C3%A7%C3%A3o")}
              title="Administração"
            >
              <span className="nav-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                <Icons.Admin size={17} />
              </span>
              <span className="nav-name">Administração</span>
            </button>
          )}
        </nav>

        <div className="sidebar-message">
          <span>🇧🇷</span>
          <div>
            <b>Compromisso com Arapongas</b>
            <small>Estratégia, organização e resultado.</small>
          </div>
        </div>

        <button className="collapse" type="button" onClick={() => setCollapsed((current) => !current)}>
          {collapsed ? "›" : "‹"}
          <span>Recolher menu</span>
        </button>
      </aside>

      <main className="main">
        <header
          className="topbar"
          data-vf-mobile-compact-tab-header="true"
          data-vf-agenda-header="true"
        >
          <div className="page-id">
            <button
              type="button"
              className="mobile-menu"
              onClick={() => setCollapsed((current) => !current)}
              aria-label="Abrir menu de navegação"
              aria-expanded={collapsed}
              title="Abrir menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="3" y="4.5" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
                <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
                <rect x="3" y="17" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
              </svg>
            </button>

            <div className="vf-agenda-header-title-wrap" title={AGENDA_HEADER_TITLE}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/voto-forte-bandeira-icon.jpg"
                alt="Paraná"
                className="vf-agenda-header-logo"
              />
              <span className="vf-agenda-header-label">{AGENDA_HEADER_TITLE}</span>
            </div>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="profile"
              title={profileTitle}
              aria-label={profileAriaLabel}
            >
              <span>{initials(user.name)}</span>
              <div>
                <b>{user.name}</b>
                <small>{roleLabel(user.role)}</small>
              </div>
            </button>
          </div>
        </header>

        <section className="workspace">
          <div className="vf-agenda-route-content">{children}</div>
        </section>
      </main>
    </div>
  );
}
