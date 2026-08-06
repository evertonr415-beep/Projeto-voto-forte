import { getAccount, getVisibleUsers, isAdministrator } from "../../server-identity";

const PAGE_SIZE = 50;
const OPERATIONAL_ISSUE_CATEGORIES = [
  "invalid_phone",
  "missing_name",
  "incomplete_name",
  "missing_district",
  "missing_street",
  "location_divergence",
  "rural_location",
] as const;
const REQUIRED_FIELD_ISSUES = [
  "missing_name",
  "incomplete_name",
  "missing_district",
  "missing_street",
] as const;
const ISSUE_SEVERITIES = ["critical", "warning", "info"] as const;

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

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const resolved = await resolveScope(account, url.searchParams.get("owner") ?? undefined);
  if ("error" in resolved) return resolved.error;

  const { scope, emails } = resolved;
  const page = Math.min(100_000, Math.max(1, Number(url.searchParams.get("page")) || 1));
  const requestedCategory = url.searchParams.get("category") ?? "";
  const category = OPERATIONAL_ISSUE_CATEGORIES.includes(
    requestedCategory as (typeof OPERATIONAL_ISSUE_CATEGORIES)[number],
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
      .overlaps("issue_codes", [...OPERATIONAL_ISSUE_CATEGORIES])
      .order("severity_rank", { ascending: true })
      .order("updated_at", { ascending: false })
      .range(from, to);

    query = applyScope(query, scope, emails);
    if (category) query = query.contains("issue_codes", [category]);
    if (severity) query = query.eq("severity", severity);
    if (queryText)
      query = query.or(
        `contact_name.ilike.*${queryText}*,phone.ilike.*${queryText}*,phone_normalized.ilike.*${queryText}*,district_original.ilike.*${queryText}*,street.ilike.*${queryText}*`,
      );

    const countResults = await Promise.all(
      OPERATIONAL_ISSUE_CATEGORIES.map(async (item) => {
        let countQuery = account.supabase
          .from("vf_contact_quality")
          .select("record_id", { count: "exact", head: true })
          .contains("issue_codes", [item]);
        countQuery = applyScope(countQuery, scope, emails);
        const { count, error } = await countQuery;
        if (error) throw new Error(error.message);
        return [item, count ?? 0] as const;
      }),
    );

    const severityResults = await Promise.all(
      ISSUE_SEVERITIES.map(async (item) => {
        let countQuery = account.supabase
          .from("vf_contact_quality")
          .select("record_id", { count: "exact", head: true })
          .eq("severity", item)
          .overlaps("issue_codes", [...OPERATIONAL_ISSUE_CATEGORIES]);
        countQuery = applyScope(countQuery, scope, emails);
        const { count, error } = await countQuery;
        if (error) throw new Error(error.message);
        return [item, count ?? 0] as const;
      }),
    );

    let totalContactsQuery = account.supabase
      .from("vf_contact_quality")
      .select("record_id", { count: "exact", head: true });
    totalContactsQuery = applyScope(totalContactsQuery, scope, emails);

    let requiredIncompleteQuery = account.supabase
      .from("vf_contact_quality")
      .select("record_id", { count: "exact", head: true })
      .overlaps("issue_codes", [...REQUIRED_FIELD_ISSUES]);
    requiredIncompleteQuery = applyScope(requiredIncompleteQuery, scope, emails);

    const [
      { data, count, error },
      { count: totalContacts, error: totalError },
      { count: requiredIncomplete, error: requiredIncompleteError },
    ] = await Promise.all([query, totalContactsQuery, requiredIncompleteQuery]);
    if (error) throw new Error(error.message);
    if (totalError) throw new Error(totalError.message);
    if (requiredIncompleteError) throw new Error(requiredIncompleteError.message);

    const categoryCounts = Object.fromEntries(countResults);
    const severityCounts = Object.fromEntries(severityResults);
    const total = count ?? 0;
    const issues = (data ?? []).map((issue) => ({
      ...issue,
      issue_codes: Array.isArray(issue.issue_codes)
        ? issue.issue_codes.filter((code) =>
            OPERATIONAL_ISSUE_CATEGORIES.includes(
              code as (typeof OPERATIONAL_ISSUE_CATEGORIES)[number],
            ),
          )
        : [],
    }));

    return Response.json(
      {
        scope,
        page,
        pageSize: PAGE_SIZE,
        total,
        totalContacts: totalContacts ?? 0,
        totalIssues:
          Number(severityCounts.critical ?? 0) +
          Number(severityCounts.warning ?? 0),
        requiredIncomplete: requiredIncomplete ?? 0,
        categoryCounts,
        severityCounts,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        issues,
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
  if (!street)
    return Response.json({ error: "Informe a rua onde o contato mora." }, { status: 400 });

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
    detail: `registro ${recordId} · nome, bairro e rua atualizados`,
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
