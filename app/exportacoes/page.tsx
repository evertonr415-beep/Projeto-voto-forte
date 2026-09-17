import { cookies } from "next/headers";
import { getAccount } from "../server-identity";
import ExportHistoryClient from "./export-history-client";
import ExportHistoryShell from "./export-history-shell";

export default async function ExportHistoryPage() {
  const account = await getAccount();
  const cookieInitials = (await cookies()).get("vf_profile_initials")?.value || "";
  const initialUser = account
    ? {
        email: String(account.email || ""),
        name: String(account.name || account.email || ""),
        role: String(account.accessRole === "gestor" ? "master" : account.role || "user"),
      }
    : undefined;

  return (
    <ExportHistoryShell
      title="Histórico de Exportações"
      initialUser={initialUser}
      initialInitials={cookieInitials}
    >
      <ExportHistoryClient />
    </ExportHistoryShell>
  );
}
