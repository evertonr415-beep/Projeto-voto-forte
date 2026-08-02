import { getAccount, isAdministrator } from "../../server-identity";
const allowedKinds = ["contact", "meeting", "draft"] as const;

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const requested = new URL(request.url).searchParams.get("owner")?.trim().toLowerCase();
  const admin = isAdministrator(account.role);
  const owner = admin ? (requested || account.email) : account.email;
  let query = account.supabase.from("vf_owned_records").select("*").order("updated_at", { ascending: false });
  if (!(owner === "all" && admin)) query = query.eq("owner_email", owner);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ scope: owner, records: (data ?? []).map((r: Record<string, unknown>) => ({ id:r.id, ownerEmail:r.owner_email, kind:r.kind, payload:r.payload, createdAt:r.created_at, updatedAt:r.updated_at })) });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json() as { kind?: string; payload?: unknown; ownerEmail?: string };
  if (!allowedKinds.includes(body.kind as typeof allowedKinds[number]) || !body.payload || typeof body.payload !== "object") return Response.json({ error: "Registro inválido" }, { status: 400 });
  let ownerId = account.auth_user_id, ownerEmail = account.email;
  const requested = body.ownerEmail?.trim().toLowerCase();
  if (isAdministrator(account.role) && requested && requested !== "all" && requested !== account.email) {
    const { data: owner } = await account.supabase.from("vf_users").select("auth_user_id,email").eq("email", requested).eq("status","active").single();
    if (!owner) return Response.json({ error: "Ambiente selecionado inválido" }, { status: 400 });
    ownerId = owner.auth_user_id; ownerEmail = owner.email;
  }
  const now = new Date().toISOString();
  const { data, error } = await account.supabase.from("vf_owned_records").insert({ owner_id:ownerId, owner_email:ownerEmail, kind:body.kind, payload:body.payload, updated_at:now }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  await account.supabase.from("vf_audit_logs").insert({ actor_id:account.auth_user_id, actor_email:account.email, action:body.kind==="contact"?"Cadastro criado":body.kind==="meeting"?"Reunião agendada":"Rascunho salvo", detail:`${ownerEmail} · registro ${data.id}` });
  return Response.json({ record:{ id:data.id, ownerEmail:data.owner_email, kind:data.kind, payload:data.payload, createdAt:data.created_at, updatedAt:data.updated_at } }, { status:201 });
}

export async function DELETE(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Registro inválido" }, { status:400 });
  const { data: record } = await account.supabase.from("vf_owned_records").select("id,owner_email").eq("id",id).single();
  if (!record) return Response.json({ error:"Registro não encontrado" }, { status:404 });
  const { error } = await account.supabase.from("vf_owned_records").delete().eq("id",id);
  if (error) return Response.json({ error:"Acesso negado" }, { status:403 });
  await account.supabase.from("vf_audit_logs").insert({ actor_id:account.auth_user_id, actor_email:account.email, action:"Registro removido", detail:`${record.owner_email} · registro ${id}` });
  return Response.json({ ok:true });
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = await request.json() as { id?: number; payload?: unknown };
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0 || !body.payload || typeof body.payload !== "object") return Response.json({ error: "Registro inválido" }, { status: 400 });
  const { data: record } = await account.supabase.from("vf_owned_records").select("id,owner_email,kind").eq("id", id).single();
  if (!record || !["contact","meeting"].includes(record.kind)) return Response.json({ error: "Registro não encontrado" }, { status: 404 });
  const { data, error } = await account.supabase.from("vf_owned_records").update({ payload: body.payload, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return Response.json({ error: "Acesso negado" }, { status: 403 });
  await account.supabase.from("vf_audit_logs").insert({ actor_id:account.auth_user_id, actor_email:account.email, action:record.kind==="meeting"?"Reunião editada":"Contato editado", detail:`${record.owner_email} · registro ${id}` });
  return Response.json({ record:{ id:data.id, ownerEmail:data.owner_email, kind:data.kind, payload:data.payload, createdAt:data.created_at, updatedAt:data.updated_at } });
}
