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

  const isAdmOrGestor =
    account.accessRole === "adm" ||
    account.accessRole === "gestor" ||
    isAdministrator(account.role);

  const requested = requestedOwner?.trim().toLowerCase();
  let scope = isAdmOrGestor ? "all" : account.email;
  if (requested === "all" && isAdmOrGestor) scope = "all";
  else if (requested && emails.includes(requested)) scope = requested;
  else if (requested && requested !== account.email && !isAdmOrGestor)
    return {
      error: Response.json(
        { error: "Você não possui acesso a este ambiente" },
        { status: 403 },
      ),
    };

  return { scope, emails, isAdmOrGestor };
}

function applyScope<T>(query: T, scope: string, emails: string[], isAdmOrGestor: boolean) {
  const scoped = query as T & {
    eq: (column: string, value: string) => T;
    in: (column: string, values: string[]) => T;
  };
  if (scope === "all") {
    return isAdmOrGestor ? query : scoped.in("owner_email", emails);
  }
  return scoped.eq("owner_email", scope);
}

async function countOwnedRecords(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  scope: string,
  emails: string[],
  isAdmOrGestor: boolean,
  kind: "contact" | "meeting",
  profile?: "Eleitor" | "Liderança",
) {
  let query = account.supabase
    .from("vf_owned_records")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind);

  query = applyScope(query, scope, emails, isAdmOrGestor);
  if (profile) query = query.eq("payload->>kind", profile);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
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
  const { scope, emails, isAdmOrGestor } = resolved;

  const mode = url.searchParams.get("mode") ?? "page";

  try {
    if (mode === "summary") {
      const ownerEmails = scope === "all" ? emails : [scope];
      let summaryResult: Record<string, unknown> | null = null;

      try {
        const { data, error } = await account.supabase.rpc(
          "vf_contact_dashboard_summary",
          { p_owner_emails: ownerEmails },
        );
        if (!error && data) {
          summaryResult = data as Record<string, unknown>;
        }
      } catch {
        // Fallback dinâmico abaixo.
      }

      if (!summaryResult) {
        let districtsList: Array<{ district: string; total: number }> = [];

        try {
          const { data: districtRows } = await account.supabase.rpc(
            "vf_map_district_summary",
            { p_owner_emails: ownerEmails },
          );
          if (Array.isArray(districtRows) && districtRows.length > 0) {
            districtsList = districtRows
              .map((r: Record<string, unknown>) => ({
                district: String(r.district || "").trim(),
                total: Number(r.total || 0),
              }))
              .filter((d) => d.district && d.total > 0)
              .sort((a, b) => b.total - a.total);
          }
        } catch {
          // Fallback para a tabela de resumo territorial.
        }

        if (!districtsList.length) {
          try {
            const { data: cachedRows } = await account.supabase
              .from("vf_arapongas_district_summary")
              .select("district_name, total")
              .in("owner_email", ownerEmails);

            if (Array.isArray(cachedRows) && cachedRows.length > 0) {
              const map = new Map<string, number>();
              for (const row of cachedRows) {
                const name = String(row.district_name || "").trim();
                const tot = Number(row.total || 0);
                if (name) map.set(name, (map.get(name) || 0) + tot);
              }
              districtsList = Array.from(map.entries())
                .map(([district, total]) => ({ district, total }))
                .filter((d) => d.total > 0)
                .sort((a, b) => b.total - a.total);
            }
          } catch {
            // O resumo de contatos ainda será calculado diretamente.
          }
        }

        const [total, voters, leaders, meetings] = await Promise.all([
          countOwnedRecords(account, scope, emails, isAdmOrGestor, "contact"),
          countOwnedRecords(
            account,
            scope,
            emails,
            isAdmOrGestor,
            "contact",
            "Eleitor",
          ),
          countOwnedRecords(
            account,
            scope,
            emails,
            isAdmOrGestor,
            "contact",
            "Liderança",
          ),
          countOwnedRecords(account, scope, emails, isAdmOrGestor, "meeting"),
        ]);

        summaryResult = {
          total,
          voters,
          leaders,
          meetings,
          districtsReached: districtsList.filter((district) => district.total > 0).length,
          districts: districtsList,
        };
      }

      return Response.json(
        { scope, ...summaryResult },
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
      let districtContacts: Array<Record<string, unknown>> = [];
      let total = 0;

      try {
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
        if (!error && data) {
          const payload = data as DistrictContactsPayload;
          total = Number(payload.total ?? 0);
          districtContacts = Array.isArray(payload.contacts) ? payload.contacts : [];
        }
      } catch {
        // Fallback
      }

      if (!districtContacts.length && total === 0) {
        let query = account.supabase
          .from("vf_owned_records")
          .select("id,owner_email,payload,created_at,updated_at", { count: "exact" })
          .eq("kind", "contact");

        if (district.toLowerCase() === "zona rural" || district.toLowerCase() === "rural") {
          query = query.ilike("payload->>district", "%rural%");
        } else {
          query = query.eq("payload->>district", district);
        }

        if (profile === "Eleitor" || profile === "Liderança") {
          query = query.eq("payload->>kind", profile);
        }

        if (queryText) {
          query = query.or(
            `payload->>name.ilike.%${queryText}%,payload->>phone.ilike.%${queryText}%`,
          );
        }

        query = query.order("id", { ascending: false }).range(from, to);
        const { data: fallbackRows, count: fallbackCount } = await query;

        if (Array.isArray(fallbackRows)) {
          districtContacts = fallbackRows.map(mapContact);
          total = fallbackCount ?? 0;
        }
      }

      return Response.json(
        {
          scope,
          page,
          pageSize,
          district,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          contacts: districtContacts,
        },
        {
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
          },
        },
      );
    }

    let query = account.supabase
      .from("vf_owned_records")
      .select("id,owner_email,payload,created_at,updated_at", { count: "exact" })
      .eq("kind", "contact")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    query = applyScope(query, scope, emails, isAdmOrGestor);

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
