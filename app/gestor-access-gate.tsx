"use client";

import { usePathname } from "next/navigation";
import AdministrationAuditWorkspace from "./administration-audit-workspace";
import MunicipalityManagementEnhancer from "./municipality-management-enhancer";
import UserHierarchyPanel from "./user-hierarchy-panel";
import "./administration-access-workspace.css";
import "./municipality-management-v2.css";
import "./municipality-directory-pagination.css";
import "./administration-audit-workspace.css";
import "./administration-backup-v2.css";
import "./administration-layout-reset.css";

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
      <AdministrationAuditWorkspace />
    </>
  );
}
