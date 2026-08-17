import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const PROFILES = new Set(["Eleitor", "Liderança"]);

type ExactMapFeature = {
  district?: string | null;
  profile?: string | null;
};

type DistrictBubbleRow = {
  district?: string | null;
  total?: number | string | null;
  voters?: number | string | null;
  leaders?: number | string | null;
  resolved?: boolean | null;
};

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

  const exactPromise = account.supabase.rpc("vf_map_exact_contact_points", rpcArgs);
  const bubblesPromise = account.supabase.rpc("vf_map_district_bubbles", rpcArgs);
  const statsPromise = includeStats
    ? account.supabase.rpc("vf_map_scope_stats", rpcArgs)
    : Promise.resolve({ data: undefined, error: null });

  const [exactResult, bubblesResult, statsResult] = await Promise.all([
    exactPromise,
    bubblesPromise,
    statsPromise,
  ]);

  if (exactResult.error) {
    console.error("Failed to load exact map contacts", exactResult.error);
    return Response.json(
      { error: "Não foi possível carregar os pinos do mapa agora." },
      { status: 500 },
    );
  }

  if (bubblesResult.error) {
    console.error("Failed to load district map bubbles", bubblesResult.error);
    return Response.json(
      { error: "Não foi possível carregar as bolhas dos bairros agora." },
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
  const exactByDistrict = new Map<
    string,
    { total: number; voters: number; leaders: number }
  >();

  for (const feature of features as ExactMapFeature[]) {
    const district = String(feature.district || "").trim();
    if (!district) continue;
    const current = exactByDistrict.get(district) || {
      total: 0,
      voters: 0,
      leaders: 0,
    };
    current.total += 1;
    if (feature.profile === "Liderança") current.leaders += 1;
    else current.voters += 1;
    exactByDistrict.set(district, current);
  }

  const bubbleRows = Array.isArray(bubblesResult.data)
    ? (bubblesResult.data as DistrictBubbleRow[])
    : [];

  const approximateDistricts = bubbleRows
    .filter((row) => Boolean(row.resolved))
    .map((row) => {
      const district = String(row.district || "").trim();
      const exact = exactByDistrict.get(district) || {
        total: 0,
        voters: 0,
        leaders: 0,
      };
      return {
        district,
        total: Math.max(0, Number(row.total || 0) - exact.total),
        voters: Math.max(0, Number(row.voters || 0) - exact.voters),
        leaders: Math.max(0, Number(row.leaders || 0) - exact.leaders),
      };
    })
    .filter((row) => row.district && row.total > 0);

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
    const totalContacts = Number(row?.total_contacts ?? 0);
    const mappedContacts = Number(row?.mapped_contacts ?? features.length);
    const approximatedContacts = approximateDistricts.reduce(
      (sum, district) => sum + district.total,
      0,
    );

    stats = {
      totalContacts,
      mappedContacts,
      approximatedContacts,
      unresolvedContacts: Math.max(
        0,
        totalContacts - mappedContacts - approximatedContacts,
      ),
      resolvedDistricts: approximateDistricts.length,
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
