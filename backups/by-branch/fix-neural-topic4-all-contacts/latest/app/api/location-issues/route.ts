import { getAccount, getVisibleUsers, isAdministrator } from "../../server-identity";

const PAGE_SIZE = 50;
const ESSENTIAL_ISSUE_CATEGORIES = [
  "invalid_phone",
  "missing_name",
  "incomplete_name",
  "missing_district",
  "location_divergence",
] as const;
const AUXILIARY_FILTER_CATEGORIES = ["missing_street"] as const;
const FILTER_CATEGORIES = [
  ...ESSENTIAL_ISSUE_CATEGORIES,
  ...AUXILIARY_FILTER_CATEGORIES,
] as const;
const ISSUE_SEVERITIES = ["critical", "warning", "info"] as const;
const SUMMARY_CACHE_TTL_MS = 30_000;

type SummaryCacheEntry = {
  timestamp: number;
  data: Record<string, number>;
};
const summaryCache = new Map<string, SummaryCacheEntry>();

type FilterCategory = (typeof FILTER_CATEGORIES)[number];

type QualityUpdateBody = {
  recordId?: number;
  name?: string;
  district?: string;
  street?: string;
};

type QualityDeleteBody = {
  recordIds?: number[];
  confirmation?: string;
};

function sanitizeSearch(value: string) {
  return value
    .replace(/[,.()*\\%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function normalizeRequiredText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as T;
  } catch {
    return null;
  }
}

function canMutateQuality(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
) {
  return String(account.accessRole || "").trim().toLowerCase() === "adm";
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

async function resolveScope(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  requestedOwner?: string,
) {
  const emails = await visibleEmails(account);
  const requested = requestedOwner?.trim().toLowerCase();
  const canUseAll =
    account.accessRole === "adm" ||
    account.accessRole === "gestor" ||
    isAdministrator(account.role);

  if (!requested) {
    return { scope: canUseAll ? "all" : account.email, emails, canUseAll };
  }

  if (requested === "all") {
    if (!canUseAll)
      return { error: Response.json({ error: "Acesso negado" }, { status: 403 }) };
    return { scope: "all", emails, canUseAll };
  }

  if (!emails.includes(requested)) {
    return { error: Response.json({ error: "Acesso negado" }, { status: 403 }) };
  }

  return { scope: requested, emails, canUseAll };
}

async function loadGestorQualitySummary(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  scope: string,
  isGlobalScope: boolean,
) {
  let owners: string[] = [];

  if (isGlobalScope) {
    const { data, error } = await account.supabase.rpc(
      "vf_gestor_operational_owner_emails",
    );
    if (error) throw error;
    owners = (Array.isArray(data) ? data : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
  } else {
    owners = [scope.trim().toLowerCase()].filter(Boolean);
  }

  const uniqueOwners = [...new Set(owners)];
  const aggregate: Record<string, number> = {
    all: 0,
    needs_review: 0,
    invalid_phone: 0,
    missing_name: 0,
    incomplete_name: 0,
    missing_district: 0,
    location_divergence: 0,
    missing_street: 0,
  };

  const summaries = await Promise.all(
    uniqueOwners.map(async (ownerEmail) => {
      const { data, error } = await account.supabase.rpc(
        "vf_contact_quality_filter_summary_for_owner",
        { p_owner_email: ownerEmail },
      );
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    }),
  );

  for (const rows of summaries) {
    for (const item of rows) {
      if (!item || typeof item !== "object") continue;
      const row = item as { filter_code?: unknown; total?: unknown };
      const code = String(row.filter_code || "");
      if (!code) continue;
      aggregate[code] = (aggregate[code] || 0) + safeCount(row.total);
    }
  }

  return aggregate;
}

async function loadSummaryMap(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  scope: string,
  isGlobalScope: boolean,
) {
  const cacheKey = `${account.email}:${scope}`;
  const now = Date.now();
  const cached = summaryCache.get(cacheKey);
  if (cached && now - cached.timestamp < SUMMARY_CACHE_TTL_MS) {
    return cached.data;
  }

  let summaryMap: Record<string, number> = {};
  const isGestor = String(account.accessRole || "").trim().toLowerCase() === "gestor";

  if (isGestor) {
    try {
      summaryMap = await loadGestorQualitySummary(account, scope, isGlobalScope);
    } catch (error) {
      console.error("Failed to load Gestor quality summary", error);
      summaryMap = {};
    }
  }

  if (!("all" in summaryMap)) {
    try {
      const { data: scopedRows, error: scopedError } = await account.supabase.rpc(
        "vf_contact_quality_scope_summary",
        { p_owner_email: isGlobalScope ? "all" : scope },
      );

      if (scopedError) throw scopedError;
      const scoped = Array.isArray(scopedRows) ? scopedRows[0] : scopedRows;
      if (scoped && typeof scoped === "object") {
        const row = scoped as Record<string, unknown>;
        summaryMap = {
          all: safeCount(row.total_contacts),
          needs_review: safeCount(row.total_issues),
          invalid_phone: safeCount(row.invalid_phone),
          missing_name: safeCount(row.missing_name),
          incomplete_name: safeCount(row.incomplete_name),
          missing_district: safeCount(row.missing_district),
          location_divergence: safeCount(row.location_divergence),
          missing_street: safeCount(row.missing_street),
          critical: safeCount(row.critical),
          warning: safeCount(row.warning),
          info: safeCount(row.info),
        };
      }
    } catch {
      // Mantém compatibilidade com a função anterior se a RPC de escopo estiver indisponível.
    }
  }

  if (!("all" in summaryMap)) {
    try {
      const { data: summaryRows, error } = isGlobalScope
        ? await account.supabase.rpc("vf_contact_quality_filter_summary")
        : await account.supabase.rpc(
            "vf_contact_quality_filter_summary_for_owner",
            { p_owner_email: scope },
          );

      if (error) throw error;
      if (Array.isArray(summaryRows)) {
        for (const item of summaryRows) {
          if (!item || typeof item !== "object") continue;
          const code = String((item as { filter_code?: unknown }).filter_code || "");
          if (!code) continue;
          summaryMap[code] = safeCount((item as { total?: unknown }).total);
        }
      }
    } catch {
      // O fallback abaixo preserva o painel caso as RPCs estejam temporariamente indisponíveis.
    }
  }

  if (!("all" in summaryMap)) {
    let baseQualityQuery = account.supabase.from("vf_contact_quality");
    if (!isGlobalScope) baseQualityQuery = baseQualityQuery.eq("owner_email", scope);

    const [
      allRes,
      invPhoneRes,
      missNameRes,
      incNameRes,
      missDistRes,
      locDivRes,
      missStreetRes,
    ] = await Promise.all([
      baseQualityQuery.select("record_id", { count: "planned", head: true }),
      baseQualityQuery.select("record_id", { count: "planned", head: true }).eq("has_invalid_phone", true),
      baseQualityQuery.select("record_id", { count: "planned", head: true }).eq("has_missing_name", true),
      baseQualityQuery.select("record_id", { count: "planned", head: true }).eq("has_incomplete_name", true),
      baseQualityQuery.select("record_id", { count: "planned", head: true }).eq("has_missing_district", true),
      baseQualityQuery.select("record_id", { count: "planned", head: true }).eq("has_location_divergence", true),
      baseQualityQuery.select("record_id", { count: "planned", head: true }).eq("has_missing_street", true),
    ]);

    summaryMap = {
      all: allRes.count ?? 0,
      invalid_phone: invPhoneRes.count ?? 0,
      missing_name: missNameRes.count ?? 0,
      incomplete_name: incNameRes.count ?? 0,
      missing_district: missDistRes.count ?? 0,
      location_divergence: locDivRes.count ?? 0,
      missing_street: missStreetRes.count ?? 0,
    };
    summaryMap.needs_review =
      (summaryMap.invalid_phone || 0) +
      (summaryMap.missing_name || 0) +
      (summaryMap.incomplete_name || 0) +
      (summaryMap.missing_district || 0) +
      (summaryMap.location_divergence || 0);
  }

  summaryCache.set(cacheKey, { timestamp: now, data: summaryMap });
  if (summaryCache.size > 30) {
    for (const [key, entry] of summaryCache) {
      if (now - entry.timestamp >= SUMMARY_CACHE_TTL_MS) summaryCache.delete(key);
    }
  }
  return summaryMap;
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const resolved = await resolveScope(account, url.searchParams.get("owner") ?? undefined);
  if ("error" in resolved) return resolved.error;

  const { scope } = resolved;
  const isGlobalScope = scope === "all";
  const page = Math.min(100_000, Math.max(1, Number(url.searchParams.get("page")) || 1));
  const requestedCategory = url.searchParams.get("category") ?? "";
  const category = FILTER_CATEGORIES.includes(requestedCategory as FilterCategory)
    ? requestedCategory
    : "";
  const requestedSeverity = url.searchParams.get("severity") ?? "";
  const severity = ISSUE_SEVERITIES.includes(
    requestedSeverity as (typeof ISSUE_SEVERITIES)[number],
  )
    ? requestedSeverity
    : "";
  const queryText = sanitizeSearch(url.searchParams.get("q") ?? "");
  const from = (page - 1) * PAGE_SIZE;
  const toWithProbe = from + PAGE_SIZE;

  try {
    const summaryMap = await loadSummaryMap(account, scope, isGlobalScope);

    const categoryCounts: Record<string, number> = {
      invalid_phone: summaryMap.invalid_phone || 0,
      missing_name: summaryMap.missing_name || 0,
      incomplete_name: summaryMap.incomplete_name || 0,
      missing_district: summaryMap.missing_district || 0,
      location_divergence: summaryMap.location_divergence || 0,
      missing_street: summaryMap.missing_street || 0,
    };

    const severityCounts = {
      critical: summaryMap.critical || categoryCounts.invalid_phone + categoryCounts.missing_name,
      warning:
        summaryMap.warning ||
        categoryCounts.incomplete_name +
          categoryCounts.missing_district +
          categoryCounts.location_divergence,
      info: summaryMap.info || categoryCounts.missing_street,
    };

    const totalContacts = summaryMap.all || 0;
    const totalIssues =
      summaryMap.needs_review || severityCounts.critical + severityCounts.warning;
    const requiredIncomplete =
      categoryCounts.missing_name +
      categoryCounts.incomplete_name +
      categoryCounts.missing_district;

    let query = account.supabase
      .from("vf_contact_quality")
      .select(
        "record_id,owner_email,contact_name,phone,phone_normalized,district_original,city,state,street,street_number,cep,is_rural,issue_codes,severity,updated_at",
      )
      .order("updated_at", { ascending: false });

    if (!isGlobalScope) query = query.eq("owner_email", scope);

    if (category === "invalid_phone") query = query.eq("has_invalid_phone", true);
    else if (category === "missing_name") query = query.eq("has_missing_name", true);
    else if (category === "incomplete_name") query = query.eq("has_incomplete_name", true);
    else if (category === "missing_district") query = query.eq("has_missing_district", true);
    else if (category === "location_divergence") query = query.eq("has_location_divergence", true);
    else if (category === "missing_street") query = query.eq("has_missing_street", true);

    if (severity) {
      query = query.eq("severity", severity);
    } else if (!category) {
      query = query.in("severity", ["critical", "warning"]);
    }

    if (queryText) {
      query = query.or(
        `contact_name.ilike.%${queryText}%,phone.ilike.%${queryText}%,district_original.ilike.%${queryText}%,street.ilike.%${queryText}%`,
      );
    }

    const { data: tableData, error: tableError } = await query.range(from, toWithProbe);
    if (tableError) throw tableError;

    const rawIssues = Array.isArray(tableData)
      ? (tableData as Array<Record<string, unknown>>)
      : [];
    const hasMore = rawIssues.length > PAGE_SIZE;
    const issues = rawIssues.slice(0, PAGE_SIZE);

    let knownTotal: number | null = null;
    if (!queryText && category && !severity) knownTotal = categoryCounts[category] ?? 0;
    else if (!queryText && severity && !category) knownTotal = severityCounts[severity] ?? 0;
    else if (!queryText && !category && !severity) knownTotal = totalIssues;

    const observedTotal = from + issues.length + (hasMore ? 1 : 0);
    const total = knownTotal === null ? observedTotal : knownTotal;
    const totalPages = knownTotal === null
      ? Math.max(1, page + (hasMore ? 1 : 0))
      : Math.max(1, Math.ceil(total / PAGE_SIZE));

    return Response.json(
      {
        scope,
        page,
        pageSize: PAGE_SIZE,
        total,
        totalContacts,
        totalIssues,
        requiredIncomplete,
        categoryCounts,
        severityCounts,
        totalPages,
        issues,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Failed to load contact quality issues", error);
    return Response.json(
      {
        error: "Não foi possível carregar a Central de Qualidade agora.",
        scope,
        page,
        pageSize: PAGE_SIZE,
        total: 0,
        totalContacts: 0,
        totalIssues: 0,
        requiredIncomplete: 0,
        categoryCounts: {},
        severityCounts: {},
        totalPages: 1,
        issues: [],
      },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!canMutateQuality(account))
    return Response.json({ error: "Somente o ADM pode alterar dados pela Central de Qualidade." }, { status: 403 });

  const body = await readJsonBody<QualityUpdateBody>(request);
  if (!body)
    return Response.json({ error: "Dados da correção inválidos." }, { status: 400 });

  const recordId = Number(body.recordId);
  const name = normalizeRequiredText(body.name);
  const district = normalizeRequiredText(body.district);
  const street = normalizeRequiredText(body.street);
  const hasCompleteName = name.split(/\s+/).filter(Boolean).length >= 2;

  if (!Number.isInteger(recordId) || recordId <= 0)
    return Response.json({ error: "Contato inválido" }, { status: 400 });
  if (!hasCompleteName)
    return Response.json(
      { error: "Informe o nome completo, com pelo menos nome e sobrenome." },
      { status: 400 },
    );
  if (!district)
    return Response.json({ error: "Informe o bairro ou a localidade." }, { status: 400 });

  const { data: record, error: recordError } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload,updated_at")
    .eq("id", recordId)
    .eq("kind", "contact")
    .single();

  if (recordError || !record)
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });

  const currentPayload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};

  const { data: updated, error } = await account.supabase
    .from("vf_owned_records")
    .update({
      payload: { ...currentPayload, name, district, street },
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("kind", "contact")
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    console.error("Failed to update contact quality issue", error);
    return Response.json({ error: "Não foi possível corrigir o contato." }, { status: 400 });
  }

  summaryCache.clear();
  account.supabase.rpc("vf_sync_contact_quality_row", { p_record_id: recordId }).catch(() => undefined);

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!canMutateQuality(account))
    return Response.json({ error: "Somente o ADM pode excluir dados pela Central de Qualidade." }, { status: 403 });

  const body = await readJsonBody<QualityDeleteBody>(request);
  if (!body)
    return Response.json({ error: "Dados da exclusão inválidos." }, { status: 400 });

  const recordIds = [...new Set((body.recordIds ?? []).map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

  if (!recordIds.length)
    return Response.json({ error: "Nenhum contato selecionado" }, { status: 400 });

  try {
    const { data, error } = await account.supabase.rpc(
      "vf_delete_contact_quality_batch",
      {
        p_record_ids: recordIds,
        p_confirmation: String(body.confirmation ?? ""),
      },
    );

    if (error) {
      console.error("Failed to delete contact quality batch", error);
      const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 409;
      const message =
        error.code === "42501"
          ? "Acesso negado"
          : error.code === "22023"
            ? "A seleção ou a confirmação é inválida."
            : "A seleção mudou durante a exclusão. Recarregue e tente novamente.";
      return Response.json({ error: message }, { status });
    }

    summaryCache.clear();
    const result = (data ?? {}) as { deleted?: number };
    return Response.json({ ok: true, deleted: Number(result.deleted) || 0 });
  } catch (error) {
    console.error("Unexpected bulk contact deletion failure", error);
    return Response.json(
      { error: "Não foi possível excluir os contatos agora." },
      { status: 400 },
    );
  }
}
