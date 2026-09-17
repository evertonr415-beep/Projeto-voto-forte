import {
  getAccount,
  getVisibleUsers,
  OWNER_EMAIL,
  type AccessRole,
} from "../../server-identity";

type UserStatus = "active" | "blocked";

type AdministrationFeedUser = {
  id?: number;
  email?: string;
  name?: string;
  accessRole?: AccessRole;
  status?: UserStatus;
  parentUserId?: number | null;
  lastSeenAt?: string | null;
};

type CreateAccessBody = {
  name?: string;
  email?: string;
  accessRole?: AccessRole;
  parentUserId?: number | null;
};

type UserUpdateBody = {
  id?: number;
  action?: "edit" | "remove";
  name?: string;
  status?: UserStatus;
  municipalityIds?: number[];
};

function accessRoleOf(user: Record<string, unknown>): AccessRole {
  const email = String(user.email ?? "").trim().toLowerCase();
  if (email === OWNER_EMAIL.toLowerCase()) return "adm";
  if (
    email === "campanhaeleicaoxv@gmail.com" ||
    email === "threexdroid@gmail.com" ||
    email === "williammarquesmachado@gmail.com"
  )
    return "gestor";
  const value = String(user.access_role ?? "");
  if (
    ["adm", "gestor", "master", "lideranca", "liderado", "eleitor"].includes(
      value,
    )
  ) {
    return value as AccessRole;
  }
  if (user.role === "gestor") return "gestor";
  if (user.role === "master") return "master";
  if (user.role === "lider") return "lideranca";
  return "liderado";
}

function mapUser(user: Record<string, unknown>, municipalityIds: number[] = []) {
  const email = String(user.email ?? "").trim().toLowerCase();
  const isPedroLupion = email === "campanhaeleicaoxv@gmail.com";
  return {
    id: Number(user.id),
    email: String(user.email ?? ""),
    name: isPedroLupion ? "Deputado Pedro Lupion" : String(user.name ?? ""),
    role: isPedroLupion ? "gestor" : user.role,
    accessRole: accessRoleOf(user),
    status: user.status as UserStatus,
    parentUserId:
      user.parent_user_id == null ? null : Number(user.parent_user_id),
    lastSeenAt: user.last_seen_at,
    createdAt: user.created_at,
    municipalityIds,
  };
}

export async function GET() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const visibleUsers = await getVisibleUsers(account);
  const realVisibleUsers = visibleUsers.filter((user) => {
    const raw = user as unknown as Record<string, unknown>;
    return Number(user.id) > 0 && raw.deleted_at == null;
  });
  const visibleAuthIds = realVisibleUsers
    .map((user) => String(user.auth_user_id))
    .filter(Boolean);

  const membershipMap = new Map<number, number[]>();
  let municipalities: Array<{
    id: number;
    name: string;
    state: string;
    status: string;
  }> = [];

  if (account.accessRole === "adm") {
    const [{ data: memberships }, { data: municipalityData }] = await Promise.all([
      account.supabase
        .from("vf_user_municipalities")
        .select("user_id,municipality_id,status")
        .eq("status", "active"),
      account.supabase.rpc("vf_admin_municipalities"),
    ]);

    for (const membership of memberships ?? []) {
      const userId = Number(membership.user_id);
      const municipalityId = Number(membership.municipality_id);
      membershipMap.set(userId, [
        ...(membershipMap.get(userId) ?? []),
        municipalityId,
      ]);
    }

    municipalities = (Array.isArray(municipalityData) ? municipalityData : [])
      .filter((item: Record<string, unknown>) => item.status === "active")
      .map((item: Record<string, unknown>) => ({
        id: Number(item.id),
        name: String(item.name ?? ""),
        state: String(item.state ?? ""),
        status: String(item.status ?? ""),
      }));
  }

  let mappedUsers = realVisibleUsers.map((user) =>
    mapUser(
      user as unknown as Record<string, unknown>,
      membershipMap.get(Number(user.id)) ?? [],
    ),
  );

  if (account.accessRole === "gestor") {
    const { data: activityFeed, error: activityFeedError } = await account.supabase.rpc(
      "vf_administration_activity_feed",
      { p_limit: 30 },
    );

    if (!activityFeedError && activityFeed && typeof activityFeed === "object") {
      const feedUsers = Array.isArray((activityFeed as { users?: unknown[] }).users)
        ? ((activityFeed as { users: AdministrationFeedUser[] }).users ?? [])
        : [];
      const existingIds = new Set(mappedUsers.map((user) => user.id));
      const maskedAdministrativeUsers = feedUsers
        .filter((user) => {
          const id = Number(user.id);
          return Number.isInteger(id) && id > 0 && !existingIds.has(id);
        })
        .map((user) => ({
          id: Number(user.id),
          email: String(user.email ?? ""),
          name: String(user.name ?? ""),
          role: "gestor",
          accessRole: "gestor" as AccessRole,
          status: (user.status ?? "active") as UserStatus,
          parentUserId: user.parentUserId == null ? null : Number(user.parentUserId),
          lastSeenAt: user.lastSeenAt ?? null,
          createdAt: null,
          municipalityIds: [] as number[],
        }));

      mappedUsers = [...mappedUsers, ...maskedAdministrativeUsers];
    }
  }

  let logsQuery = account.supabase
    .from("vf_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(account.accessRole === "adm" ? 100 : 30);

  if (account.accessRole === "eleitor") {
    logsQuery = logsQuery.eq("actor_id", account.auth_user_id);
  } else if (account.accessRole !== "adm" && visibleAuthIds.length) {
    logsQuery = logsQuery.in("actor_id", visibleAuthIds);
  }

  const { data: logs } = await logsQuery;
  const mappedLogs = (logs ?? []).map((log: Record<string, unknown>) => ({
    id: log.id,
    actorEmail: log.actor_email,
    action: log.action,
    detail: log.detail,
    createdAt: log.created_at,
  }));

  const [
    { data: administrationOptions, error: optionsError },
    { data: invitations, error: invitationsError },
  ] = await Promise.all([
    account.supabase.rpc("vf_access_administration_options"),
    account.supabase.rpc("vf_list_user_invitations"),
  ]);

  let authAccounts: unknown[] = [];
  if (account.accessRole === "adm") {
    const { data, error } = await account.supabase.rpc(
      "vf_auth_profile_reconciliation",
    );
    if (!error && Array.isArray(data)) authAccounts = data;
  }

  return Response.json({
    users: mappedUsers,
    logs: mappedLogs,
    administrationOptions: optionsError ? null : administrationOptions,
    invitations: invitationsError ? [] : invitations ?? [],
    authAccounts,
    municipalities,
    adminCount: mappedUsers.filter(
      (user) => user.status === "active" && user.accessRole === "adm",
    ).length,
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as CreateAccessBody;
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const accessRole = body.accessRole;

  if (!name || !email || !accessRole) {
    return Response.json(
      { error: "Informe nome, e-mail e nível de acesso." },
      { status: 400 },
    );
  }

  const { data, error } = await account.supabase.rpc(
    "vf_create_user_invitation",
    {
      p_email: email,
      p_name: name,
      p_access_role: accessRole,
      p_parent_user_id: body.parentUserId ?? null,
    },
  );

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ invitation: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as UserUpdateBody;
  const targetId = Number(body.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return Response.json({ error: "Usuário inválido." }, { status: 400 });
  }

  if (body.action === "edit") {
    const name = body.name?.trim() ?? "";
    if (!name) {
      return Response.json({ error: "Informe o nome." }, { status: 400 });
    }
    const { data, error } = await account.supabase.rpc("vf_update_user_admin", {
      p_user_id: targetId,
      p_name: name,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ user: data });
  }

  if (body.action === "remove") {
    const { data, error } = await account.supabase.rpc("vf_remove_user_access", {
      p_user_id: targetId,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ user: data });
  }

  if (Array.isArray(body.municipalityIds)) {
    if (account.accessRole !== "adm") {
      return Response.json(
        { error: "Somente o ADM pode definir municípios de um Gestor." },
        { status: 403 },
      );
    }

    const municipalityIds = Array.from(
      new Set(
        body.municipalityIds
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    if (!municipalityIds.length) {
      return Response.json(
        { error: "Selecione pelo menos um município." },
        { status: 400 },
      );
    }

    const { data, error } = await account.supabase.rpc(
      "vf_set_gestor_municipalities",
      {
        p_user_id: targetId,
        p_municipality_ids: municipalityIds,
      },
    );
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ user: data });
  }

  if (!body.status) {
    return Response.json({ error: "Status inválido." }, { status: 400 });
  }

  const { data, error } = await account.supabase.rpc("vf_set_user_status", {
    p_user_id: targetId,
    p_status: body.status,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ user: data });
}
