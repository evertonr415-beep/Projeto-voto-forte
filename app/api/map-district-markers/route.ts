import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

type DistrictSummaryItem = {
  district?: string;
  total?: number | string;
};

type DistrictGeocodeItem = {
  canonical_name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type ScopeStatsItem = {
  total_contacts?: number | string;
};

type DistrictMarker = {
  district: string;
  total: number;
  latitude: number;
  longitude: number;
};

function normalizeDistrict(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
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

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOwner = url.searchParams.get("owner")?.trim().toLowerCase();
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

  const [summaryResult, geocodeResult, statsResult] = await Promise.all([
    account.supabase.rpc("vf_map_district_summary", {
      p_owner_emails: scopeEmails,
    }),
    account.supabase
      .from("vf_arapongas_district_geocodes")
      .select("canonical_name, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null),
    account.supabase.rpc("vf_map_scope_stats", {
      p_owner_emails: scopeEmails,
      p_profile: null,
    }),
  ]);

  if (summaryResult.error) {
    console.error("Failed to load cached district map summary", summaryResult.error);
    return Response.json(
      { error: "Não foi possível carregar os totais dos bairros agora." },
      { status: 500 },
    );
  }

  if (geocodeResult.error) {
    console.error("Failed to load validated district geocodes", geocodeResult.error);
    return Response.json(
      { error: "Não foi possível carregar as referências territoriais agora." },
      { status: 500 },
    );
  }

  if (statsResult.error) {
    console.error("Failed to load map scope totals", statsResult.error);
    return Response.json(
      { error: "Não foi possível carregar o total de contatos agora." },
      { status: 500 },
    );
  }

  const summaryRows = Array.isArray(summaryResult.data)
    ? (summaryResult.data as DistrictSummaryItem[])
    : [];
  const districts = summaryRows
    .map((item) => ({
      district: String(item.district || "").trim(),
      total: Math.max(0, Number(item.total || 0)),
    }))
    .filter((item) => item.district && normalizeDistrict(item.district));
  const totals = new Map<string, { district: string; total: number }>();

  for (const item of districts) {
    totals.set(normalizeDistrict(item.district), item);
  }

  const markers: DistrictMarker[] = [];
  const geocodeRows = Array.isArray(geocodeResult.data) ? geocodeResult.data : [];

  for (const rawItem of geocodeRows) {
    const item = (rawItem ?? {}) as unknown as DistrictGeocodeItem;
    const key = normalizeDistrict(item.canonical_name);
    const summaryItem = totals.get(key);
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);

    if (
      !summaryItem ||
      !key ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    markers.push({
      district: summaryItem.district,
      total: summaryItem.total,
      latitude,
      longitude,
    });
  }

  markers.sort(
    (left, right) =>
      right.total - left.total ||
      left.district.localeCompare(right.district, "pt-BR"),
  );

  const statsRow = Array.isArray(statsResult.data)
    ? (statsResult.data[0] as ScopeStatsItem | undefined)
    : undefined;
  const totalContacts = Math.max(0, Number(statsRow?.total_contacts || 0));

  return Response.json(
    {
      scope,
      totalContacts,
      districts,
      markers,
      resolvedDistricts: markers.length,
      representedContacts: markers.reduce(
        (sum, marker) => sum + marker.total,
        0,
      ),
      availableGeocodes: geocodeRows.length,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
