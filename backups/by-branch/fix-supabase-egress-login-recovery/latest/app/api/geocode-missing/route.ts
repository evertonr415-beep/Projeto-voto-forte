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

type GeocodeResult = {
  latitude: number;
  longitude: number;
  locationLabel: string;
};

function hasCoordinates(payload: ContactPayload) {
  return (
    Number.isFinite(Number(payload.latitude)) &&
    Number.isFinite(Number(payload.longitude))
  );
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizedDistrict(payload: ContactPayload) {
  return clean(payload.district).toLocaleUpperCase("pt-BR");
}

function buildExactQueries(payload: ContactPayload) {
  const city = clean(
    payload.municipality || payload.municipio || payload.city || "Arapongas",
  );
  const state = clean(payload.uf || payload.state || "PR") || "PR";
  const street = clean(payload.street);
  const number = clean(payload.number);
  const district = clean(payload.district);
  const cep = clean(payload.cep);

  return [
    [street, number, district, city, state, cep, "Brasil"],
    [street, district, city, state, "Brasil"],
    [cep, city, state, "Brasil"],
  ]
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter((query, index, all) => query && all.indexOf(query) === index);
}

function buildDistrictQueries(payload: ContactPayload) {
  const district = clean(payload.district);
  const city = clean(payload.city || "Arapongas") || "Arapongas";
  const state = clean(payload.state || "PR") || "PR";

  return [
    [district, city, state, "Brasil"],
    [district, "Arapongas", "Paraná", "Brasil"],
  ]
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter((query, index, all) => query && all.indexOf(query) === index);
}

async function geocode(query: string): Promise<GeocodeResult | null> {
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

  const data = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;
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

async function firstGeocode(queries: string[]) {
  for (const query of queries) {
    const result = await geocode(query);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 1050));
  }
  return null;
}

function spreadAround(latitude: number, longitude: number, id: number) {
  // Distribuição determinística em até aproximadamente 90 metros do centro do bairro.
  const goldenAngle = 2.399963229728653;
  const ring = (id % 17) + 1;
  const radius = 0.00008 + ring * 0.000045;
  const angle = id * goldenAngle;
  const latOffset = Math.sin(angle) * radius;
  const lonScale = Math.max(0.35, Math.cos((latitude * Math.PI) / 180));
  const lonOffset = (Math.cos(angle) * radius) / lonScale;

  return {
    latitude: latitude + latOffset,
    longitude: longitude + lonOffset,
  };
}

export async function POST() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const visibleUsers = await getVisibleUsers(account);
  const visibleEmails = visibleUsers.map((user) => user.email.toLowerCase());
  if (!visibleEmails.includes(account.email)) visibleEmails.push(account.email);

  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload")
    .eq("kind", "contact")
    .in("owner_email", visibleEmails)
    .order("updated_at", { ascending: true })
    .limit(600);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  const missing = ((data ?? []) as OwnedRecord[]).filter(
    (record) => record.payload && !hasCoordinates(record.payload),
  );

  if (!missing.length) {
    return Response.json({ updated: 0, failed: [], processed: 0, remaining: 0 });
  }

  let updated = 0;
  const failed: number[] = [];

  // Primeiro, resolve até dois contatos que realmente possuem endereço ou CEP.
  const exactRecords = missing
    .filter(
      (record) =>
        clean(record.payload.street) || clean(record.payload.cep),
    )
    .slice(0, 2);

  for (const record of exactRecords) {
    const result = await firstGeocode(buildExactQueries(record.payload));
    if (!result) {
      failed.push(record.id);
      continue;
    }

    const nextPayload = {
      ...record.payload,
      city: clean(record.payload.city) || "Arapongas",
      state: clean(record.payload.state) || "PR",
      latitude: result.latitude,
      longitude: result.longitude,
      locationLabel: result.locationLabel,
      locationPrecision: "endereco_exato",
      geocodedAt: new Date().toISOString(),
      geocodingSource: "OpenStreetMap Nominatim",
    };

    const { error: updateError } = await account.supabase
      .from("vf_owned_records")
      .update({ payload: nextPayload, updated_at: new Date().toISOString() })
      .eq("id", record.id);

    if (updateError) failed.push(record.id);
    else updated += 1;

    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  // Depois, resolve um bairro por execução e atualiza até 500 contatos desse bairro.
  const districtRecord = missing.find(
    (record) =>
      !exactRecords.some((exact) => exact.id === record.id) &&
      normalizedDistrict(record.payload),
  );

  if (districtRecord) {
    const districtKey = normalizedDistrict(districtRecord.payload);
    const districtContacts = missing
      .filter(
        (record) => normalizedDistrict(record.payload) === districtKey,
      )
      .slice(0, 500);

    const result = await firstGeocode(buildDistrictQueries(districtRecord.payload));

    if (!result) {
      failed.push(...districtContacts.map((record) => record.id));
    } else {
      for (const record of districtContacts) {
        const spread = spreadAround(result.latitude, result.longitude, record.id);
        const nextPayload = {
          ...record.payload,
          city: clean(record.payload.city) || "Arapongas",
          state: clean(record.payload.state) || "PR",
          latitude: spread.latitude,
          longitude: spread.longitude,
          locationLabel: `${clean(record.payload.district)} — Arapongas/PR`,
          locationPrecision: "bairro_aproximado",
          geocodedAt: new Date().toISOString(),
          geocodingSource: "OpenStreetMap Nominatim — centro aproximado do bairro",
        };

        const { error: updateError } = await account.supabase
          .from("vf_owned_records")
          .update({ payload: nextPayload, updated_at: new Date().toISOString() })
          .eq("id", record.id);

        if (updateError) failed.push(record.id);
        else updated += 1;
      }
    }
  }

  return Response.json({
    updated,
    failed,
    processed: exactRecords.length + (districtRecord ? 1 : 0),
    remaining: Math.max(0, missing.length - updated),
    district: districtRecord ? clean(districtRecord.payload.district) : null,
  });
}
