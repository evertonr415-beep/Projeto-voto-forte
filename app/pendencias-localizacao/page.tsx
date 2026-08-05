import { redirect } from "next/navigation";
import { getAccount } from "../server-identity";
import LocationIssuesClient from "./location-issues-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LocationIssuesPage() {
  const account = await getAccount();
  if (!account) redirect("/contatos");

  return (
    <LocationIssuesClient
      currentUser={{
        email: account.email,
        name: account.name,
        role: account.role,
      }}
    />
  );
}
