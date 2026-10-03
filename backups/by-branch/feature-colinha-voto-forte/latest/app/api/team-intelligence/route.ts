import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
  type HierarchyUser,
} from "../../server-identity";

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

type ContactMetricRow = {
  owner_email: string;
  total_contacts: number | string | null;
  voter_contacts: number | string | null;
  contacts_last_7_days: number | string | null;
  contacts_last_30_days: number | string | null;
  voters_last_7_days: number | string | null;
  last_voter_created_at: string | null;
};

type ContactMetric = {
  totalContacts: number;
  voterContacts: number;
  votersLast7Days: number;
  lastVoterCreatedAt: string | null;
};

type UserMetricRow = {
  owner_email: string;
  manual_created_contacts: number | string | null;
  imported_contacts: number | string | null;
  updated_contacts: number | string | null;
  operational_pending_contacts: number | string | null;
  system_pending_contacts: number | string | null;
};

type UserMetric = {
  manualCreatedContacts: number;
  importedContacts: number;
  updatedContacts: number;
  operationalPendingContacts: number;
};

const EMPTY_CONTACT_METRIC: ContactMetric = {
  totalContacts: 0,
  voterContacts: 0,
  votersLast7Days: 0,
  lastVoterCreatedAt: null,
};

const EMPTY_USER_METRIC: UserMetric = {
  manualCreatedContacts: 0,
  importedContacts: 0,
  updatedContacts: 0,
  operationalPendingContacts: 0,
};

async function buildUserMetric(
  account: Account,
  user: HierarchyUser,
  contactMetrics: ReadonlyMap<string, ContactMetric>,
  userMetrics: ReadonlyMap<string, UserMetric>,
) {
  const actorId = String(user.auth_user_id);
  const ownerEmail = String(user.email).trim().toLowerCase();
  const contactMetric = contactMetrics.get(ownerEmail) ?? EMPTY_CONTACT_METRIC;
  const userMetric = userMetrics.get(ownerEmail) ?? EMPTY_USER_METRIC;

  const recentResult = await account.supabase
    .from("vf_audit_logs")
    .select("action,detail,created_at")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false })
    .limit(10);

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

  return {
    id: Number(user.id),
    name: String(user.name),
    email: ownerEmail,
    role: user.role,
    status: user.status,
    lastSeenAt: user.last_seen_at ?? null,
    createdContacts:
      userMetric.manualCreatedContacts + userMetric.importedContacts,
    manualCreatedContacts: userMetric.manualCreatedContacts,
    importedContacts: userMetric.importedContacts,
    updatedContacts: userMetric.updatedContacts,
    totalContacts: contactMetric.totalContacts,
    voterContacts: contactMetric.voterContacts,
    votersLast7Days: contactMetric.votersLast7Days,
    lastVoterCreatedAt: contactMetric.lastVoterCreatedAt,
    pendingContacts: userMetric.operationalPendingContacts,
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
    const [visibleUsers, contactMetricsResult, userMetricsResult] = await Promise.all([
      getVisibleUsers(account),
      account.supabase.rpc("vf_intelligence_contact_metrics"),
      account.supabase.rpc("vf_intelligence_user_metrics"),
    ]);

    if (contactMetricsResult.error) throw new Error(contactMetricsResult.error.message);
    if (userMetricsResult.error) throw new Error(userMetricsResult.error.message);

    const contactMetrics = new Map<string, ContactMetric>();
    for (const rawRow of (contactMetricsResult.data ?? []) as ContactMetricRow[]) {
      const ownerEmail = String(rawRow.owner_email ?? "").trim().toLowerCase();
      if (!ownerEmail) continue;
      contactMetrics.set(ownerEmail, {
        totalContacts: Number(rawRow.total_contacts ?? 0),
        voterContacts: Number(rawRow.voter_contacts ?? 0),
        votersLast7Days: Number(rawRow.voters_last_7_days ?? 0),
        lastVoterCreatedAt: rawRow.last_voter_created_at ?? null,
      });
    }

    const userMetrics = new Map<string, UserMetric>();
    for (const rawRow of (userMetricsResult.data ?? []) as UserMetricRow[]) {
      const ownerEmail = String(rawRow.owner_email ?? "").trim().toLowerCase();
      if (!ownerEmail) continue;
      userMetrics.set(ownerEmail, {
        manualCreatedContacts: Number(rawRow.manual_created_contacts ?? 0),
        importedContacts: Number(rawRow.imported_contacts ?? 0),
        updatedContacts: Number(rawRow.updated_contacts ?? 0),
        operationalPendingContacts: Number(
          rawRow.operational_pending_contacts ?? 0,
        ),
      });
    }

    const users: Awaited<ReturnType<typeof buildUserMetric>>[] = [];
    const batchSize = 8;
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    for (let index = 0; index < visibleUsers.length; index += batchSize) {
      const batch = await Promise.all(
        visibleUsers
          .slice(index, index + batchSize)
          .map((user) =>
            buildUserMetric(account, user, contactMetrics, userMetrics),
          ),
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
