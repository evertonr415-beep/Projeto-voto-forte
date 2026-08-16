import { getAccount } from "../../server-identity";

type ApplicationAction = "approve" | "reject";

function canReview(accessRole: string) {
  return accessRole === "adm" || accessRole === "master";
}

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!canReview(account.accessRole)) return Response.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await account.supabase.rpc("vf_list_signup_requests");
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ requests: data ?? [], currentUser: { accessRole: account.accessRole } });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!canReview(account.accessRole)) return Response.json({ error: "Acesso negado" }, { status: 403 });

  const body = (await request.json()) as {
    action?: ApplicationAction;
    requestId?: string;
    accessRole?: string;
    parentUserId?: number | null;
    note?: string;
  };
  if (!body.requestId) return Response.json({ error: "Solicitação inválida" }, { status: 400 });

  if (body.action === "reject") {
    const { data, error } = await account.supabase.rpc("vf_reject_signup_request", {
      p_request_id: body.requestId,
      p_note: body.note?.trim() || null,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ request: data });
  }

  const accessRole = account.accessRole === "master" ? "lideranca" : body.accessRole || "master";
  const { data, error } = await account.supabase.rpc("vf_approve_signup_request", {
    p_request_id: body.requestId,
    p_access_role: accessRole,
    p_parent_user_id: body.parentUserId ?? null,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ request: data });
}
