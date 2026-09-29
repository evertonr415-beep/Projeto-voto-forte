"use client";

import { usePathname } from "next/navigation";
import GestorAccessUi from "./gestor-access-ui";
import MunicipalityAdministrationEnhancer from "./municipality-administration-enhancer";
import MunicipalityManagementEnhancer from "./municipality-management-enhancer";
import UserHierarchyPanel from "./user-hierarchy-panel";
import "./administration-v6.css";

function isFullDashboardRoute(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

export default function GestorAccessGate() {
  const pathname = usePathname();

  if (!isFullDashboardRoute(pathname)) return null;
  return (
    <>
      <UserHierarchyPanel />
      <GestorAccessUi />
      <MunicipalityAdministrationEnhancer />
      <MunicipalityManagementEnhancer />
    </>
  );
}
