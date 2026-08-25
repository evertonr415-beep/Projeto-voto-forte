import type { Metadata } from "next";
import InstitutionalCommunicationClient from "./institutional-communication-client";
import InstitutionalBackNavigation from "./institutional-back-navigation";

export const metadata: Metadata = {
  title: "Comunicação Institucional · VOTO FORTE PARANÁ",
  description: "Planejamento editorial, rotina de entregas, frentes de mandato e conformidade territorial.",
};

export default function InstitutionalCommunicationPage() {
  return (
    <>
      <InstitutionalCommunicationClient />
      <InstitutionalBackNavigation />
    </>
  );
}
