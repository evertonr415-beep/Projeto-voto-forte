import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

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

type DistrictContactsPayload = {
  district?: string;
  total?: number;
  contacts?: Array<ContactPayload & {
    id: number;
    ownerEmail: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

type DistrictSummaryItem = {
  district?: string;
  total?: number | string;
};

type MapScopeStatsRow = {
  total_contacts?: number | string;
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

function scopeTotal(data: unknown) {
  const row = Array.isArray(data)
    ? (data[0] as MapScopeStatsRow | undefined)
    : undefined;
  return Math.max(0, Number(row?.total_contacts ?? 0));
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
      const ownerEmails = scope === "all" ? emails : [scope];
      let meetingsQuery = account.supabase
        .from("vf_owned_records")
        .select("id", { count: "exact", head: true })
        .eq("kind", "meeting");
      meetingsQuery = applyScope(meetingsQuery, scope, emails);

      const [totalResult, voterResult, leaderResult, districtResult, meetingsResult] =
        await Promise.all([
          account.supabase.rpc("vf_map_scope_stats", {
            p_owner_emails: ownerEmails,
            p_profile: null,
          }),
          account.supabase.rpc("vf_map_scope_stats", {
            p_owner_emails: ownerEmails,
            p_profile: "Eleitor",
          }),
          account.supabase.rpc("vf_map_scope_stats", {
            p_owner_emails: ownerEmails,
            p_profile: "Liderança",
          }),
          account.supabase.rpc("vf_map_district_summary", {
            p_owner_emails: ownerEmails,
          }),
          meetingsQuery,
        ]);

      if (totalResult.error) throw new Error(totalResult.error.message);
      if (voterResult.error) throw new Error(voterResult.error.message);
      if (leaderResult.error) throw new Error(leaderResult.error.message);
      if (districtResult.error) throw new Error(districtResult.error.message);
      if (meetingsResult.error) throw new Error(meetingsResult.error.message);

      const districts = (Array.isArray(districtResult.data)
        ? (districtResult.data as DistrictSummaryItem[])
        : []
      )
        .map((item) => ({
          district: String(item.district || "").trim(),
          total: Math.max(0, Number(item.total || 0)),
        }))
        .filter((item) => item.district)
        .sort((left, right) => {
          const leftRural = left.district === "Zona rural" ? 0 : 1;
          const rightRural = right.district === "Zona rural" ? 0 : 1;
          if (leftRural !== rightRural) return leftRural - rightRural;
          if ((left.total > 0) !== (right.total > 0))
            return left.total > 0 ? -1 : 1;
          return (
            right.total - left.total ||
            left.district.localeCompare(right.district, "pt-BR")
          );
        });

      const ruralContacts =
        districts.find((item) => item.district === "Zona rural")?.total ?? 0;
      const districtsReached = districts.filter(
        (item) => item.district !== "Zona rural" && item.total > 0,
      ).length;

      return Response.json(
        {
          scope,
          total: scopeTotal(totalResult.data),
          voters: scopeTotal(voterResult.data),
          leaders: scopeTotal(leaderResult.data),
          meetings: meetingsResult.count ?? 0,
          ruralContacts,
          districtsReached,
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
    const district = (url.searchParams.get("district") ?? "").trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (district) {
      const ownerEmails = scope === "all" ? emails : [scope];
      const { data, error } = await account.supabase.rpc(
        "vf_contacts_for_district",
        {
          p_owner_emails: ownerEmails,
          p_district: district,
          p_profile:
            profile === "Eleitor" || profile === "Liderança" ? profile : null,
          p_search: queryText || null,
          p_limit: pageSize,
          p_offset: from,
        },
      );
      if (error) throw new Error(error.message);
      const payload = (data ?? {}) as DistrictContactsPayload;
      const total = Number(payload.total ?? 0);

      return Response.json(
        {
          scope,
          page,
          pageSize,
          district: String(payload.district || district),
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          contacts: Array.isArray(payload.contacts) ? payload.contacts : [],
        },
        {
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
          },
        },
      );
    }

    const hasFilters = Boolean(
      queryText || profile === "Eleitor" || profile === "Liderança",
    );

    let query = account.supabase
      .from("vf_owned_records")
      .select(
        "id,owner_email,payload,created_at,updated_at",
        hasFilters ? { count: "exact" } : undefined,
      )
      .eq("kind", "contact")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
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

    const pagePromise = query;
    const totalPromise: Promise<number | null> = hasFilters
      ? Promise.resolve(null)
      : (async () => {
          const result = await account.supabase.rpc("vf_map_scope_stats", {
            p_owner_emails: scope === "all" ? emails : [scope],
            p_profile: null,
          });
          if (result.error) throw new Error(result.error.message);
          return scopeTotal(result.data);
        })();

    const [{ data, count, error }, cachedTotal] = await Promise.all([
      pagePromise,
      totalPromise,
    ]);

    if (error) throw new Error(error.message);
    const total = hasFilters ? count ?? 0 : cachedTotal ?? 0;

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
