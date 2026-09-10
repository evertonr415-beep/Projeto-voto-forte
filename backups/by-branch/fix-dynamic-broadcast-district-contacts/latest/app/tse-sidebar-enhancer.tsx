"use client";

import { useEffect } from "react";

export default function TseSidebarEnhancer() {
  useEffect(() => {
    // Remove qualquer botão duplicado residual se existir no DOM
    const duplicateBtn = document.querySelector(".tse-info-sidebar-btn");
    if (duplicateBtn) {
      duplicateBtn.remove();
    }
  }, []);

  return null;
}
