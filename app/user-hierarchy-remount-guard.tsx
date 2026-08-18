"use client";

import { usePathname } from "next/navigation";
import UserHierarchyPanel from "./user-hierarchy-panel";

function isLegacyDashboard(pathname: string) {
  return pathname === "/" || pathname === "/sistema-completo";
}

export default function UserHierarchyRemountGuard() {
  const pathname = usePathname();

  if (!isLegacyDashboard(pathname)) return null;
  return <UserHierarchyPanel />;
}
