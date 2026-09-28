import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getAccount } from "../server-identity";
import InstitutionalCommunicationClient from "./institutional-communication-client";
import InstitutionalBackNavigation from "./institutional-back-navigation";
import AgendaOfficialShell from "./agenda-official-shell";

export const metadata: Metadata = {
  title: "Comunicação Institucional · VOTO FORTE PARANÁ",
  description: "Planejamento editorial, rotina de entregas, frentes de mandato e conformidade territorial.",
};

export default async function InstitutionalCommunicationPage() {
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
    <AgendaOfficialShell initialUser={initialUser} initialInitials={cookieInitials}>
      <InstitutionalCommunicationClient />
      <InstitutionalBackNavigation />
    </AgendaOfficialShell>
  );
}
