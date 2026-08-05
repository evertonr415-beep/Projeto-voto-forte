import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const SUMMARY_PAGE_SIZE = 1000;

type ContactPayload = {
  name?: string;
  phone?: string;
  phoneNormalized?: string;
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
};

type ContactRow = {
  id: number;
  owner_email: string;
  payload: ContactPayload | null;
  created_at: string;
  updated_at: string;
};

function mapContact(row: ContactRow) {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    ...(row.payload ?? {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeSearch(value: string) {
  return value
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

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

async function exactCount(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  scope: string,
  emails: string[],
  profile?: "Eleitor" | "Liderança",
) {
  let query = account.supabase
    .from("vf_owned_records")
    .select("id", { count: "exact", head: true })
    .eq("kind", "contact");
  query = applyScope(query, scope, emails);
  if (profile) query = query.eq("payload->>kind", profile);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function meetingCount(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  scope: string,
  emails: string[],
) {
  let query = account.supabase
    .from("vf_owned_records")
    .select("id", { count: "exact", head: true })
    .eq("kind", "meeting");
  query = applyScope(query, scope, emails);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function districtSummary(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  scope: string,
  emails: string[],
) {
  const counts = new Map<string, number>();

  for (let from = 0; ; from += SUMMARY_PAGE_SIZE) {
    let query = account.supabase
      .from("vf_owned_records")
      .select("payload")
      .eq("kind", "contact")
      .range(from, from + SUMMARY_PAGE_SIZE - 1);
    query = applyScope(query, scope, emails);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as { payload: ContactPayload | null }[];
    for (const row of page) {
      const district = String(row.payload?.district ?? "").trim();
      if (!district) continue;
      counts.set(district, (counts.get(district) ?? 0) + 1);
    }
    if (page.length < SUMMARY_PAGE_SIZE) break;
  }

  return [...counts.entries()]
    .map(([district, total]) => ({ district, total }))
    .sort((a, b) => b.total - a.total || a.district.localeCompare(b.district));
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const resolved = await resolveScope(
    account,
    url.searchParams.get("owner") ?? undefined,
  );
  if ("error" in resolved) return resolved.error;
  const { scope, emails } = resolved;

  const mode = url.searchParams.get("mode") ?? "page";

  try {
    if (mode === "summary") {
      const [total, voters, leaders, meetings, districts] = await Promise.all([
        exactCount(account, scope, emails),
        exactCount(account, scope, emails, "Eleitor"),
        exactCount(account, scope, emails, "Liderança"),
        meetingCount(account, scope, emails),
        districtSummary(account, scope, emails),
      ]);

      return Response.json(
        {
          scope,
          total,
          voters,
          leaders,
          meetings,
          districtsReached: districts.length,
          districts,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
          },
        },
      );
    }

    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(10, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE),
    );
    const queryText = safeSearch(url.searchParams.get("q") ?? "");
    const profile = url.searchParams.get("profile");
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = account.supabase
      .from("vf_owned_records")
      .select("id,owner_email,payload,created_at,updated_at", {
        count: "exact",
      })
      .eq("kind", "contact")
      .order("updated_at", { ascending: false })
      .range(from, to);

    query = applyScope(query, scope, emails);

    if (profile === "Eleitor" || profile === "Liderança")
      query = query.eq("payload->>kind", profile);

    if (queryText) {
      const digits = queryText.replace(/\D/g, "");
      const terms = [
        `payload->>name.ilike.%${queryText}%`,
        `payload->>district.ilike.%${queryText}%`,
        `payload->>leader.ilike.%${queryText}%`,
        `owner_email.ilike.%${queryText}%`,
      ];
      if (digits) {
        terms.push(`payload->>phone.ilike.%${digits}%`);
        terms.push(`payload->>phoneNormalized.ilike.%${digits}%`);
      }
      query = query.or(terms.join(","));
    }

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);
    const total = count ?? 0;

    return Response.json(
      {
        scope,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        contacts: ((data ?? []) as ContactRow[]).map(mapContact),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os contatos",
      },
      { status: 400 },
    );
  }
}
