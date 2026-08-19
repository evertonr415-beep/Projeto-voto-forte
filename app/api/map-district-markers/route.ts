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

type CachedDistrictMarkerItem = {
  district?: string;
  total?: number | string;
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

type MunicipalityItem = {
  id?: number | string;
  name?: string;
  state?: string;
};

type MunicipalityContext = {
  currentMunicipalityId?: number | string;
  municipalities?: MunicipalityItem[];
};

function normalizeDistrict(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function isArapongas(name: unknown) {
  return String(name ?? "").trim().toLocaleLowerCase("pt-BR") === "arapongas";
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

  const contextResult = await account.supabase.rpc("vf_municipality_context");
  if (contextResult.error) {
    console.error("Failed to load municipality context for map", contextResult.error);
    return Response.json(
      { error: "Não foi possível identificar o município do mapa agora." },
      { status: 500 },
    );
  }

  const context = (contextResult.data || {}) as MunicipalityContext;
  const currentMunicipality = (context.municipalities || []).find(
    (item) => Number(item.id) === Number(context.currentMunicipalityId),
  );
  if (!currentMunicipality) {
    return Response.json(
      { error: "Município atual não encontrado." },
      { status: 400 },
    );
  }

  const arapongas = isArapongas(currentMunicipality.name);
  const statsPromise = account.supabase.rpc("vf_map_scope_stats", {
    p_owner_emails: scopeEmails,
    p_profile: null,
  });

  if (arapongas) {
    // Arapongas keeps a trigger-maintained district summary. Reading this
    // compact table avoids re-normalizing the entire contact base on every map
    // opening while preserving the existing RLS owner scope.
    const markersPromise = account.supabase.rpc("vf_map_cached_district_markers", {
      p_owner_emails: scopeEmails,
    });
    const liveSummaryPromise = account.supabase.rpc("vf_map_district_summary", {
      p_owner_emails: scopeEmails,
    });

    const [markersResult, statsResult, liveSummaryResult] = await Promise.all([
      markersPromise,
      statsPromise,
      liveSummaryPromise,
    ]);

    if (markersResult.error) {
      console.error("Failed to load cached district markers", markersResult.error);
      return Response.json(
        { error: "Não foi possível carregar os totais dos bairros agora." },
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

    const cachedRows = Array.isArray(markersResult.data)
      ? (markersResult.data as CachedDistrictMarkerItem[])
      : [];

    const liveRows = Array.isArray(liveSummaryResult.data)
      ? (liveSummaryResult.data as { district?: string; total?: number; latitude?: number; longitude?: number }[])
      : [];

    // Mapeamento dinâmico: une os bairros catalogados com qualquer novo bairro importado
    const districtMap = new Map<string, { district: string; total: number; latitude?: number; longitude?: number }>();

    // 1. Insere referências catalogadas de Arapongas
    for (const row of cachedRows) {
      const name = String(row.district || "").trim();
      const norm = normalizeDistrict(name);
      if (!name || !norm) continue;
      districtMap.set(norm, {
        district: name,
        total: Math.max(0, Number(row.total || 0)),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      });
    }

    // 2. Atualiza ou adiciona dinamicamente qualquer novo bairro vindo dos contatos importados
    for (const row of liveRows) {
      const name = String(row.district || "").trim();
      const norm = normalizeDistrict(name);
      const total = Math.max(0, Number(row.total || 0));
      if (!name || !norm || total <= 0) continue;

      const existing = districtMap.get(norm);
      if (existing) {
        // Atualiza para o total real caso haja contatos novos importados
        existing.total = Math.max(existing.total, total);
        if (Number.isFinite(row.latitude) && Number.isFinite(row.longitude)) {
          existing.latitude = Number(row.latitude);
          existing.longitude = Number(row.longitude);
        }
      } else {
        // Novo bairro detectado automaticamente nos dados importados!
        districtMap.set(norm, {
          district: name,
          total,
          latitude: Number.isFinite(row.latitude) ? Number(row.latitude) : -23.414,
          longitude: Number.isFinite(row.longitude) ? Number(row.longitude) : -51.425,
        });
      }
    }

    const mergedItems = Array.from(districtMap.values());

    const districts = mergedItems
      .filter((item) => item.total > 0)
      .map((item) => ({
        district: item.district,
        total: item.total,
      }))
      .sort((a, b) => b.total - a.total || a.district.localeCompare(b.district, "pt-BR"));

    const markers: DistrictMarker[] = mergedItems
      .filter(
        (item) =>
          item.total > 0 &&
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude),
      )
      .map((item) => ({
        district: item.district,
        total: item.total,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
      }))
      .sort(
        (left, right) =>
          right.total - left.total ||
          left.district.localeCompare(right.district, "pt-BR"),
      );

    const statsRow = Array.isArray(statsResult.data)
      ? (statsResult.data[0] as ScopeStatsItem | undefined)
      : undefined;
    const totalContacts = Math.max(
      Number(statsRow?.total_contacts || 0),
      districts.reduce((sum, d) => sum + d.total, 0),
    );

    return Response.json(
      {
        scope,
        municipality: {
          id: Number(currentMunicipality.id),
          name: String(currentMunicipality.name || ""),
          state: String(currentMunicipality.state || ""),
          usesLegacyArapongasReferences: true,
        },
        totalContacts,
        districts,
        markers,
        resolvedDistricts: markers.length,
        representedContacts: markers.reduce(
          (sum, marker) => sum + marker.total,
          0,
        ),
        availableGeocodes: markers.length,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const summaryPromise = account.supabase.rpc(
    "vf_current_municipality_map_district_summary",
    { p_owner_emails: scopeEmails },
  );
  const geocodePromise = Promise.resolve({
    data: [] as DistrictGeocodeItem[],
    error: null,
  });

  const [summaryResult, geocodeResult, statsResult] = await Promise.all([
    summaryPromise,
    geocodePromise,
    statsPromise,
  ]);

  if (summaryResult.error) {
    console.error("Failed to load district map summary", summaryResult.error);
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
    const item = (rawItem ?? {}) as DistrictGeocodeItem;
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
      municipality: {
        id: Number(currentMunicipality.id),
        name: String(currentMunicipality.name || ""),
        state: String(currentMunicipality.state || ""),
        usesLegacyArapongasReferences: false,
      },
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
