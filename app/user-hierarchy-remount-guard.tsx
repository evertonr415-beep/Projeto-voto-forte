"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserHierarchyPanel from "./user-hierarchy-panel";

function isLegacyDashboard(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

export default function UserHierarchyRemountGuard() {
  const pathname = usePathname();
  const enabled = isLegacyDashboard(pathname);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let currentGrid = document.querySelector<HTMLElement>(".users-admin-grid");

    const observer = new MutationObserver(() => {
      const nextGrid = document.querySelector<HTMLElement>(".users-admin-grid");
      if (nextGrid === currentGrid) return;

      currentGrid = nextGrid;
      setGeneration((value) => value + 1);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  if (!enabled) return null;
  return <UserHierarchyPanel key={generation} />;
}
