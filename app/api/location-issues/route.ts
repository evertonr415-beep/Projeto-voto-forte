import { getAccount, getVisibleUsers, isAdministrator } from "../../server-identity";

const PAGE_SIZE = 50;
const ISSUE_CATEGORIES = [
  "rural_localidade",
  "revisao_manual",
  "sem_valor_util",
  "cidade_ou_nao_encontrado",
  "provavel_alias",
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

function applyIssueScope<T>(query: T, scope: string, emails: string[]) {
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
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  try {
    let query = account.supabase
      .from("vf_contact_location_issues")
      .select(
        "record_id,owner_email,contact_name,phone,district_original,district_key,category,suggested_district,updated_at",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false })
      .range(from, to);

    query = applyIssueScope(query, scope, emails);
    if (category) query = query.eq("category", category);

    const countResults = await Promise.all(
      ISSUE_CATEGORIES.map(async (item) => {
        let countQuery = account.supabase
          .from("vf_contact_location_issues")
          .select("record_id", { count: "exact", head: true })
          .eq("category", item);
        countQuery = applyIssueScope(countQuery, scope, emails);
        const { count, error } = await countQuery;
        if (error) throw new Error(error.message);
        return [item, count ?? 0] as const;
      }),
    );

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const categoryCounts = Object.fromEntries(countResults);
    const totalIssues = Object.values(categoryCounts).reduce(
      (sum, value) => sum + Number(value),
      0,
    );
    const total = count ?? 0;

    return Response.json({
      scope,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalIssues,
      categoryCounts,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      issues: data ?? [],
    });
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
    action: "Localização corrigida",
    detail: `${record.owner_email} · registro ${recordId} · ${district}`,
  });

  return Response.json({ ok: true });
}
