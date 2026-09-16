import { redirect } from "next/navigation";
import { getAccount } from "../server-identity";
import SystemIntelligenceClient from "./system-intelligence-client";
import NeuralBackNavigation from "./neural-back-navigation";

export const dynamic = "force-dynamic";

export default async function SystemIntelligencePage() {
  const account = await getAccount();

  if (!account) {
    redirect("/contatos");
  }

  if (account.role !== "master") {
    redirect("/sistema-completo");
  }

  return (
    <>
      <SystemIntelligenceClient />
      <NeuralBackNavigation />
    </>
  );
}
