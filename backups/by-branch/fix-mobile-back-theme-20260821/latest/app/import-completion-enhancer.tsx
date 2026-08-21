"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ImportCompletionEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/importar-contatos") return;

    const sync = () => {
      const progressLabel = document.querySelector(".progress-block b");
      const startButton = document.querySelector<HTMLElement>(".start-button");
      const pauseButton = document.querySelector(".pause-button");
      if (!startButton) return;

      const completed = progressLabel?.textContent?.trim() === "100%" && !pauseButton;
      startButton.style.display = completed ? "none" : "";
      startButton.setAttribute("aria-hidden", completed ? "true" : "false");
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
