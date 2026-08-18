"use client";

import { usePathname } from "next/navigation";
import GestorAccessUi from "./gestor-access-ui";
import TeamPerformanceAdminEnhancer from "./team-performance-admin-enhancer";

function isFullDashboardRoute(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

export default function GestorAccessGate() {
  const pathname = usePathname();

  if (!isFullDashboardRoute(pathname)) return null;
  return (
    <>
      <GestorAccessUi />
      <TeamPerformanceAdminEnhancer />
    </>
  );
}
