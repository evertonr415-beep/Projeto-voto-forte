import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const PROFILES = new Set(["Eleitor", "Liderança"]);

async function visibleEmails(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
) {
  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);
  return emails;
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOwner = url.searchParams.get("owner")?.trim().toLowerCase();
  const requestedProfile = url.searchParams.get("profile")?.trim() || "";
  const includeStats = url.searchParams.get("stats") === "1";

  const allVisibleEmails = await visibleEmails(account);
  let scopeEmails = [account.email];
  let scope = account.email;

  if (requestedOwner === "all" && isAdministrator(account.role)) {
    scopeEmails = allVisibleEmails;
    scope = "all";
  } else if (requestedOwner && allVisibleEmails.includes(requestedOwner)) {
    scopeEmails = [requestedOwner];
    scope = requestedOwner;
  } else if (requestedOwner && requestedOwner !== account.email) {
    return Response.json(
      { error: "Você não possui acesso a este ambiente" },
      { status: 403 },
    );
  }

  const profile = PROFILES.has(requestedProfile) ? requestedProfile : "";
  const rpcArgs = {
    p_owner_emails: scopeEmails,
    p_profile: profile || null,
  };

  // District aggregation intentionally lives in /api/map-district-markers.
  // The old bubbles query here was discarded from the response and caused a
  // second full aggregation of the contact base every time the map opened.
  const exactPromise = account.supabase.rpc("vf_map_exact_contact_points", rpcArgs);
  const statsPromise = includeStats
    ? account.supabase.rpc("vf_map_scope_stats", rpcArgs)
    : Promise.resolve({ data: undefined, error: null });

  const [exactResult, statsResult] = await Promise.all([
    exactPromise,
    statsPromise,
  ]);

  if (exactResult.error) {
    console.error("Failed to load exact map contacts", exactResult.error);
    return Response.json(
      { error: "Não foi possível carregar os pinos do mapa agora." },
      { status: 500 },
    );
  }

  if (statsResult.error) {
    console.error("Failed to load map stats", statsResult.error);
    return Response.json(
      { error: "Não foi possível carregar os totais do mapa agora." },
      { status: 500 },
    );
  }

  const features = Array.isArray(exactResult.data) ? exactResult.data : [];

  let stats:
    | {
        totalContacts: number;
        mappedContacts: number;
        approximatedContacts: number;
        unresolvedContacts: number;
        resolvedDistricts: number;
      }
    | undefined;

  if (includeStats) {
    const row = Array.isArray(statsResult.data) ? statsResult.data[0] : undefined;
    const totalContacts = Math.max(0, Number(row?.total_contacts ?? 0));
    const mappedContacts = Math.max(
      0,
      Number(row?.mapped_contacts ?? features.length),
    );

    stats = {
      totalContacts,
      mappedContacts,
      // Approximate neighborhood totals are rendered by MapTerritoryEnhancer.
      // Keeping them out of this endpoint prevents duplicate aggregation.
      approximatedContacts: 0,
      unresolvedContacts: Math.max(0, totalContacts - mappedContacts),
      resolvedDistricts: 0,
    };
  }

  return Response.json(
    {
      scope,
      profile: profile || null,
      features,
      approximateDistricts: [],
      stats,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
