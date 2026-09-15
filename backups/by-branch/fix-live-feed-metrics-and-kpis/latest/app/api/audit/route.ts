import { getAccount } from "../../server-identity";
export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json() as { action?: string; detail?: string };
  const { error } = await account.supabase.from("vf_audit_logs").insert({ actor_id: account.auth_user_id, actor_email: account.email, action: body.action?.trim().slice(0,80)||"Atividade", detail: body.detail?.trim().slice(0,240)||"" });
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ ok: true }, { status: 201 });
}
