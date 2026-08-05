import { getAccount, getVisibleUsers, isAdministrator } from "../../server-identity";

const PAGE_SIZE = 50;

async function resolveScope(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  requestedOwner?: string,
) {
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

    query = scope === "all"
      ? query.in("owner_email", emails)
      : query.eq("owner_email", scope);

    if (category) query = query.eq("category", category);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return Response.json({
      scope,
      page,
      pageSize: PAGE_SIZE,
      total,
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
