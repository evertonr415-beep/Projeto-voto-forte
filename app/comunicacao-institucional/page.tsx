import type { Metadata } from "next";
import AuthClient from "../auth-client";
import AgendaAutoOpen from "./agenda-auto-open";

export const metadata: Metadata = {
  title: "Agenda Inteligente · VOTO FORTE PARANÁ",
  description: "Agenda Inteligente integrada ao painel principal do VOTO FORTE PARANÁ.",
};

export default function InstitutionalCommunicationPage() {
  return (
    <>
      <AuthClient dashboardMode="full" />
      <AgendaAutoOpen />
    </>
  );
}
