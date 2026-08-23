import AuthClient from "../auth-client";
import ContactBackNavigation from "../contact-back-navigation";
import ContactDistrictRanking from "../contact-district-ranking";
import ContactWhatsappQuickQueue from "../contact-whatsapp-quick-queue";
import MobileContactListEntryCollapse from "./mobile-contact-list-entry-collapse";
import "./coverage-clarity.css";
import "./contact-quality-label.css";
import "./whatsapp-quick-queue.css";
import "./contacts-ux.css";
import "./hide-meetings-kpi.css";
import "./contacts-full-theme.css";

export default function ContactsPage() {
  return (
    <>
      <AuthClient dashboardMode="neutral" />
      <MobileContactListEntryCollapse />
      <ContactBackNavigation />
      <ContactDistrictRanking />
      <ContactWhatsappQuickQueue />
    </>
  );
}
