import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const PROFILES = new Set(["Eleitor", "Liderança"]);

function finiteParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function applyScope<T>(query: T, emails: string[]) {
  const scoped = query as T & { in: (column: string, values: string[]) => T };
  return scoped.in("owner_email", emails);
}

function applyProfile<T>(query: T, profile: string) {
  if (!profile) return query;
  const scoped = query as T & { eq: (column: string, value: string) => T };
  return scoped.eq("payload->>kind", profile);
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
  const south = Math.max(-90, Math.min(90, finiteParam(url.searchParams.get("south"), -90)));
  const north = Math.max(-90, Math.min(90, finiteParam(url.searchParams.get("north"), 90)));
  const west = Math.max(-180, Math.min(180, finiteParam(url.searchParams.get("west"), -180)));
  const east = Math.max(-180, Math.min(180, finiteParam(url.searchParams.get("east"), 180)));
  const zoom = Math.max(1, Math.min(20, Math.round(finiteParam(url.searchParams.get("zoom"), 13))));

  const featurePromise = account.supabase.rpc("vf_map_contact_features", {
    p_owner_emails: scopeEmails,
    p_south: south,
    p_west: west,
    p_north: north,
    p_east: east,
    p_zoom: zoom,
    p_profile: profile || null,
  });
  const districtPromise = includeStats
    ? account.supabase.rpc("vf_map_unmapped_district_counts", {
        p_owner_emails: scopeEmails,
        p_profile: profile || null,
      })
    : Promise.resolve({ data: undefined, error: null });

  const [{ data, error }, districtResult] = await Promise.all([
    featurePromise,
    districtPromise,
  ]);

  if (error) {
    console.error("Failed to load map contact features", error);
    return Response.json(
      { error: "Não foi possível carregar os contatos do mapa agora." },
      { status: 400 },
    );
  }
  if (districtResult.error) {
    console.error("Failed to load approximate district counts", districtResult.error);
  }

  let stats:
    | {
        totalContacts: number;
        mappedContacts: number;
        approximatedContacts: number;
        unresolvedContacts: number;
      }
    | undefined;

  if (includeStats) {
    let totalQuery = account.supabase
      .from("vf_owned_records")
      .select("id", { count: "exact", head: true })
      .eq("kind", "contact");
    totalQuery = applyProfile(applyScope(totalQuery, scopeEmails), profile);

    let mappedQuery = account.supabase
      .from("vf_owned_records")
      .select("id", { count: "exact", head: true })
      .eq("kind", "contact")
      .not("payload->>latitude", "is", null)
      .not("payload->>longitude", "is", null)
      .neq("payload->>latitude", "")
      .neq("payload->>longitude", "");
    mappedQuery = applyProfile(applyScope(mappedQuery, scopeEmails), profile);

    const [totalResult, mappedResult] = await Promise.all([totalQuery, mappedQuery]);
    if (totalResult.error || mappedResult.error) {
      console.error("Failed to load map contact stats", totalResult.error || mappedResult.error);
    } else {
      const totalContacts = Number(totalResult.count ?? 0);
      const mappedContacts = Number(mappedResult.count ?? 0);
      const approximatedContacts = Array.isArray(districtResult.data)
        ? districtResult.data.reduce(
            (sum: number, item: { total?: number | string }) => sum + Number(item.total || 0),
            0,
          )
        : 0;
      stats = {
        totalContacts,
        mappedContacts,
        approximatedContacts,
        unresolvedContacts: Math.max(
          0,
          totalContacts - mappedContacts - approximatedContacts,
        ),
      };
    }
  }

  return Response.json(
    {
      scope,
      profile: profile || null,
      features: Array.isArray(data) ? data : [],
      approximateDistricts: Array.isArray(districtResult.data)
        ? districtResult.data
        : undefined,
      stats,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
