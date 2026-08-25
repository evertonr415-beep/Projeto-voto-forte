"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "../ui-icons";
import styles from "./agenda-mobile-navigation.module.css";

const PENDING_VIEW_KEY = "vf-pending-dashboard-view";

type DashboardTarget =
  | "Visão Geral"
  | "Contatos"
  | "Mapa Eleitoral"
  | "Painel Eleitoral"
  | "WhatsApp";

type AgendaMenuTarget = DashboardTarget | "Agenda Inteligente";

const items: {
  label: AgendaMenuTarget;
  iconRender: (props: { size?: number }) => React.ReactNode;
}[] = [
  { label: "Visão Geral", iconRender: (p) => <Icons.Overview {...p} /> },
  { label: "Contatos", iconRender: (p) => <Icons.Contacts {...p} /> },
  { label: "Agenda Inteligente", iconRender: (p) => <Icons.Calendar {...p} /> },
  { label: "Mapa Eleitoral", iconRender: (p) => <Icons.ElectoralMap {...p} /> },
  { label: "Painel Eleitoral", iconRender: (p) => <Icons.ElectoralPanel {...p} /> },
  { label: "WhatsApp", iconRender: (p) => <Icons.WhatsApp {...p} /> },
];

function Brand() {
  return (
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
  );
}

export default function AgendaMobileNavigation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navigate = (label: AgendaMenuTarget) => {
    if (label === "Agenda Inteligente") {
      setOpen(false);
      return;
    }

    try {
      sessionStorage.setItem(PENDING_VIEW_KEY, label);
    } catch {}

    setOpen(false);
    router.push("/contatos");
  };

  return (
    <div className={`${styles.mobileOnly} app-shell ${open ? "collapsed" : ""}`}>
      <div
        className={`sidebar-backdrop ${open ? "is-active" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside className="sidebar" aria-label="Menu principal">
        <div className="sidebar-header-row">
          <button
            type="button"
            className="brand-button"
            onClick={() => navigate("Visão Geral")}
            aria-label="Voltar à Visão Geral"
          >
            <Brand />
          </button>
          <button
            type="button"
            className="sidebar-close-mobile-btn"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu lateral"
            title="Fechar menu"
          >
            ✕
          </button>
        </div>

        <div className="menu-label">NAVEGAÇÃO</div>
        <nav>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.label === "Agenda Inteligente" ? "active" : ""}
              onClick={() => navigate(item.label)}
              title={item.label}
            >
              <span className="nav-icon">{item.iconRender({ size: 17 })}</span>
              <span className="nav-name">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-message">
          <span>🇧🇷</span>
          <div>
            <b>Compromisso com Arapongas</b>
            <small>Estratégia, organização e resultado.</small>
          </div>
        </div>

        <button type="button" className="collapse" onClick={() => setOpen(false)}>
          ‹
          <span>Recolher menu</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar" aria-label="Navegação da Agenda Inteligente">
          <div className="page-id">
            <button
              type="button"
              className="mobile-menu"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu de navegação"
              title="Abrir menu"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="3" y="4.5" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
                <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
                <rect x="3" y="17" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
              </svg>
            </button>
            <div>
              <h1>Agenda inteligente</h1>
            </div>
          </div>
        </header>
      </main>
    </div>
  );
}
