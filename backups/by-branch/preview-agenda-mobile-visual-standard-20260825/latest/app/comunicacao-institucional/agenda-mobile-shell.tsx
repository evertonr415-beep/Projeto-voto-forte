"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./agenda-mobile-shell.module.css";

const dashboardItems = [
  ["Visão Geral", "⌂"],
  ["Contatos", "👥"],
  ["Mapa Eleitoral", "🗺"],
  ["Painel Eleitoral", "◎"],
  ["WhatsApp", "◉"],
] as const;

export default function AgendaMobileShell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const goDashboard = (label: string) => {
    setOpen(false);
    try {
      sessionStorage.setItem("vf-pending-dashboard-view", label);
    } catch {}
    router.push("/");
  };

  return (
    <div className={`${styles.routeShell} vf-agenda-route-shell`}>
      <header className={styles.mobileHeader} aria-label="Cabeçalho da Agenda Inteligente">
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setOpen(true)}
          aria-label="Abrir menu de navegação"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="2.5" rx="1.25" fill="currentColor" />
            <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="currentColor" />
            <rect x="3" y="17" width="18" height="2.5" rx="1.25" fill="currentColor" />
          </svg>
        </button>
        <div className={styles.titleWrap}>
          <span className={styles.eyebrow}>VOTO FORTE PARANÁ</span>
          <h1 className={styles.title}>Agenda Inteligente</h1>
        </div>
      </header>

      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}
        aria-hidden={!open}
        aria-label="Menu principal"
      >
        <div className={styles.drawerTop}>
          <div className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/voto-forte-bandeira-icon.jpg" alt="Voto Forte Paraná" />
            <div>
              <strong>VOTO FORTE</strong>
              <span>PARANÁ</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <div className={styles.navLabel}>NAVEGAÇÃO</div>
        <nav className={styles.nav}>
          {dashboardItems.map(([label, icon]) => (
            <button
              key={label}
              type="button"
              className={styles.navItem}
              onClick={() => goDashboard(label)}
            >
              <span className={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.navItem} ${styles.navItemActive}`}
            onClick={() => setOpen(false)}
          >
            <span className={styles.navIcon}>📅</span>
            <span>Agenda Inteligente</span>
          </button>
        </nav>

        <div className={styles.drawerNote}>
          A Agenda continua na rota própria. Este menu apenas padroniza a navegação mobile sem alterar a lógica ou os dados da Agenda.
        </div>
      </aside>
    </div>
  );
}
