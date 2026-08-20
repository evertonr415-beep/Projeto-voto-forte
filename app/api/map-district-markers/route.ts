import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../../server-identity";

export const dynamic = "force-dynamic";

/**
 * Returns one marker per city (município) with total contact count
 * and approximate geographic center for the electoral map.
 */
export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOwner = url.searchParams.get("owner")?.trim().toLowerCase();

  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);

  const isAdmin = isAdministrator(account.role) || account.accessRole === "adm" || account.accessRole === "gestor";
  let scopeEmails = isAdmin ? emails : [account.email];

  if (requestedOwner && requestedOwner !== "all" && emails.includes(requestedOwner)) {
    scopeEmails = [requestedOwner];
  }

  // Try RPC first for efficiency
  try {
    const { data, error } = await account.supabase.rpc(
      "vf_map_city_markers",
      { p_owner_emails: scopeEmails },
    );

    if (!error && Array.isArray(data) && data.length > 0) {
      return Response.json(
        { markers: data },
        { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
      );
    }
  } catch {
    // Fallback to manual aggregation
  }

  // Fallback: aggregate from vf_owned_records manually
  let query = account.supabase
    .from("vf_owned_records")
    .select("payload")
    .eq("kind", "contact");

  if (!isAdmin) {
    query = query.in("owner_email", scopeEmails);
  }

  const { data: records, error: queryError } = await query.limit(10000);
  if (queryError) {
    return Response.json(
      { error: "Não foi possível carregar os marcadores do mapa." },
      { status: 500 },
    );
  }

  // Aggregate by city
  const cityMap = new Map<
    string,
    { city: string; total: number; voters: number; leaders: number; latitude: number; longitude: number }
  >();

  for (const record of records ?? []) {
    const payload = record.payload as Record<string, unknown> | null;
    if (!payload) continue;
    const city = String(payload.city || "").trim();
    if (!city) continue;

    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);
    const isLeader = String(payload.kind || "").toLowerCase() === "liderança";

    const existing = cityMap.get(city);
    if (existing) {
      existing.total++;
      if (isLeader) existing.leaders++;
      else existing.voters++;
      // Keep first valid coordinates found
      if ((!Number.isFinite(existing.latitude) || existing.latitude === 0) && Number.isFinite(lat)) {
        existing.latitude = lat;
        existing.longitude = lng;
      }
    } else {
      cityMap.set(city, {
        city,
        total: 1,
        voters: isLeader ? 0 : 1,
        leaders: isLeader ? 1 : 0,
        latitude: Number.isFinite(lat) ? lat : 0,
        longitude: Number.isFinite(lng) ? lng : 0,
      });
    }
  }

  const markers = Array.from(cityMap.values())
    .filter((m) => m.latitude !== 0 && m.longitude !== 0)
    .sort((a, b) => b.total - a.total);

  return Response.json(
    { markers },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } },
  );
}
