import { getAccount, getVisibleUsers, OWNER_EMAIL, type AccessRole } from "../../server-identity";

type UserStatus = "active" | "blocked";

type CreateAccessBody = {
  name?: string;
  email?: string;
  accessRole?: Exclude<AccessRole, "adm">;
  parentUserId?: number | null;
};

type UserUpdateBody = {
  id?: number;
  status?: UserStatus;
};

function accessRoleOf(user: Record<string, unknown>): AccessRole {
  const value = String(user.access_role ?? "");
  if (["adm", "master", "lideranca", "liderado", "eleitor"].includes(value)) {
    return value as AccessRole;
  }
  if (String(user.email ?? "").toLowerCase() === OWNER_EMAIL) return "adm";
  if (user.role === "master") return "master";
  if (user.role === "gestor" || user.role === "lider") return "lideranca";
  return "liderado";
}

function mapUser(user: Record<string, unknown>) {
  return {
    id: Number(user.id),
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
    role: user.role,
    accessRole: accessRoleOf(user),
    status: user.status as UserStatus,
    parentUserId: user.parent_user_id == null ? null : Number(user.parent_user_id),
    lastSeenAt: user.last_seen_at,
    createdAt: user.created_at,
  };
}

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const visibleUsers = await getVisibleUsers(account);
  const visibleAuthIds = visibleUsers.map((user) => String(user.auth_user_id)).filter(Boolean);
  const mappedUsers = visibleUsers.map((user) => mapUser(user as Record<string, unknown>));

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

  const [{ data: administrationOptions, error: optionsError }, { data: invitations, error: invitationsError }] =
    await Promise.all([
      account.supabase.rpc("vf_access_administration_options"),
      account.supabase.rpc("vf_list_user_invitations"),
    ]);

  return Response.json({
    users: mappedUsers,
    logs: mappedLogs,
    administrationOptions: optionsError ? null : administrationOptions,
    invitations: invitationsError ? [] : invitations ?? [],
    adminCount: mappedUsers.filter((user) => user.status === "active" && user.accessRole === "adm").length,
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as CreateAccessBody;
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const accessRole = body.accessRole;

  if (!name || !email || !accessRole) {
    return Response.json({ error: "Informe nome, e-mail e nível de acesso." }, { status: 400 });
  }

  const { data, error } = await account.supabase.rpc("vf_create_user_invitation", {
    p_email: email,
    p_name: name,
    p_access_role: accessRole,
    p_parent_user_id: body.parentUserId ?? null,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ invitation: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as UserUpdateBody;
  const targetId = Number(body.id);
  if (!Number.isInteger(targetId) || targetId <= 0 || !body.status) {
    return Response.json({ error: "Usuário ou status inválido." }, { status: 400 });
  }

  const { data, error } = await account.supabase.rpc("vf_set_user_status", {
    p_user_id: targetId,
    p_status: body.status,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ user: data });
}
