import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
  type HierarchyUser,
} from "../../server-identity";

const OPERATIONAL_ISSUE_CATEGORIES = [
  "invalid_phone",
  "missing_name",
  "incomplete_name",
  "missing_district",
  "missing_street",
  "location_divergence",
  "rural_location",
] as const;

const UPDATE_ACTIONS = [
  "Contato editado",
  "Cadastro essencial do contato corrigido",
] as const;

const IMPORT_ACTIONS = [
  "Importação inteligente de contatos",
  "Importação de contatos em lote",
] as const;

const NON_OPERATIONAL_ACTIONS = new Set([
  "Acesso ao sistema",
  "Navegação",
]);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Account = NonNullable<Awaited<ReturnType<typeof getAccount>>>;

type AuditRow = {
  action: string;
  detail: string;
  created_at: string;
};

function parseImportedContacts(detail: unknown) {
  const match = String(detail ?? "").match(/([\d.]+)\s+inseridos/i);
  if (!match) return 0;
  return Number(match[1].replace(/\D/g, "")) || 0;
}

async function countAuditActions(
  account: Account,
  actorId: string,
  actions: readonly string[],
) {
  let query = account.supabase
    .from("vf_audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", actorId);

  query =
    actions.length === 1
      ? query.eq("action", actions[0])
      : query.in("action", [...actions]);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countImportedContacts(account: Account, actorId: string) {
  const pageSize = 1000;
  const maxRows = 20_000;
  let total = 0;

  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await account.supabase
      .from("vf_audit_logs")
      .select("detail")
      .eq("actor_id", actorId)
      .in("action", [...IMPORT_ACTIONS])
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) total += parseImportedContacts(row.detail);
    if (rows.length < pageSize) break;
  }

  return total;
}

async function buildUserMetric(
  account: Account,
  user: HierarchyUser,
  sevenDaysAgo: string,
) {
  const actorId = String(user.auth_user_id);
  const ownerEmail = String(user.email).trim().toLowerCase();

  const [
    manualCreatedContacts,
    importedContacts,
    updatedContacts,
    contactCountResult,
    voterBaseResult,
    recentVoterResult,
    pendingCountResult,
    recentResult,
  ] = await Promise.all([
    countAuditActions(account, actorId, ["Cadastro criado"]),
    countImportedContacts(account, actorId),
    countAuditActions(account, actorId, UPDATE_ACTIONS),
    account.supabase
      .from("vf_owned_records")
      .select("id", { count: "exact", head: true })
      .eq("kind", "contact")
      .eq("owner_email", ownerEmail),
    account.supabase
      .from("vf_owned_records")
      .select("created_at", { count: "exact" })
      .eq("kind", "contact")
      .eq("owner_email", ownerEmail)
      .eq("payload->>kind", "Eleitor")
      .order("created_at", { ascending: false })
      .limit(1),
    account.supabase
      .from("vf_owned_records")
      .select("id", { count: "exact", head: true })
      .eq("kind", "contact")
      .eq("owner_email", ownerEmail)
      .eq("payload->>kind", "Eleitor")
      .gte("created_at", sevenDaysAgo),
    account.supabase
      .from("vf_contact_quality")
      .select("record_id", { count: "exact", head: true })
      .eq("owner_email", ownerEmail)
      .overlaps("issue_codes", [...OPERATIONAL_ISSUE_CATEGORIES]),
    account.supabase
      .from("vf_audit_logs")
      .select("action,detail,created_at")
      .eq("actor_id", actorId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (contactCountResult.error) throw new Error(contactCountResult.error.message);
  if (voterBaseResult.error) throw new Error(voterBaseResult.error.message);
  if (recentVoterResult.error) throw new Error(recentVoterResult.error.message);
  if (pendingCountResult.error) throw new Error(pendingCountResult.error.message);
  if (recentResult.error) throw new Error(recentResult.error.message);

  const recentActions = ((recentResult.data ?? []) as AuditRow[]).map((item) => ({
    action: item.action,
    detail: item.detail,
    createdAt: item.created_at,
  }));
  const lastAction =
    recentActions.find((item) => !NON_OPERATIONAL_ACTIONS.has(item.action)) ??
    recentActions[0] ??
    null;
  const lastVoterRow = (voterBaseResult.data?.[0] ?? null) as {
    created_at?: string | null;
  } | null;

  return {
    id: Number(user.id),
    name: String(user.name),
    email: ownerEmail,
    role: user.role,
    status: user.status,
    lastSeenAt: user.last_seen_at ?? null,
    createdContacts: manualCreatedContacts + importedContacts,
    manualCreatedContacts,
    importedContacts,
    updatedContacts,
    totalContacts: contactCountResult.count ?? 0,
    voterContacts: voterBaseResult.count ?? 0,
    votersLast7Days: recentVoterResult.count ?? 0,
    lastVoterCreatedAt: lastVoterRow?.created_at ?? null,
    pendingContacts: pendingCountResult.count ?? 0,
    lastAction,
    recentActions,
  };
}

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdministrator(account.role))
    return Response.json(
      { error: "A inteligência da equipe está disponível apenas para níveis de gestão." },
      { status: 403 },
    );

  try {
    const visibleUsers = await getVisibleUsers(account);
    const users: Awaited<ReturnType<typeof buildUserMetric>>[] = [];
    const batchSize = 8;
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    for (let index = 0; index < visibleUsers.length; index += batchSize) {
      const batch = await Promise.all(
        visibleUsers
          .slice(index, index + batchSize)
          .map((user) => buildUserMetric(account, user, sevenDaysAgo)),
      );
      users.push(...batch);
    }

    users.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const summary = users.reduce(
      (result, user) => ({
        users: result.users + 1,
        createdContacts: result.createdContacts + user.createdContacts,
        updatedContacts: result.updatedContacts + user.updatedContacts,
        pendingContacts: result.pendingContacts + user.pendingContacts,
        voterContacts: result.voterContacts + user.voterContacts,
        votersLast7Days: result.votersLast7Days + user.votersLast7Days,
        leaders:
          result.leaders +
          Number(user.status === "active" && user.role === "lider"),
        leadersWithoutRecentVoters:
          result.leadersWithoutRecentVoters +
          Number(
            user.status === "active" &&
              user.role === "lider" &&
              user.votersLast7Days === 0,
          ),
      }),
      {
        users: 0,
        createdContacts: 0,
        updatedContacts: 0,
        pendingContacts: 0,
        voterContacts: 0,
        votersLast7Days: 0,
        leaders: 0,
        leadersWithoutRecentVoters: 0,
      },
    );

    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        period: { sevenDaysAgo },
        summary,
        users,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Failed to load team intelligence", error);
    return Response.json(
      { error: "Não foi possível carregar a inteligência da equipe agora." },
      { status: 400 },
    );
  }
}
