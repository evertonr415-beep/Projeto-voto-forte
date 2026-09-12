"use client";

import { usePathname } from "next/navigation";
import MunicipalityAdministrationEnhancer from "./municipality-administration-enhancer";
import MunicipalityManagementEnhancer from "./municipality-management-enhancer";
import TeamPerformanceAdminEnhancer from "./team-performance-admin-enhancer";
import AuthReconciliationEnhancer from "./auth-reconciliation-enhancer";
import GestorAccessUi from "./gestor-access-ui";
import UserHierarchyPanel from "./user-hierarchy-panel";
import AdministrationSafeEnhancer from "./administration-safe-enhancer";

function isFullDashboardRoute(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

export default function GestorAccessGate() {
  const pathname = usePathname();

  if (!isFullDashboardRoute(pathname)) return null;
  return (
    <>
      <UserHierarchyPanel />
      <MunicipalityAdministrationEnhancer />
      <TeamPerformanceAdminEnhancer />
      <AuthReconciliationEnhancer />
      <MunicipalityManagementEnhancer />
      <GestorAccessUi />
      <AdministrationSafeEnhancer />
    </>
  );
}
