import {
  canCreateRole,
  canManageUser,
  getAccount,
  getVisibleUsers,
  isAdministrator,
  OWNER_EMAIL,
  type UserRole,
} from "../../server-identity";

type UserStatus = "active" | "blocked";

type UserUpdateBody = {
  id?: number;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  parentUserId?: number | null;
};

function mapUser(user: Record<string, unknown>) {
  return {
    id: Number(user.id),
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
    role: user.role as UserRole,
    status: user.status as UserStatus,
    parentUserId:
      user.parent_user_id == null ? null : Number(user.parent_user_id),
    lastSeenAt: user.last_seen_at,
    createdAt: user.created_at,
  };
}

export async function GET() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const visibleUsers = await getVisibleUsers(account);
  const visibleIds = new Set(visibleUsers.map((user) => String(user.auth_user_id)));

  let logsQuery = account.supabase
    .from("vf_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(isAdministrator(account.role) ? 100 : 30);

  if (account.role === "liderado") {
    logsQuery = logsQuery.eq("actor_id", account.auth_user_id);
  } else if (account.role !== "master") {
    logsQuery = logsQuery.in("actor_id", Array.from(visibleIds));
  }

  const { data: logs } = await logsQuery;
  const mappedUsers = visibleUsers.map((user) =>
    mapUser(user as Record<string, unknown>),
  );
  const mappedLogs = (logs ?? []).map((log: Record<string, unknown>) => ({
    id: log.id,
    actorEmail: log.actor_email,
    action: log.action,
    detail: log.detail,
    createdAt: log.created_at,
  }));

  return Response.json({
    users: mappedUsers,
    logs: mappedLogs,
    hierarchy: {
      currentUserId: Number(account.id),
      currentRole: account.role,
      masterCount: mappedUsers.filter(
        (user) => user.status === "active" && user.role === "master",
      ).length,
      canCreate: {
        master: canCreateRole(account.role, "master"),
        gestor: canCreateRole(account.role, "gestor"),
        lider: canCreateRole(account.role, "lider"),
        liderado: canCreateRole(account.role, "liderado"),
      },
    },
    adminCount: mappedUsers.filter(
      (user) =>
        user.status === "active" &&
        ["master", "gestor", "lider"].includes(user.role),
    ).length,
  });
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account || !isAdministrator(account.role))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await request.json()) as UserUpdateBody;
  const email = body.email?.trim().toLowerCase() ?? "";
  const targetId = Number(body.id);

  let targetQuery = account.supabase
    .from("vf_users")
    .select("*")
    .limit(1);
  if (Number.isInteger(targetId) && targetId > 0)
    targetQuery = targetQuery.eq("id", targetId);
  else if (email) targetQuery = targetQuery.eq("email", email);
  else
    return Response.json({ error: "Usuário inválido" }, { status: 400 });

  const { data: target } = await targetQuery.maybeSingle();
  if (!target)
    return Response.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (target.email === OWNER_EMAIL || Number(target.id) === Number(account.id))
    return Response.json({ error: "Alteração inválida" }, { status: 409 });
  if (!(await canManageUser(account, Number(target.id))))
    return Response.json(
      { error: "Você não pode gerenciar este usuário" },
      { status: 403 },
    );

  const nextRole = body.role ?? (target.role as UserRole);
  if (body.role && !canCreateRole(account.role, nextRole))
    return Response.json(
      { error: "Seu nível não pode atribuir essa função" },
      { status: 403 },
    );

  let parentUserId =
    body.parentUserId === undefined
      ? target.parent_user_id
      : body.parentUserId;

  if (nextRole === "master") {
    if (account.role !== "master")
      return Response.json(
        { error: "Somente Master pode promover outro Master" },
        { status: 403 },
      );
    parentUserId = null;
  } else {
    if (!parentUserId)
      return Response.json(
        { error: "Selecione o superior hierárquico" },
        { status: 400 },
      );

    const visible = await getVisibleUsers(account);
    const parent = visible.find(
      (user) => Number(user.id) === Number(parentUserId),
    );
    if (!parent)
      return Response.json(
        { error: "Superior hierárquico inválido" },
        { status: 403 },
      );

    const allowedParentRoles: Record<Exclude<UserRole, "master">, UserRole[]> = {
      gestor: ["master"],
      lider: ["master", "gestor"],
      liderado: ["master", "gestor", "lider"],
    };
    if (!allowedParentRoles[nextRole].includes(parent.role as UserRole))
      return Response.json(
        { error: "O superior selecionado não é compatível com essa função" },
        { status: 400 },
      );
  }

  const changes: Record<string, unknown> = {};
  if (body.role) changes.role = nextRole;
  if (body.status) changes.status = body.status;
  if (body.parentUserId !== undefined || body.role)
    changes.parent_user_id = parentUserId;

  if (!Object.keys(changes).length)
    return Response.json({ error: "Nenhuma alteração informada" }, { status: 400 });

  const { error } = await account.supabase
    .from("vf_users")
    .update(changes)
    .eq("id", target.id);

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Hierarquia de usuário atualizada",
    detail: `${target.email} · ${nextRole}`,
  });

  return Response.json({ ok: true });
}

export async function POST() {
  return Response.json(
    {
      error:
        "O usuário deve criar a conta na tela de acesso. Depois, um superior autorizado define sua função e vínculo hierárquico.",
    },
    { status: 400 },
  );
}
