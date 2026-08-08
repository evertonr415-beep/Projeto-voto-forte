import AuthClient from "../auth-client";
import ContactBackNavigation from "../contact-back-navigation";
import ContactDistrictRanking from "../contact-district-ranking";
import "./coverage-clarity.css";
import "./contact-quality-label.css";

export default function ContactsPage() {
  return (
    <>
      <AuthClient dashboardMode="neutral" />
      <ContactBackNavigation />
      <ContactDistrictRanking />
    </>
  );
}
