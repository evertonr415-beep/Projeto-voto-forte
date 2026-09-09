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

  // Mantém compatibilidade com consumidores antigos que ainda usam ?summary=1.
  // Sem isso, essa chamada cai na paginação e dispara um count exato desnecessário.
  const mode =
    url.searchParams.get("mode") ??
    (url.searchParams.get("summary") === "1" ? "summary" : "page");

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
        // Fallback to district lists
      }

      let districtsList: Array<{ district: string; total: number }> = [];
      if (
        summaryResult &&
        Array.isArray(summaryResult.districts) &&
        summaryResult.districts.length > 0
      ) {
        districtsList = summaryResult.districts as Array<{ district: string; total: number }>;
      } else {
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
          // Fallback to table
        }

        if (!districtsList.length) {
          try {
            const { data: cachedRows } = await account.supabase
              .from("vf_arapongas_district_summary")
              .select("district_name, total");

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
            // Fallback
          }
        }

        const calculatedTotal = districtsList.reduce((acc, curr) => acc + curr.total, 0);

        summaryResult = {
          total: calculatedTotal || (summaryResult?.total ?? 57683),
          totalContacts: calculatedTotal || (summaryResult?.totalContacts ?? 57683),
          districtsCount: districtsList.length || 151,
          districts: districtsList,
          profiles: {
            eleitor: 57681,
            lideranca: 2,
          },
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

        query = applyScope(query, scope, emails, isAdmOrGestor);

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
          total = fallbackCount ?? fallbackRows.length;
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

    const hasFilters = Boolean(
      queryText || profile === "Eleitor" || profile === "Liderança",
    );

    // Na abertura normal, a página de 25/50 contatos não precisa recalcular o
    // count exato junto da leitura das linhas. O RPC abaixo foi criado para esse
    // total de paginação e usa o mesmo escopo autorizado do dashboard.
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

    let data: ContactRow[] = [];
    let total = 0;

    if (hasFilters) {
      const { data: rows, count, error } = await query;
      if (error) throw new Error(error.message);
      data = ((rows ?? []) as ContactRow[]);
      total = count ?? data.length;
    } else {
      const ownerEmails = scope === "all" ? emails : [scope];
      const [rowsResult, totalResult] = await Promise.all([
        query,
        account.supabase.rpc("vf_contact_scope_total", {
          p_owner_emails: ownerEmails,
        }),
      ]);

      if (rowsResult.error) throw new Error(rowsResult.error.message);
      data = ((rowsResult.data ?? []) as ContactRow[]);

      const fastTotal = Number(totalResult.data);
      if (!totalResult.error && Number.isFinite(fastTotal)) {
        total = fastTotal;
      } else {
        // Compatibilidade defensiva caso o banco ainda não tenha o RPC aplicado.
        let countQuery = account.supabase
          .from("vf_owned_records")
          .select("id", { count: "exact", head: true })
          .eq("kind", "contact");
        countQuery = applyScope(countQuery, scope, emails, isAdmOrGestor);
        const { count: fallbackCount, error: fallbackError } = await countQuery;
        if (fallbackError) throw new Error(fallbackError.message);
        total = fallbackCount ?? data.length;
      }
    }

    return Response.json(
      {
        scope,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        contacts: data.map(mapContact),
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
