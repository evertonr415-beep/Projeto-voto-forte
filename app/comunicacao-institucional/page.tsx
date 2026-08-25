import type { Metadata } from "next";
import InstitutionalCommunicationClient from "./institutional-communication-client";
import AgendaMobileNavigation from "./agenda-mobile-navigation";

export const metadata: Metadata = {
  title: "Comunicação Institucional · VOTO FORTE PARANÁ",
  description: "Planejamento editorial, rotina de entregas, frentes de mandato e conformidade territorial.",
};

export default function InstitutionalCommunicationPage() {
  return (
    <>
      <AgendaMobileNavigation />
      <InstitutionalCommunicationClient />
    </>
  );
}
