import { cookies } from "next/headers";
import { getAccount } from "../../server-identity";
import ExportHistoryShell from "../export-history-shell";
import ExportDetailClient from "./export-detail-client";

export default async function ExportDetailPage() {
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
      title="Detalhe da Exportação"
      initialUser={initialUser}
      initialInitials={cookieInitials}
    >
      <ExportDetailClient />
    </ExportHistoryShell>
  );
}
