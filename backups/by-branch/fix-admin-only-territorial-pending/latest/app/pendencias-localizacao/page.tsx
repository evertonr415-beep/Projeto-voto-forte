import { redirect } from "next/navigation";
import { getAccount } from "../server-identity";
import LocationIssuesAuthClient from "./location-issues-auth-client";
import QualityMobileListCollapse from "./quality-mobile-list-collapse";
import QualityBackNavigation from "./quality-back-navigation";

export default async function LocationIssuesPage() {
  const account = await getAccount();

  if (!account || account.accessRole !== "adm") {
    redirect("/");
  }

  return (
    <>
      <LocationIssuesAuthClient />
      <QualityMobileListCollapse />
      <QualityBackNavigation />
    </>
  );
}
