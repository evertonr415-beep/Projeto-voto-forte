import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const allowedKinds = ["contact", "meeting", "draft"] as const;

type OwnedRecord = {
  id: number;
  owner_email: string;
  kind: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

function mapRecord(record: OwnedRecord) {
  return {
    id: record.id,
    ownerEmail: record.owner_email,
    kind: record.kind,
    payload: record.payload,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function visibleOwners(account: NonNullable<Awaited<ReturnType<typeof getAccount>>>) {
  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);
  return { users, emails };
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const requested = new URL(request.url).searchParams
    .get("owner")
    ?.trim()
    .toLowerCase();
  const { emails } = await visibleOwners(account);

  let scope = account.email;
  if (requested === "all" && isAdministrator(account.role)) scope = "all";
  else if (requested && emails.includes(requested)) scope = requested;
  else if (requested && requested !== account.email)
    return Response.json(
      { error: "Você não possui acesso a este ambiente" },
      { status: 403 },
    );

  const pageSize = 1000;
  const allRecords: OwnedRecord[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = account.supabase
      .from("vf_owned_records")
      .select("*")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (scope === "all") query = query.in("owner_email", emails);
    else query = query.eq("owner_email", scope);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 400 });

    const page = (data ?? []) as OwnedRecord[];
    allRecords.push(...page);
    if (page.length < pageSize) break;
  }

  return Response.json({
    scope,
    visibleOwners: emails,
    records: allRecords.map(mapRecord),
    total: allRecords.length,
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    kind?: string;
    payload?: unknown;
    ownerEmail?: string;
  };

  if (
    !allowedKinds.includes(body.kind as (typeof allowedKinds)[number]) ||
    !body.payload ||
    typeof body.payload !== "object"
  )
    return Response.json({ error: "Registro inválido" }, { status: 400 });

  const { users, emails } = await visibleOwners(account);
  const requested = body.ownerEmail?.trim().toLowerCase();
  const targetEmail =
    requested && requested !== "all" ? requested : account.email;

  if (targetEmail !== account.email && !isAdministrator(account.role))
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  if (!emails.includes(targetEmail))
    return Response.json(
      { error: "O usuário selecionado não pertence à sua equipe" },
      { status: 403 },
    );

  const owner = users.find(
    (user) => String(user.email).toLowerCase() === targetEmail,
  );
  if (!owner)
    return Response.json(
      { error: "Ambiente selecionado inválido" },
      { status: 400 },
    );

  const now = new Date().toISOString();
  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .insert({
      owner_id: owner.auth_user_id,
      owner_email: owner.email,
      kind: body.kind,
      payload: body.payload,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action:
      body.kind === "contact"
        ? "Cadastro criado"
        : body.kind === "meeting"
          ? "Reunião agendada"
          : "Rascunho salvo",
    detail: `${owner.email} · registro ${data.id}`,
  });

  return Response.json(
    { record: mapRecord(data as OwnedRecord) },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0)
    return Response.json({ error: "Registro inválido" }, { status: 400 });

  const { data: record } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email")
    .eq("id", id)
    .single();
  if (!record)
    return Response.json({ error: "Registro não encontrado" }, { status: 404 });

  const { emails } = await visibleOwners(account);
  if (!emails.includes(String(record.owner_email).toLowerCase()))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const { error } = await account.supabase
    .from("vf_owned_records")
    .delete()
    .eq("id", id);
  if (error) return Response.json({ error: "Acesso negado" }, { status: 403 });

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Registro removido",
    detail: `${record.owner_email} · registro ${id}`,
  });

  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as { id?: number; payload?: unknown };
  const id = Number(body.id);
  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !body.payload ||
    typeof body.payload !== "object"
  )
    return Response.json({ error: "Registro inválido" }, { status: 400 });

  const { data: record } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,kind")
    .eq("id", id)
    .single();

  if (!record || !["contact", "meeting"].includes(record.kind))
    return Response.json({ error: "Registro não encontrado" }, { status: 404 });

  const { emails } = await visibleOwners(account);
  if (!emails.includes(String(record.owner_email).toLowerCase()))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .update({ payload: body.payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return Response.json({ error: "Acesso negado" }, { status: 403 });

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: record.kind === "meeting" ? "Reunião editada" : "Contato editado",
    detail: `${record.owner_email} · registro ${id}`,
  });

  return Response.json({ record: mapRecord(data as OwnedRecord) });
}
