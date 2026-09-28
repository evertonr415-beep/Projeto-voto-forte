import LocationIssuesAuthClient from "./location-issues-auth-client";
import QualityMobileListCollapse from "./quality-mobile-list-collapse";
import QualityBackNavigation from "./quality-back-navigation";

export default function LocationIssuesPage() {
  return (
    <>
      <LocationIssuesAuthClient />
      <QualityMobileListCollapse />
      <QualityBackNavigation />
    </>
  );
}
