import { getAccount, getVisibleUsers, isAdministrator } from "../../server-identity";

const PAGE_SIZE = 50;
const MAX_BULK_DELETE = 500;
const ISSUE_CATEGORIES = [
  "duplicate_phone",
  "invalid_phone",
  "missing_location",
  "incomplete_location",
  "location_divergence",
  "rural_location",
] as const;

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
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const category = url.searchParams.get("category") ?? "";
  const severity = url.searchParams.get("severity") ?? "";
  const queryText = url.searchParams.get("q")?.trim() ?? "";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  try {
    let query = account.supabase
      .from("vf_contact_quality")
      .select(
        "record_id,owner_email,contact_name,phone,phone_normalized,district_original,city,state,street,street_number,cep,is_rural,issue_codes,severity,updated_at",
        { count: "exact" },
      )
      .neq("severity", "ok")
      .order("severity", { ascending: true })
      .order("updated_at", { ascending: false })
      .range(from, to);

    query = applyScope(query, scope, emails);
    if (category) query = query.contains("issue_codes", [category]);
    if (severity) query = query.eq("severity", severity);
    if (queryText)
      query = query.or(
        `contact_name.ilike.%${queryText}%,phone.ilike.%${queryText}%,district_original.ilike.%${queryText}%`,
      );

    const countResults = await Promise.all(
      ISSUE_CATEGORIES.map(async (item) => {
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
      ["critical", "warning", "info"].map(async (item) => {
        let countQuery = account.supabase
          .from("vf_contact_quality")
          .select("record_id", { count: "exact", head: true })
          .eq("severity", item);
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

    const [{ data, count, error }, { count: totalContacts, error: totalError }] =
      await Promise.all([query, totalContactsQuery]);
    if (error) throw new Error(error.message);
    if (totalError) throw new Error(totalError.message);

    const categoryCounts = Object.fromEntries(countResults);
    const severityCounts = Object.fromEntries(severityResults);
    const total = count ?? 0;

    return Response.json(
      {
        scope,
        page,
        pageSize: PAGE_SIZE,
        total,
        totalContacts: totalContacts ?? 0,
        totalIssues: Number(severityCounts.critical ?? 0) + Number(severityCounts.warning ?? 0) + Number(severityCounts.info ?? 0),
        categoryCounts,
        severityCounts,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        issues: data ?? [],
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar pendências" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as { recordId?: number; district?: string };
  const recordId = Number(body.recordId);
  const district = String(body.district ?? "").trim();
  if (!Number.isInteger(recordId) || recordId <= 0 || !district)
    return Response.json({ error: "Correção inválida" }, { status: 400 });

  const emails = await visibleEmails(account);
  const { data: record, error: recordError } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload")
    .eq("id", recordId)
    .eq("kind", "contact")
    .single();

  if (recordError || !record)
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });
  if (!emails.includes(String(record.owner_email).toLowerCase()))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const currentPayload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as Record<string, unknown>)
      : {};

  const { error } = await account.supabase
    .from("vf_owned_records")
    .update({
      payload: { ...currentPayload, district },
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Qualidade do contato corrigida",
    detail: `${record.owner_email} · registro ${recordId} · bairro ${district}`,
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    recordIds?: number[];
    confirmation?: string;
  };
  const recordIds = [...new Set((body.recordIds ?? []).map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );

  if (!recordIds.length)
    return Response.json({ error: "Nenhum contato selecionado" }, { status: 400 });
  if (recordIds.length > MAX_BULK_DELETE)
    return Response.json(
      { error: `Selecione no máximo ${MAX_BULK_DELETE} contatos por exclusão` },
      { status: 400 },
    );
  if (body.confirmation !== "EXCLUIR CONTATOS")
    return Response.json({ error: "Confirmação inválida" }, { status: 400 });

  const emails = await visibleEmails(account);
  const { data: records, error: readError } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email")
    .eq("kind", "contact")
    .in("id", recordIds);

  if (readError) return Response.json({ error: readError.message }, { status: 400 });
  if ((records ?? []).length !== recordIds.length)
    return Response.json({ error: "Um ou mais contatos não foram encontrados" }, { status: 404 });
  if ((records ?? []).some((record) => !emails.includes(String(record.owner_email).toLowerCase())))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const { error: deleteError, count } = await account.supabase
    .from("vf_owned_records")
    .delete({ count: "exact" })
    .in("id", recordIds);

  if (deleteError)
    return Response.json({ error: deleteError.message }, { status: 400 });

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Exclusão em massa de contatos",
    detail: `${count ?? recordIds.length} contatos excluídos após confirmação explícita`,
  });

  return Response.json({ ok: true, deleted: count ?? recordIds.length });
}
