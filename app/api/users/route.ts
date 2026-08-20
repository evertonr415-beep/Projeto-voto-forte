import {
  getAccount,
  getVisibleUsers,
  OWNER_EMAIL,
  type AccessRole,
} from "../../server-identity";

type UserStatus = "active" | "blocked";

type CreateAccessBody = {
  name?: string;
  email?: string;
  accessRole?: AccessRole;
  parentUserId?: number | null;
};

type UserUpdateBody = {
  id?: number;
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

function restrictAdministrationScope(
  users: Awaited<ReturnType<typeof getVisibleUsers>>,
  accountId: number,
  accountRole: AccessRole,
) {
  const realUsers = users.filter((user) => Number(user.id) > 0);
  if (accountRole !== "gestor") return realUsers;

  const visibleIds = new Set<number>([accountId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const user of realUsers) {
      const id = Number(user.id);
      const parentId = user.parent_user_id == null ? null : Number(user.parent_user_id);
      const role = accessRoleOf(user as Record<string, unknown>);
      if (
        parentId != null &&
        visibleIds.has(parentId) &&
        role !== "adm" &&
        role !== "gestor" &&
        !visibleIds.has(id)
      ) {
        visibleIds.add(id);
        changed = true;
      }
    }
  }

  return realUsers.filter((user) => visibleIds.has(Number(user.id)));
}

export async function GET() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const visibleUsers = await getVisibleUsers(account);
  // O Gestor pode receber identificadores operacionais sintéticos para ler
  // registros historicamente vinculados a um ADM. Eles nunca representam uma
  // conta real e não podem aparecer na Administração de usuários/auditoria.
  const realVisibleUsers = restrictAdministrationScope(
    visibleUsers,
    Number(account.id),
    account.accessRole,
  );
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

  const mappedUsers = realVisibleUsers.map((user) =>
    mapUser(
      user as Record<string, unknown>,
      membershipMap.get(Number(user.id)) ?? [],
    ),
  );

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
