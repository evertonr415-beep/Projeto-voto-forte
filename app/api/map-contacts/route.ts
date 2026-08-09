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

type ExactRecord = {
  id: number;
  payload: Record<string, unknown> | null;
};

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
  const south = Math.max(
    -90,
    Math.min(90, finiteParam(url.searchParams.get("south"), -90)),
  );
  const north = Math.max(
    -90,
    Math.min(90, finiteParam(url.searchParams.get("north"), 90)),
  );
  const west = Math.max(
    -180,
    Math.min(180, finiteParam(url.searchParams.get("west"), -180)),
  );
  const east = Math.max(
    -180,
    Math.min(180, finiteParam(url.searchParams.get("east"), 180)),
  );

  let exactQuery = account.supabase
    .from("vf_owned_records")
    .select("id,payload")
    .eq("kind", "contact")
    .not("payload->>latitude", "is", null)
    .not("payload->>longitude", "is", null)
    .neq("payload->>latitude", "")
    .neq("payload->>longitude", "");
  exactQuery = applyProfile(applyScope(exactQuery, scopeEmails), profile);

  const districtPromise = includeStats
    ? account.supabase.rpc("vf_map_district_bubbles", {
        p_owner_emails: scopeEmails,
        p_profile: profile || null,
      })
    : Promise.resolve({ data: undefined, error: null });

  const [exactResult, districtResult] = await Promise.all([
    exactQuery,
    districtPromise,
  ]);

  if (exactResult.error) {
    console.error("Failed to load exact map contacts", exactResult.error);
    return Response.json(
      { error: "Não foi possível carregar os contatos do mapa agora." },
      { status: 400 },
    );
  }

  if (districtResult.error) {
    console.error("Failed to load district bubbles", districtResult.error);
    return Response.json(
      {
        error:
          "Não foi possível carregar as bolhas dos bairros agora. Tente novamente em instantes.",
      },
      { status: 500 },
    );
  }

  const exactRecords = (exactResult.data || []) as ExactRecord[];
  const features = exactRecords.flatMap((record) => {
    const payload = record.payload || {};
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < south || latitude > north || longitude < west || longitude > east)
      return [];

    const contactProfile =
      String(payload.kind || "") === "Liderança" ? "Liderança" : "Eleitor";

    return [
      {
        feature_type: "point" as const,
        latitude,
        longitude,
        total: 1,
        voters: contactProfile === "Eleitor" ? 1 : 0,
        leaders: contactProfile === "Liderança" ? 1 : 0,
        contact_name: String(payload.name || "Contato"),
        profile: contactProfile,
        district: String(payload.district || ""),
        street: String(payload.street || ""),
        street_number: String(payload.number || ""),
      },
    ];
  });

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
    let totalQuery = account.supabase
      .from("vf_owned_records")
      .select("id", { count: "exact", head: true })
      .eq("kind", "contact");
    totalQuery = applyProfile(applyScope(totalQuery, scopeEmails), profile);

    const totalResult = await totalQuery;
    if (!totalResult.error) {
      const totalContacts = Number(totalResult.count ?? 0);
      const mappedContacts = exactRecords.length;
      const bubbles = Array.isArray(districtResult.data)
        ? districtResult.data
        : [];
      const resolvedContacts = bubbles.reduce(
        (
          sum: number,
          item: { total?: number | string; resolved?: boolean },
        ) => sum + (item.resolved ? Number(item.total || 0) : 0),
        0,
      );
      stats = {
        totalContacts,
        mappedContacts,
        approximatedContacts: resolvedContacts,
        unresolvedContacts: Math.max(0, totalContacts - resolvedContacts),
        resolvedDistricts: bubbles.filter(
          (item: { resolved?: boolean }) => item.resolved,
        ).length,
      };
    }
  }

  return Response.json(
    {
      scope,
      profile: profile || null,
      features,
      approximateDistricts: Array.isArray(districtResult.data)
        ? districtResult.data
        : [],
      stats,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
