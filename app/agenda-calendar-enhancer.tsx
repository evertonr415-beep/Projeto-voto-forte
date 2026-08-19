"use client";

import { useEffect } from "react";

export default function AgendaCalendarEnhancer() {
  useEffect(() => {
    const handleOldPrivacyCard = () => {
      const privacyCard = document.querySelector<HTMLElement>(".agenda-cards .privacy-card");
      if (privacyCard) {
        privacyCard.style.display = "none";
      }
    };

    handleOldPrivacyCard();
    const observer = new MutationObserver(handleOldPrivacyCard);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
