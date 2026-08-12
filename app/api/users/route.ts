import {
  canManageHierarchy,
  getAccount,
  getVisibleUsers,
  type UserRole,
} from "../../server-identity";

type UserStatus = "active" | "blocked";

type UserUpdateBody = {
  id?: number;
  status?: UserStatus;
};

type InviteBody = {
  email?: string;
  name?: string;
  accessRole?: UserRole;
  parentUserId?: number | null;
};

function mapUser(user: Record<string, unknown>) {
  return {
    id: Number(user.id),
    email: String(user.email ?? ""),
    name: String(user.name ?? ""),
    role: user.access_role as UserRole,
    accessRole: user.access_role as UserRole,
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
  const mappedUsers = visibleUsers.map((user) =>
    mapUser(user as unknown as Record<string, unknown>),
  );

  const { data: invitations } = canManageHierarchy(account.role)
    ? await account.supabase.rpc("vf_list_user_invitations")
    : { data: [] };

  return Response.json({
    users: mappedUsers,
    invitations: invitations ?? [],
    hierarchy: {
      currentUserId: Number(account.id),
      currentRole: account.role,
    },
  });
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account || !canManageHierarchy(account.role))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await request.json()) as UserUpdateBody;
  const targetId = Number(body.id);
  if (!Number.isInteger(targetId) || targetId <= 0 || !body.status)
    return Response.json({ error: "Alteração inválida" }, { status: 400 });

  const { data, error } = await account.supabase.rpc("vf_set_user_status", {
    p_user_id: targetId,
    p_status: body.status,
  });
  if (error) return Response.json({ error: error.message }, { status: 403 });

  return Response.json({ ok: true, user: data });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account || !canManageHierarchy(account.role))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await request.json()) as InviteBody;
  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  if (!email || !name)
    return Response.json({ error: "Nome e e-mail são obrigatórios" }, { status: 400 });

  const { data, error } = await account.supabase.rpc("vf_create_user_invitation", {
    p_email: email,
    p_name: name,
    p_access_role: body.accessRole ?? null,
    p_parent_user_id: body.parentUserId ?? null,
  });
  if (error) return Response.json({ error: error.message }, { status: 403 });

  return Response.json({ invitation: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const account = await getAccount();
  if (!account || !canManageHierarchy(account.role))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const invitationId = Number(new URL(request.url).searchParams.get("invitationId"));
  if (!Number.isInteger(invitationId) || invitationId <= 0)
    return Response.json({ error: "Convite inválido" }, { status: 400 });

  const { error } = await account.supabase.rpc("vf_revoke_user_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) return Response.json({ error: error.message }, { status: 403 });
  return Response.json({ ok: true });
}
