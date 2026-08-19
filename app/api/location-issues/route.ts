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
  const isAdmOrGestor =
    account.accessRole === "adm" ||
    account.accessRole === "gestor" ||
    isAdministrator(account.role);

  let scope = isAdmOrGestor ? "all" : account.email;
  if (requested === "all" && isAdmOrGestor) scope = "all";
  else if (requested && emails.includes(requested)) scope = requested;
  else if (requested && requested !== account.email && !isAdmOrGestor)
    return { error: Response.json({ error: "Acesso negado" }, { status: 403 }) };

  return { scope, emails };
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const resolved = await resolveScope(account, url.searchParams.get("owner") ?? undefined);
  if ("error" in resolved) return resolved.error;

  const { scope, emails } = resolved;
  const isGlobalScope = scope === "all";
  const page = Math.min(100_000, Math.max(1, Number(url.searchParams.get("page")) || 1));
  const requestedCategory = url.searchParams.get("category") ?? "";
  const category = FILTER_CATEGORIES.includes(
    requestedCategory as FilterCategory,
  )
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
  const to = from + PAGE_SIZE - 1;

  try {
    // 1. Fetch filter summary statistics
    const summaryMap: Record<string, number> = {};
    const { data: summaryRows } = await account.supabase.rpc(
      "vf_contact_quality_filter_summary",
    );

    if (Array.isArray(summaryRows)) {
      for (const item of summaryRows) {
        if (item && typeof item === "object") {
          const code = String((item as { filter_code?: unknown }).filter_code || "");
          const tot = safeCount((item as { total?: unknown }).total);
          if (code) summaryMap[code] = tot;
        }
      }
    }

    const categoryCounts: Record<string, number> = {
      invalid_phone: summaryMap["invalid_phone"] || 0,
      missing_name: summaryMap["missing_name"] || 0,
      incomplete_name: summaryMap["incomplete_name"] || 0,
      missing_district: summaryMap["missing_district"] || 0,
      location_divergence: summaryMap["location_divergence"] || 0,
      missing_street: summaryMap["missing_street"] || 0,
    };

    const severityCounts = {
      critical: categoryCounts.invalid_phone + categoryCounts.missing_name,
      warning:
        categoryCounts.incomplete_name +
        categoryCounts.missing_district +
        categoryCounts.location_divergence,
      info: categoryCounts.missing_street,
    };

    const totalContacts = summaryMap["all"] || 0;
    const totalIssues = summaryMap["needs_review"] || (severityCounts.critical + severityCounts.warning);
    const requiredIncomplete =
      categoryCounts.missing_name +
      categoryCounts.incomplete_name +
      categoryCounts.missing_district;

    // 2. Fetch issues data
    let issues: Array<Record<string, unknown>> = [];
    let total = 0;

    // First try the specialized RPC vf_contact_quality_filtered
    const effectiveFilter = category || (severity ? "needs_review" : "needs_review");
    const { data: rpcIssues, error: rpcError } = await account.supabase.rpc(
      "vf_contact_quality_filtered",
      {
        p_filter_code: effectiveFilter,
        p_limit: PAGE_SIZE,
        p_offset: from,
      },
    );

    if (!rpcError && Array.isArray(rpcIssues) && rpcIssues.length > 0) {
      issues = rpcIssues.map((row: Record<string, unknown>) => ({
        record_id: Number(row.record_id),
        owner_email: String(row.owner_email || ""),
        contact_name: String(row.contact_name || ""),
        phone: String(row.phone || ""),
        phone_normalized: String(row.phone || ""),
        district_original: String(row.district || ""),
        city: "Arapongas",
        state: "PR",
        street: String(row.street || ""),
        street_number: String(row.street_number || ""),
        cep: String(row.cep || ""),
        is_rural: row.map_location_type === "rural_location",
        issue_codes: Array.isArray(row.issue_codes) && row.issue_codes.length
          ? row.issue_codes
          : [category || "needs_review"],
        severity: String(row.severity || "warning"),
        updated_at: row.updated_at,
      }));

      total = summaryMap[effectiveFilter] || issues.length;
    } else {
      // Fallback to direct table query on vf_contact_quality
      let query = account.supabase
        .from("vf_contact_quality")
        .select(
          "record_id,owner_email,contact_name,phone,phone_normalized,district_original,city,state,street,street_number,cep,is_rural,issue_codes,severity,updated_at",
          { count: "exact" },
        )
        .order("updated_at", { ascending: false });

      if (!isGlobalScope) {
        query = query.eq("owner_email", scope);
      }

      if (category) {
        query = query.contains("issue_codes", [category]);
      } else {
        query = query.overlaps("issue_codes", [...ESSENTIAL_ISSUE_CATEGORIES]);
      }

      if (severity) query = query.eq("severity", severity);
      if (queryText) {
        query = query.or(
          `contact_name.ilike.*${queryText}*,phone.ilike.*${queryText}*,district_original.ilike.*${queryText}*,street.ilike.*${queryText}*`,
        );
      }

      query = query.range(from, to);
      const { data: tableData, count: tableCount } = await query;

      if (Array.isArray(tableData)) {
        issues = tableData;
        total = tableCount || tableData.length;
      }
    }

    // If search query is applied on client side or backend, refine results
    if (queryText && issues.length) {
      const lowerQ = queryText.toLowerCase();
      issues = issues.filter(
        (i) =>
          String(i.contact_name || "").toLowerCase().includes(lowerQ) ||
          String(i.phone || "").toLowerCase().includes(lowerQ) ||
          String(i.district_original || "").toLowerCase().includes(lowerQ) ||
          String(i.street || "").toLowerCase().includes(lowerQ),
      );
    }

    return Response.json(
      {
        scope,
        page,
        pageSize: PAGE_SIZE,
        total: total || issues.length,
        totalContacts,
        totalIssues,
        requiredIncomplete,
        categoryCounts,
        severityCounts,
        totalPages: Math.max(1, Math.ceil((total || issues.length) / PAGE_SIZE)),
        issues,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Failed to load contact quality issues", error);
    return Response.json(
      {
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
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

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

  // Synchronize quality table
  account.supabase.rpc("vf_sync_contact_quality_row", { p_record_id: recordId }).catch(() => undefined);

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

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
