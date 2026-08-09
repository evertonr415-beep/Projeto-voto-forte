import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const MAX_PAGE_SIZE = 50;
const MAX_MATCHING_UPDATES = 500;

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

async function resolveScope(account: Account, requestedOwner?: string | null) {
  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);

  const requested = requestedOwner?.trim().toLowerCase();
  let scope = account.email;
  if (requested === "all" && isAdministrator(account.role)) scope = "all";
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

  const districtsPromise = account.supabase
    .from("vf_arapongas_district_postal_refs")
    .select("canonical_name")
    .order("canonical_name", { ascending: true });

  const [{ data, count, error }, districtsResult] = await Promise.all([
    issuesQuery,
    districtsPromise,
  ]);

  if (error)
    return Response.json({ error: error.message }, { status: 400 });
  if (districtsResult.error)
    return Response.json({ error: districtsResult.error.message }, { status: 400 });

  const districts = Array.from(
    new Set(
      (districtsResult.data ?? [])
        .map((row) => String(row.canonical_name || "").trim())
        .filter(Boolean),
    ),
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
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    recordId?: number;
    district?: string;
    applyToMatching?: boolean;
    owner?: string;
  };
  const recordId = Number(body.recordId);
  if (!Number.isInteger(recordId) || recordId <= 0)
    return Response.json({ error: "Contato inválido" }, { status: 400 });

  const resolved = await resolveScope(account, body.owner);
  if ("error" in resolved) return resolved.error;
  const { scope, emails } = resolved;

  const canonical = await canonicalDistrict(account, body.district || "");
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

  let targetIds = [recordId];
  if (body.applyToMatching && issue.district_key) {
    let matchingQuery = account.supabase
      .from("vf_contact_location_issues")
      .select("record_id")
      .eq("district_key", issue.district_key)
      .limit(MAX_MATCHING_UPDATES + 1);
    matchingQuery = applyScope(matchingQuery, scope, emails);
    const { data: matching, error: matchingError } = await matchingQuery;
    if (matchingError)
      return Response.json({ error: matchingError.message }, { status: 400 });
    targetIds = (matching ?? []).map((row) => Number(row.record_id));
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

  let updated = 0;
  for (const record of safeRecords) {
    const payload =
      record.payload && typeof record.payload === "object"
        ? { ...record.payload }
        : {};
    payload.district = canonical;
    payload.locationPrecision = payload.latitude && payload.longitude ? "exact" : "approximate";
    payload.territorialCorrection = {
      source: "manual_district_assignment",
      originalDistrict: issue.district_original,
      correctedAt: new Date().toISOString(),
      correctedBy: account.email,
    };

    const { error } = await account.supabase
      .from("vf_owned_records")
      .update({ payload, updated_at: new Date().toISOString() })
      .eq("id", record.id);
    if (!error) updated += 1;
  }

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Pendência territorial corrigida",
    detail: `${updated} contato(s) · ${issue.district_original || "sem bairro"} → ${canonical}`,
  });

  return Response.json({
    ok: true,
    updated,
    district: canonical,
    appliedToMatching: Boolean(body.applyToMatching),
  });
}
