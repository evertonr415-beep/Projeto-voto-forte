"use client";

import NeutralDashboardClient from "./neutral-dashboard-client";
import ContactDistrictRanking from "./contact-district-ranking";
import ContactWhatsappQuickQueue from "./contact-whatsapp-quick-queue";
import MobileContactListEntryCollapse from "./contatos/mobile-contact-list-entry-collapse";
import MobileContactRowAccordion from "./contatos/mobile-contact-row-accordion";
import "./contatos/coverage-clarity.css";
import "./contatos/contact-quality-label.css";
import "./contatos/whatsapp-quick-queue.css";
import "./contatos/contacts-ux.css";
import "./contatos/hide-meetings-kpi.css";
import "./contatos/contacts-full-theme.css";
import "./contatos/contacts-mobile-polish.css";
import "./contatos/mobile-contact-row-accordion.css";
import "./contacts-embedded.css";

type ContactUser = {
  email: string;
  name: string;
  status?: string;
};

type Props = {
  currentUser: {
    email: string;
    name: string;
    role: string;
  };
  scope: string;
  users: ContactUser[];
  onScopeChange: (scope: string) => void;
  initialProfile?: "" | "Eleitor" | "Liderança";
  initialDistrictFilter?: string;
};

export default function ContactsExperience({
  currentUser,
  scope,
  users,
  onScopeChange,
  initialProfile = "",
  initialDistrictFilter = "",
}: Props) {
  return (
    <div className="contacts-route-scope contacts-dashboard-embedded">
      <NeutralDashboardClient
        currentUser={currentUser}
        embedded
        externalScope={scope}
        externalUsers={users}
        onExternalScopeChange={onScopeChange}
        initialProfile={initialProfile}
        initialDistrictFilter={initialDistrictFilter}
      />
      <MobileContactListEntryCollapse />
      <MobileContactRowAccordion />
      <ContactDistrictRanking />
      <ContactWhatsappQuickQueue />
    </div>
  );
}
