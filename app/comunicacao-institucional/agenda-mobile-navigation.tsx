"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./agenda-mobile-navigation.module.css";

const PENDING_VIEW_KEY = "vf-pending-dashboard-view";

type DashboardTarget =
  | "Visão Geral"
  | "Contatos"
  | "Mapa Eleitoral"
  | "Painel Eleitoral"
  | "WhatsApp";

const items: { label: DashboardTarget | "Agenda Inteligente"; icon: string }[] = [
  { label: "Visão Geral", icon: "⌂" },
  { label: "Contatos", icon: "👥" },
  { label: "Agenda Inteligente", icon: "▣" },
  { label: "Mapa Eleitoral", icon: "⌖" },
  { label: "Painel Eleitoral", icon: "◎" },
  { label: "WhatsApp", icon: "◉" },
];

export default function AgendaMobileNavigation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navigate = (label: DashboardTarget | "Agenda Inteligente") => {
    if (label === "Agenda Inteligente") {
      setOpen(false);
      return;
    }

    try {
      sessionStorage.setItem(PENDING_VIEW_KEY, label);
    } catch {}
    router.push("/contatos");
  };

  return (
    <>
      <header className={styles.mobileHeader} aria-label="Navegação da Agenda Inteligente">
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setOpen(true)}
          aria-label="Abrir menu de navegação"
          title="Abrir menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
            <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
            <rect x="3" y="17" width="18" height="2.5" rx="1.25" fill="#38bdf8" />
          </svg>
        </button>
        <div className={styles.title}>Agenda inteligente</div>
      </header>

      {open && (
        <div
          className={styles.drawerBackdrop}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <aside
            className={styles.drawer}
            aria-label="Menu principal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.drawerTop}>
              <span className={styles.brand}>VOTO FORTE PARANÁ</span>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
              >
                ×
              </button>
            </div>
            <div className={styles.menuLabel}>NAVEGAÇÃO</div>
            <nav className={styles.nav}>
              {items.map((item) => {
                const active = item.label === "Agenda Inteligente";
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={active ? styles.navButtonActive : styles.navButton}
                    onClick={() => navigate(item.label)}
                  >
                    <span className={styles.icon} aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
