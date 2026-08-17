import AuthClient from "../auth-client";
import ContactBackNavigation from "../contact-back-navigation";
import ContactDistrictRanking from "../contact-district-ranking";
import ContactMobileListCollapse from "../contact-mobile-list-collapse";
import ContactWhatsappQuickQueue from "../contact-whatsapp-quick-queue";
import "./coverage-clarity.css";
import "./contact-quality-label.css";
import "./whatsapp-quick-queue.css";

export default function ContactsPage() {
  return (
    <>
      <AuthClient dashboardMode="neutral" />
      <ContactBackNavigation />
      <ContactDistrictRanking />
      <ContactMobileListCollapse />
      <ContactWhatsappQuickQueue />
    </>
  );
}
