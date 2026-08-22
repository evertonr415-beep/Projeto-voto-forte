"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./contact-mobile-list-collapse.css";

const MOBILE_QUERY = "(max-width: 760px)";
const COMPACT_LIMIT = 5;

export default function ContactMobileListCollapse() {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rowCount, setRowCount] = useState(0);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let cancelled = false;

    const attach = () => {
      const nextPanel = document.querySelector<HTMLElement>(".contacts-panel");
      if (!nextPanel || cancelled) return false;

      setPanel(nextPanel);

      const syncRows = () => {
        const rows = nextPanel.querySelectorAll(".optimized-table-wrap tbody > tr").length;
        setRowCount(rows);
        setExpanded(false);
      };

      syncRows();
      observer = new MutationObserver(syncRows);
      observer.observe(nextPanel, { childList: true, subtree: true });
      return true;
    };

    if (!attach()) {
      const bodyObserver = new MutationObserver(() => {
        if (!attach()) return;
        bodyObserver.disconnect();
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
      return () => {
        cancelled = true;
        bodyObserver.disconnect();
        observer?.disconnect();
      };
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!panel) return;
    panel.classList.toggle("mobile-contacts-expanded", expanded);
    return () => panel.classList.remove("mobile-contacts-expanded");
  }, [expanded, panel]);

  const host = useMemo(() => {
    if (!panel) return null;
    return panel.querySelector<HTMLElement>(".optimized-table-wrap");
  }, [panel, rowCount]);

  if (!panel || !host || rowCount <= COMPACT_LIMIT) return null;

  const toggle = (
    <div className="contact-mobile-list-toggle-host">
      <button
        type="button"
        className="contact-mobile-list-toggle"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((value) => !value);
          if (expanded && window.matchMedia(MOBILE_QUERY).matches) {
            window.requestAnimationFrame(() => {
              const top = panel.getBoundingClientRect().top + window.scrollY - 84;
              window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            });
          }
        }}
      >
        {expanded
          ? "Mostrar menos"
          : `Ver todos desta página (${rowCount.toLocaleString("pt-BR")})`}
      </button>
    </div>
  );

  return createPortal(toggle, host);
}
