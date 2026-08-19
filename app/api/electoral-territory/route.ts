import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";
import {
  getHistoricalElectionData,
  getPollingPlacesForDistrict,
  ARAPONGAS_POLLING_PLACES,
} from "../../electoral-tse-data";

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

  return { scope, emails, isAdmOrGestor };
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const rawDistrict = (url.searchParams.get("district") || "").trim();
  const isAllDistricts =
    !rawDistrict ||
    rawDistrict === "Todos os Bairros" ||
    rawDistrict.toLowerCase().includes("todos os bairros") ||
    rawDistrict.toLowerCase() === "arapongas";
  const district = isAllDistricts ? "Todos os Bairros" : rawDistrict;

  const pollingPlaceId = (url.searchParams.get("pollingPlaceId") || "").trim();
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  const office = (url.searchParams.get("office") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize")) || 20));
  const searchQuery = (url.searchParams.get("q") || "").trim();

  const { scope, emails } = await resolveScope(
    account,
    url.searchParams.get("owner") ?? undefined,
  );

  const ownerEmails = scope === "all" ? emails : [scope];

  const allCollegesParam = url.searchParams.get("allColleges") === "true" || isAllDistricts;

  // 1. Carrega Colégios de Votação do TSE
  const pollingPlaces = (!isAllDistricts && !allCollegesParam)
    ? getPollingPlacesForDistrict(district)
    : ARAPONGAS_POLLING_PLACES;

  // 2. Carrega Dados Eleitorais Históricos
  const electionData = getHistoricalElectionData(
    pollingPlaceId || undefined,
    year,
    office || undefined,
  );

  // 3. Carrega Contatos Sob Demanda com Paginação e Busca
  let contacts: Array<Record<string, unknown>> = [];
  let totalContacts = 0;
  const from = (page - 1) * pageSize;

  if (!isAllDistricts) {
    try {
      const { data, error } = await account.supabase.rpc(
        "vf_contacts_for_district",
        {
          p_owner_emails: ownerEmails,
          p_district: district,
          p_profile: null,
          p_search: searchQuery || null,
          p_limit: pageSize,
          p_offset: from,
        },
      );

      if (!error && data) {
        const payload = data as {
          total?: number;
          contacts?: Array<Record<string, unknown>>;
        };
        totalContacts = Number(payload.total ?? 0);
        contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
      }
    } catch (err) {
      console.error("Falha ao carregar contatos do território", err);
    }
  } else {
    // Carrega contatos de todos os bairros
    try {
      let query = account.supabase
        .from("vf_owned_records")
        .select("id,owner_email,payload,created_at,updated_at", { count: "exact" })
        .eq("kind", "contact");

      if (scope !== "all") {
        query = query.in("owner_email", ownerEmails);
      }
      if (searchQuery) {
        query = query.ilike("payload->>name", `%${searchQuery}%`);
      }
      query = query.order("id", { ascending: false }).range(from, from + pageSize - 1);
      const { data, count, error } = await query;
      if (!error && data) {
        totalContacts = count ?? data.length;
        contacts = data.map((r: { id: number; owner_email: string; payload?: Record<string, unknown> }) => ({
          id: r.id,
          ownerEmail: r.owner_email,
          ...(r.payload || {}),
        }));
      }
    } catch (err) {
      console.error("Falha ao carregar contatos gerais de Arapongas", err);
    }
  }

  return Response.json(
    {
      district,
      scope,
      totalContacts,
      contacts,
      page,
      pageSize,
      totalPages: Math.ceil(totalContacts / pageSize) || 1,
      pollingPlaces,
      selectedPollingPlace: electionData.pollingPlace || null,
      elections: electionData.elections,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
      },
    },
  );
}
