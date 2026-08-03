import { getAccount, getVisibleUsers } from "../../server-identity";

type ContactPayload = Record<string, unknown> & {
  name?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  municipality?: string;
  municipio?: string;
  state?: string;
  uf?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
};

type OwnedRecord = {
  id: number;
  owner_email: string;
  payload: ContactPayload;
};

function hasCoordinates(payload: ContactPayload) {
  return Number.isFinite(Number(payload.latitude)) && Number.isFinite(Number(payload.longitude));
}

function buildQueries(payload: ContactPayload) {
  const city = String(payload.municipality || payload.municipio || payload.city || "").trim();
  const state = String(payload.uf || payload.state || "PR").trim() || "PR";
  const street = String(payload.street || "").trim();
  const number = String(payload.number || "").trim();
  const district = String(payload.district || "").trim();
  const cep = String(payload.cep || "").trim();

  const queries = [
    [street, number, district, city, state, cep, "Brasil"],
    [street, district, city, state, "Brasil"],
    [cep, city, state, "Brasil"],
    [district, city, state, "Brasil"],
  ]
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter((query, index, all) => query && all.indexOf(query) === index);

  return queries;
}

async function geocode(query: string) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
    {
      headers: {
        "accept-language": "pt-BR",
        "user-agent": "VotoForteParana/1.0 (sistemavotoforte.com.br)",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
  const first = data[0];
  if (!first) return null;
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    locationLabel: String(first.display_name || query),
  };
}

export async function POST() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const visibleUsers = await getVisibleUsers(account);
  const visibleEmails = visibleUsers.map((user) => user.email.toLowerCase());
  if (!visibleEmails.includes(account.email)) visibleEmails.push(account.email);

  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload")
    .eq("kind", "contact")
    .in("owner_email", visibleEmails)
    .order("updated_at", { ascending: true })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  const missing = ((data ?? []) as OwnedRecord[])
    .filter((record) => record.payload && !hasCoordinates(record.payload))
    .filter((record) => buildQueries(record.payload).length > 0)
    .slice(0, 4);

  let updated = 0;
  const failed: number[] = [];

  for (const record of missing) {
    let result: Awaited<ReturnType<typeof geocode>> = null;
    for (const query of buildQueries(record.payload)) {
      result = await geocode(query);
      if (result) break;
    }

    if (!result) {
      failed.push(record.id);
      continue;
    }

    const nextPayload = {
      ...record.payload,
      latitude: result.latitude,
      longitude: result.longitude,
      locationLabel: result.locationLabel,
      geocodedAt: new Date().toISOString(),
      geocodingSource: "OpenStreetMap Nominatim",
    };

    const { error: updateError } = await account.supabase
      .from("vf_owned_records")
      .update({ payload: nextPayload, updated_at: new Date().toISOString() })
      .eq("id", record.id);

    if (updateError) failed.push(record.id);
    else updated += 1;

    await new Promise((resolve) => setTimeout(resolve, 1050));
  }

  return Response.json({
    updated,
    failed,
    remaining: Math.max(0, missing.length - updated),
    processed: missing.length,
  });
}
