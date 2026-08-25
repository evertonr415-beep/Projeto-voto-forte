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

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "VF"
  );
}

function roleLabel(role: string) {
  const normalized = role.toLowerCase();
  if (normalized === "master") return "Administrador Master";
  if (normalized === "admin") return "Administrador";
  return "Usuário";
}

export default function AgendaOfficialShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<SessionUser>({
    email: "",
    name: "Voto Forte",
    role: "user",
  });

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && data?.user) {
          setUser({
            email: String(data.user.email || ""),
            name: String(data.user.name || data.user.email || "Voto Forte"),
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
        </div>

        <nav>
          {coreMenu.map((item) => (
            <button
              type="button"
              key={item.label}
              title={item.label}
              onClick={() => navigate(item.href)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-name">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-message">
          <span>🇧🇷</span>
          <div>
            <b>Voto Forte Paraná</b>
            <small>Gestão inteligente de campanha</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="page-id">
            <button
              type="button"
              className="mobile-menu"
              onClick={() => setCollapsed((current) => !current)}
              aria-label="Abrir menu de navegação"
              aria-expanded={collapsed}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <div>
              <small>VOTO FORTE PARANÁ</small>
              <h1>Agenda Inteligente</h1>
            </div>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="profile"
              title={user.name}
              aria-label={`Perfil de ${user.name}`}
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
