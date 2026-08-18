"use client";

import { usePathname } from "next/navigation";
import AuthReconciliationEnhancer from "./auth-reconciliation-enhancer";
import GestorAccessUi from "./gestor-access-ui";
import MunicipalityAdministrationEnhancer from "./municipality-administration-enhancer";
import MunicipalityManagementEnhancer from "./municipality-management-enhancer";
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
      <MunicipalityAdministrationEnhancer />
      <MunicipalityManagementEnhancer />
      <TeamPerformanceAdminEnhancer />
      <AuthReconciliationEnhancer />
    </>
  );
}
