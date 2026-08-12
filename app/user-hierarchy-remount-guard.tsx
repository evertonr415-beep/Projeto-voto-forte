"use client";

import { useEffect, useState } from "react";
import UserHierarchyPanel from "./user-hierarchy-panel";

export default function UserHierarchyRemountGuard() {
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let currentGrid = document.querySelector<HTMLElement>(".users-admin-grid");

    const observer = new MutationObserver(() => {
      const nextGrid = document.querySelector<HTMLElement>(".users-admin-grid");
      if (nextGrid === currentGrid) return;

      currentGrid = nextGrid;
      setGeneration((value) => value + 1);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <UserHierarchyPanel key={generation} />;
}
