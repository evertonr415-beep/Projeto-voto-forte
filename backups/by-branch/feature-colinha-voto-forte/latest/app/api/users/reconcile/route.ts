import { getAccount, type AccessRole } from "../../../server-identity";

type ReconcileBody = {
  authUserId?: string;
  name?: string;
  accessRole?: Exclude<AccessRole, "adm">;
  parentUserId?: number | null;
  confirm?: boolean;
};

const allowedRoles = new Set<Exclude<AccessRole, "adm">>([
  "master",
  "lideranca",
  "liderado",
  "eleitor",
]);

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.accessRole !== "adm") {
    return Response.json({ error: "Apenas o ADM pode habilitar contas Auth existentes." }, { status: 403 });
  }

  const body = (await request.json()) as ReconcileBody;
  const authUserId = body.authUserId?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const accessRole = body.accessRole;

  if (body.confirm !== true) {
    return Response.json({ error: "Confirmação explícita obrigatória." }, { status: 400 });
  }
  if (!authUserId || !name || !accessRole || !allowedRoles.has(accessRole)) {
    return Response.json({ error: "Conta, nome ou nível de acesso inválido." }, { status: 400 });
  }
  if (accessRole !== "master" && !body.parentUserId) {
    return Response.json({ error: "Selecione o superior imediato para este nível." }, { status: 400 });
  }

  const { data, error } = await account.supabase.rpc("vf_reconcile_auth_profile", {
    p_auth_user_id: authUserId,
    p_name: name,
    p_access_role: accessRole,
    p_parent_user_id: accessRole === "master" ? null : body.parentUserId ?? null,
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ user: data });
}
