"use client";

import { usePathname } from "next/navigation";
import MunicipalityManagementEnhancer from "./municipality-management-enhancer";
import UserHierarchyPanel from "./user-hierarchy-panel";

function isFullDashboardRoute(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

export default function GestorAccessGate() {
  const pathname = usePathname();

  if (!isFullDashboardRoute(pathname)) return null;
  return (
    <>
      <UserHierarchyPanel />
      <MunicipalityManagementEnhancer />
    </>
  );
}
