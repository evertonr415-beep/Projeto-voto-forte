import {
  getAccount,
  getVisibleUsers,
} from "../../server-identity";

const MAX_PAGE_SIZE = 50;
const MAX_MATCHING_UPDATES = 500;
const ARAPONGAS_BOUNDS = {
  minLatitude: -23.55,
  maxLatitude: -23.25,
  minLongitude: -51.6,
  maxLongitude: -51.3,
};

type Account = NonNullable<Awaited<ReturnType<typeof getAccount>>>;

type LocationIssue = {
  record_id: number;
  owner_email: string;
  contact_name: string;
  phone: string;
  district_original: string;
  district_key: string | null;
  category: string;
  suggested_district: string | null;
  updated_at: string;
};

type ContactRecord = {
  id: number;
  owner_email: string;
  payload: Record<string, unknown> | null;
};

type DistrictNameRow = {
  canonical_name?: unknown;
  cep_start?: unknown;
  cep_end?: unknown;
};

type DistrictSummaryRow = {
  district?: unknown;
  total?: unknown;
};

type DistrictGeocodeRow = {
  canonical_name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

type RecordIdRow = {
  record_id?: unknown;
};

type CorrectionBody = {
  recordId?: unknown;
  district?: unknown;
  applyToMatching?: unknown;
  owner?: unknown;
  referenceDistrict?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

async function readJsonBody(request: Request): Promise<CorrectionBody | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as CorrectionBody;
  } catch {
    return null;
  }
}

function requireAdm(account: Account) {
  if (account.accessRole === "adm") return null;
  return Response.json(
    { error: "Somente o ADM pode acessar pendências territoriais" },
    { status: 403 },
  );
}

async function resolveScope(account: Account, requestedOwner?: string | null) {
  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);

  const requested = requestedOwner?.trim().toLowerCase();
  let scope = account.email;
  if (requested === "all" && account.accessRole === "adm") scope = "all";
  else if (requested && emails.includes(requested)) scope = requested;
  else if (requested && requested !== account.email)
    return {
      error: Response.json(
        { error: "Você não possui acesso a este ambiente" },
        { status: 403 },
      ),
    };

  return { scope, emails };
}

function applyScope<T>(query: T, scope: string, emails: string[]) {
  const scoped = query as T & {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  };
  return scope === "all"
    ? scoped.in("owner_email", emails)
    : scoped.eq("owner_email", scope);
}

function normalizeDistrict(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

async function canonicalDistrict(account: Account, value: string) {
  const candidate = value.trim().slice(0, 120);
  if (!candidate) return null;
  const { data, error } = await account.supabase.rpc(
    "vf_resolve_arapongas_district",
    { value: candidate },
  );
  if (error) throw new Error(error.message);
  return typeof data === "string" && data.trim() ? data.trim() : null;
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const forbidden = requireAdm(account);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const resolved = await resolveScope(account, url.searchParams.get("owner"));
  if ("error" in resolved) return resolved.error;
  const { scope, emails } = resolved;

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(5, Number(url.searchParams.get("pageSize")) || 12),
  );
  const category = url.searchParams.get("category")?.trim() || "";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let issuesQuery = account.supabase
    .from("vf_contact_location_issues")
    .select(
      "record_id,owner_email,contact_name,phone,district_original,district_key,category,suggested_district,updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .order("record_id", { ascending: false })
    .range(from, to);
  issuesQuery = applyScope(issuesQuery, scope, emails);
  if (category) issuesQuery = issuesQuery.eq("category", category);

  const postalRefsPromise = account.supabase
    .from("vf_arapongas_district_postal_refs")
    .select("canonical_name,cep_start,cep_end")
    .order("canonical_name", { ascending: true });
  const summaryPromise = account.supabase.rpc("vf_contact_dashboard_summary", {
    p_owner_emails: scope === "all" ? emails : [scope],
  });
  const geocodesPromise = account.supabase
    .from("vf_arapongas_district_geocodes")
    .select("canonical_name,latitude,longitude");

  const [
    { data, count, error },
    postalRefsResult,
    summaryResult,
    geocodesResult,
  ] = await Promise.all([
    issuesQuery,
    postalRefsPromise,
    summaryPromise,
    geocodesPromise,
  ]);

  if (error)
    return Response.json({ error: error.message }, { status: 400 });
  if (postalRefsResult.error)
    return Response.json({ error: postalRefsResult.error.message }, { status: 400 });
  if (summaryResult.error)
    return Response.json({ error: summaryResult.error.message }, { status: 400 });
  if (geocodesResult.error)
    return Response.json({ error: geocodesResult.error.message }, { status: 400 });

  const postalRows = (postalRefsResult.data ?? []) as DistrictNameRow[];
  const districts = Array.from(
    new Set(
      postalRows
        .map((row) => String(row.canonical_name || "").trim())
        .filter(Boolean),
    ),
  );

  const postalByDistrict = new Map<
    string,
    Array<{ cepStart: string; cepEnd: string }>
  >();
  for (const row of postalRows) {
    const key = normalizeDistrict(row.canonical_name);
    if (!key) continue;
    const refs = postalByDistrict.get(key) ?? [];
    const cepStart = String(row.cep_start || "").trim();
    const cepEnd = String(row.cep_end || "").trim();
    if (cepStart || cepEnd) refs.push({ cepStart, cepEnd });
    postalByDistrict.set(key, refs);
  }

  const geocodedKeys = new Set(
    ((geocodesResult.data ?? []) as DistrictGeocodeRow[])
      .filter(
        (row) =>
          Number.isFinite(Number(row.latitude)) &&
          Number.isFinite(Number(row.longitude)),
      )
      .map((row) => normalizeDistrict(row.canonical_name))
      .filter(Boolean),
  );

  const summary = (summaryResult.data ?? {}) as {
    districts?: DistrictSummaryRow[];
  };
  const referenceIssues = (Array.isArray(summary.districts)
    ? summary.districts
    : []
  )
    .map((row) => {
      const district = String(row.district || "").trim();
      const total = Math.max(0, Number(row.total || 0));
      const key = normalizeDistrict(district);
      return {
        district,
        total,
        key,
        postalReferences: postalByDistrict.get(key) ?? [],
      };
    })
    .filter(
      (row) =>
        row.district &&
        row.key &&
        row.total > 0 &&
        row.key !== "ZONA RURAL" &&
        !geocodedKeys.has(row.key),
    )
    .sort(
      (left, right) =>
        right.total - left.total ||
        left.district.localeCompare(right.district, "pt-BR"),
    );

  return Response.json(
    {
      scope,
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      issues: (data ?? []) as LocationIssue[],
      districts,
      referenceIssues,
      referenceIssueContacts: referenceIssues.reduce(
        (sum, item) => sum + item.total,
        0,
      ),
      canManageReferences: account.accessRole === "adm",
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const forbidden = requireAdm(account);
  if (forbidden) return forbidden;

  const body = await readJsonBody(request);
  if (!body)
    return Response.json({ error: "Dados da correção inválidos" }, { status: 400 });

  if (typeof body.referenceDistrict === "string") {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return Response.json(
        { error: "Selecione um ponto válido no mapa" },
        { status: 400 },
      );
    if (
      latitude < ARAPONGAS_BOUNDS.minLatitude ||
      latitude > ARAPONGAS_BOUNDS.maxLatitude ||
      longitude < ARAPONGAS_BOUNDS.minLongitude ||
      longitude > ARAPONGAS_BOUNDS.maxLongitude
    )
      return Response.json(
        { error: "O ponto selecionado está fora da área esperada de Arapongas" },
        { status: 400 },
      );

    const { data: referenceResult, error: referenceError } = await account.supabase.rpc(
      "vf_set_district_territorial_reference",
      {
        p_district: body.referenceDistrict,
        p_latitude: latitude,
        p_longitude: longitude,
      },
    );
    if (referenceError)
      return Response.json({ error: referenceError.message }, { status: 400 });

    return Response.json(referenceResult ?? { ok: true });
  }

  const recordId = Number(body.recordId);
  if (!Number.isInteger(recordId) || recordId <= 0)
    return Response.json({ error: "Contato inválido" }, { status: 400 });
  if (typeof body.district !== "string" || !body.district.trim())
    return Response.json({ error: "Selecione o bairro correto" }, { status: 400 });
  if (body.owner !== undefined && typeof body.owner !== "string")
    return Response.json({ error: "Ambiente inválido" }, { status: 400 });
  if (body.applyToMatching !== undefined && typeof body.applyToMatching !== "boolean")
    return Response.json({ error: "Opção de correção em grupo inválida" }, { status: 400 });

  const owner = typeof body.owner === "string" ? body.owner : undefined;
  const resolved = await resolveScope(account, owner);
  if ("error" in resolved) return resolved.error;
  const { scope, emails } = resolved;

  const canonical = await canonicalDistrict(account, body.district);
  if (!canonical)
    return Response.json(
      { error: "Selecione um bairro reconhecido de Arapongas" },
      { status: 400 },
    );

  let issueQuery = account.supabase
    .from("vf_contact_location_issues")
    .select(
      "record_id,owner_email,contact_name,phone,district_original,district_key,category,suggested_district,updated_at",
    )
    .eq("record_id", recordId);
  issueQuery = applyScope(issueQuery, scope, emails);
  const { data: issueRows, error: issueError } = await issueQuery.limit(1);
  if (issueError)
    return Response.json({ error: issueError.message }, { status: 400 });
  const issue = (issueRows?.[0] ?? null) as LocationIssue | null;
  if (!issue)
    return Response.json(
      { error: "Pendência não encontrada neste ambiente" },
      { status: 404 },
    );

  const applyToMatching = body.applyToMatching === true && Boolean(issue.district_key);
  let targetIds = [recordId];
  if (applyToMatching && issue.district_key) {
    let matchingQuery = account.supabase
      .from("vf_contact_location_issues")
      .select("record_id")
      .eq("district_key", issue.district_key)
      .limit(MAX_MATCHING_UPDATES + 1);
    matchingQuery = applyScope(matchingQuery, scope, emails);
    const { data: matching, error: matchingError } = await matchingQuery;
    if (matchingError)
      return Response.json({ error: matchingError.message }, { status: 400 });
    targetIds = ((matching ?? []) as RecordIdRow[]).map((row) => Number(row.record_id));
    if (targetIds.length > MAX_MATCHING_UPDATES)
      return Response.json(
        {
          error:
            "Há mais de 500 contatos iguais. Resolva este grupo em lotes menores para preservar a segurança da operação.",
        },
        { status: 409 },
      );
  }

  const { data: records, error: recordsError } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload")
    .in("id", targetIds)
    .eq("kind", "contact");
  if (recordsError)
    return Response.json({ error: recordsError.message }, { status: 400 });

  const allowedOwners = new Set(scope === "all" ? emails : [scope]);
  const safeRecords = ((records ?? []) as ContactRecord[]).filter((record) =>
    allowedOwners.has(String(record.owner_email).toLowerCase()),
  );
  if (!safeRecords.length)
    return Response.json({ error: "Nenhum contato autorizado para corrigir" }, { status: 404 });

  let updated = 0;
  let failed = 0;
  const correctedAt = new Date().toISOString();
  for (const record of safeRecords) {
    const payload =
      record.payload && typeof record.payload === "object"
        ? { ...record.payload }
        : {};
    payload.district = canonical;
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    payload.locationPrecision =
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? "exact"
        : "approximate";
    payload.territorialCorrection = {
      source: "manual_district_assignment",
      originalDistrict: issue.district_original,
      correctedAt,
      correctedBy: account.email,
    };

    const { error } = await account.supabase
      .from("vf_owned_records")
      .update({ payload, updated_at: correctedAt })
      .eq("id", record.id)
      .eq("owner_email", record.owner_email);
    if (error) failed += 1;
    else updated += 1;
  }

  const { error: auditError } = await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: failed ? "Pendência territorial corrigida parcialmente" : "Pendência territorial corrigida",
    detail: `${updated} contato(s) corrigido(s)${failed ? ` · ${failed} falha(s)` : ""} · ${issue.district_original || "sem bairro"} → ${canonical}`,
  });

  if (failed || auditError) {
    if (auditError) console.error("Failed to audit territorial correction", auditError);
    return Response.json(
      {
        error: failed
          ? `A correção foi parcial: ${updated} contato(s) atualizado(s) e ${failed} falha(s). Recarregue antes de tentar novamente.`
          : "A correção foi aplicada, mas não foi possível registrar a auditoria.",
        updated,
        failed,
      },
      { status: 409 },
    );
  }

  return Response.json({
    ok: true,
    updated,
    district: canonical,
    appliedToMatching: applyToMatching,
  });
}
