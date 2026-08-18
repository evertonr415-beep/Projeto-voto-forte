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

type QualityIssueRow = Record<string, unknown> & {
  issue_codes?: unknown;
  severity?: unknown;
};
type QualityScopeSummaryRow = {
  total_contacts?: unknown;
  total_issues?: unknown;
  required_incomplete?: unknown;
  invalid_phone?: unknown;
  missing_name?: unknown;
  incomplete_name?: unknown;
  missing_district?: unknown;
  location_divergence?: unknown;
  missing_street?: unknown;
  critical?: unknown;
  warning?: unknown;
  info?: unknown;
};

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
  let scope = account.email;
  if (requested === "all" && isAdministrator(account.role)) scope = "all";
  else if (requested && emails.includes(requested)) scope = requested;
  else if (requested && requested !== account.email)
    return { error: Response.json({ error: "Acesso negado" }, { status: 403 }) };

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

function isAuxiliaryCategory(value: string) {
  return AUXILIARY_FILTER_CATEGORIES.includes(
    value as (typeof AUXILIARY_FILTER_CATEGORIES)[number],
  );
}

function normalizeIssues(data: unknown, category: string) {
  const responseCategorySet = new Set<string>(
    isAuxiliaryCategory(category)
      ? FILTER_CATEGORIES
      : ESSENTIAL_ISSUE_CATEGORIES,
  );
  return (Array.isArray(data) ? (data as QualityIssueRow[]) : []).map((issue) => {
    const issueCodes = Array.isArray(issue.issue_codes)
      ? issue.issue_codes.filter(
          (code: unknown): code is FilterCategory =>
            typeof code === "string" && responseCategorySet.has(code),
        )
      : [];
    const hasEssentialIssue = issueCodes.some((code) =>
      ESSENTIAL_ISSUE_CATEGORIES.includes(
        code as (typeof ESSENTIAL_ISSUE_CATEGORIES)[number],
      ),
    );

    return {
      ...issue,
      issue_codes: issueCodes,
      severity: hasEssentialIssue ? issue.severity : "info",
    };
  });
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const resolved = await resolveScope(account, url.searchParams.get("owner") ?? undefined);
  if ("error" in resolved) return resolved.error;

  const { scope, emails } = resolved;
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
    let query = account.supabase
      .from("vf_contact_quality")
      .select(
        "record_id,owner_email,contact_name,phone,phone_normalized,district_original,city,state,street,street_number,cep,is_rural,issue_codes,severity,updated_at",
        { count: "exact" },
      )
      .order("severity_rank", { ascending: true })
      .order("updated_at", { ascending: false });

    query = applyScope(query, scope, emails);
    query = category
      ? query.contains("issue_codes", [category])
      : query.overlaps("issue_codes", [...ESSENTIAL_ISSUE_CATEGORIES]);

    if (severity && !isAuxiliaryCategory(category)) query = query.eq("severity", severity);
    if (queryText)
      query = query.or(
        `contact_name.ilike.*${queryText}*,phone.ilike.*${queryText}*,phone_normalized.ilike.*${queryText}*,district_original.ilike.*${queryText}*,street.ilike.*${queryText}*`,
      );

    query = query.range(from, to);

    const [
      { data, count, error },
      { data: summaryData, error: summaryError },
    ] = await Promise.all([
      query,
      account.supabase.rpc("vf_contact_quality_scope_summary", {
        p_owner_email: scope,
      }),
    ]);

    if (error) throw new Error(error.message);
    if (summaryError) throw new Error(summaryError.message);

    const summary = ((summaryData ?? [])[0] ?? {}) as QualityScopeSummaryRow;
    const categoryCounts = {
      invalid_phone: safeCount(summary.invalid_phone),
      missing_name: safeCount(summary.missing_name),
      incomplete_name: safeCount(summary.incomplete_name),
      missing_district: safeCount(summary.missing_district),
      location_divergence: safeCount(summary.location_divergence),
      missing_street: safeCount(summary.missing_street),
    };
    const severityCounts = {
      critical: safeCount(summary.critical),
      warning: safeCount(summary.warning),
      info: safeCount(summary.info),
    };
    const total = count ?? 0;

    return Response.json(
      {
        scope,
        page,
        pageSize: PAGE_SIZE,
        total,
        totalContacts: safeCount(summary.total_contacts),
        totalIssues: severityCounts.critical + severityCounts.warning,
        requiredIncomplete: safeCount(summary.required_incomplete),
        categoryCounts,
        severityCounts,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        issues: normalizeIssues(data, category),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Failed to load contact quality issues", error);
    return Response.json(
      { error: "Não foi possível carregar as pendências agora." },
      { status: 400 },
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

  const emails = await visibleEmails(account);
  const { data: record, error: recordError } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload,updated_at")
    .eq("id", recordId)
    .eq("kind", "contact")
    .single();

  if (recordError || !record)
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });
  const ownerEmail = String(record.owner_email).trim().toLowerCase();
  if (!emails.includes(ownerEmail))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const currentPayload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};
  const previousUpdatedAt =
    typeof record.updated_at === "string" && record.updated_at
      ? record.updated_at
      : null;

  let updateQuery = account.supabase
    .from("vf_owned_records")
    .update({
      payload: { ...currentPayload, name, district, street },
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .eq("kind", "contact")
    .eq("owner_email", record.owner_email);

  updateQuery = previousUpdatedAt
    ? updateQuery.eq("updated_at", previousUpdatedAt)
    : updateQuery.is("updated_at", null);

  const { data: updated, error } = await updateQuery
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to update contact quality issue", error);
    return Response.json({ error: "Não foi possível corrigir o contato." }, { status: 400 });
  }
  if (!updated)
    return Response.json(
      { error: "O contato foi alterado por outra operação. Recarregue e tente novamente." },
      { status: 409 },
    );

  const { error: auditError } = await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Cadastro essencial do contato corrigido",
    detail: `registro ${recordId} · nome e bairro atualizados; rua revisada quando informada`,
  });
  if (auditError) console.error("Failed to audit contact quality update", auditError);

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
