import AuthClient from "../auth-client";
import ContactDistrictRanking from "../contact-district-ranking";
import "./coverage-clarity.css";
import "./contact-quality-label.css";

export default function ContactsPage() {
  return (
    <>
      <AuthClient dashboardMode="neutral" />
      <ContactDistrictRanking />
    </>
  );
}
