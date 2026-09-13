"use client";

import { useEffect } from "react";

const STYLE_ID = "vf-agenda-calendar-enhancer-styles";

export default function AgendaCalendarEnhancer() {
  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        .agenda-cards .privacy-card {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return null;
}
