import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const allowedKinds = ["contact", "meeting", "draft"] as const;
type AllowedKind = (typeof allowedKinds)[number];

const DASHBOARD_MAPPED_CONTACT_LIMIT = 2000;
const DASHBOARD_MEETING_LIMIT = 2000;
const DASHBOARD_DRAFT_LIMIT = 500;

type PayloadObject = Record<string, unknown>;

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

function isPayloadObject(value: unknown): value is PayloadObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingCoordinate(value: unknown) {
  return value === undefined || value === null || value === "";
}

function normalizeCoordinates(payload: PayloadObject) {
  const normalized = { ...payload };
  const latitude = normalized.latitude;
  const longitude = normalized.longitude;
  const latitudeMissing = isMissingCoordinate(latitude);
  const longitudeMissing = isMissingCoordinate(longitude);

  if (latitudeMissing && longitudeMissing) {
    delete normalized.latitude;
    delete normalized.longitude;
    return { payload: normalized, error: null };
  }

  if (latitudeMissing !== longitudeMissing) {
    return {
      payload: normalized,
      error: "Latitude e longitude devem ser informadas juntas.",
    };
  }

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return {
      payload: normalized,
      error: "As coordenadas informadas são inválidas.",
    };
  }

  return { payload: normalized, error: null };
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

  const url = new URL(request.url);
  const requested = url.searchParams.get("owner")?.trim().toLowerCase();
  const requestedKind = url.searchParams.get("kind")?.trim().toLowerCase();
  const requestedMode = url.searchParams.get("mode")?.trim().toLowerCase();
  const kind = allowedKinds.includes(requestedKind as AllowedKind)
    ? (requestedKind as AllowedKind)
    : null;

  if (requestedKind && !kind) {
    return Response.json({ error: "Tipo de registro inválido" }, { status: 400 });
  }

  const { emails } = await visibleOwners(account);

  let scope = account.email;
  if (requested === "all" && isAdministrator(account.role)) scope = "all";
  else if (requested && emails.includes(requested)) scope = requested;
  else if (requested && requested !== account.email)
    return Response.json(
      { error: "Você não possui acesso a este ambiente" },
      { status: 403 },
    );

  // O modo leve é o padrão para leituras consolidadas do Sistema Completo.
  // A leitura histórica de até 20 mil registros só fica disponível quando
  // solicitada explicitamente com mode=full, preservando compatibilidade sem
  // expor a interface principal a cargas massivas ou visões parciais da base.
  if (!kind && requestedMode !== "full") {
    const makeScopedQuery = (recordKind: AllowedKind, limit: number) => {
      let query = account.supabase
        .from("vf_owned_records")
        .select("id,owner_email,kind,payload,created_at,updated_at")
        .eq("kind", recordKind)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (scope === "all") query = query.in("owner_email", emails);
      else query = query.eq("owner_email", scope);
      return query;
    };

    const makeScopedCountQuery = (recordKind: AllowedKind) => {
      let query = account.supabase
        .from("vf_owned_records")
        .select("id", { count: "exact", head: true })
        .eq("kind", recordKind);

      if (scope === "all") query = query.in("owner_email", emails);
      else query = query.eq("owner_email", scope);
      return query;
    };

    const mappedContactsQuery = makeScopedQuery(
      "contact",
      DASHBOARD_MAPPED_CONTACT_LIMIT,
    )
      .not("payload->>latitude", "is", null)
      .not("payload->>longitude", "is", null)
      .neq("payload->>latitude", "")
      .neq("payload->>longitude", "");

    const mappedContactsCountQuery = makeScopedCountQuery("contact")
      .not("payload->>latitude", "is", null)
      .not("payload->>longitude", "is", null)
      .neq("payload->>latitude", "")
      .neq("payload->>longitude", "");

    const [
      mappedContactsResult,
      mappedContactsCountResult,
      meetingsResult,
      draftsResult,
    ] = await Promise.all([
      mappedContactsQuery,
      mappedContactsCountQuery,
      makeScopedQuery("meeting", DASHBOARD_MEETING_LIMIT),
      makeScopedQuery("draft", DASHBOARD_DRAFT_LIMIT),
    ]);

    const error =
      mappedContactsResult.error ||
      mappedContactsCountResult.error ||
      meetingsResult.error ||
      draftsResult.error;
    if (error)
      return Response.json({ error: error.message }, { status: 400 });

    const mappedContacts = (mappedContactsResult.data ?? []) as OwnedRecord[];
    const mappedContactsTotal = Number(
      mappedContactsCountResult.count ?? mappedContacts.length,
    );
    const meetings = (meetingsResult.data ?? []) as OwnedRecord[];
    const drafts = (draftsResult.data ?? []) as OwnedRecord[];
    const mappedContactsTruncated = mappedContactsTotal > mappedContacts.length;
    const truncated =
      mappedContactsTruncated ||
      meetings.length >= DASHBOARD_MEETING_LIMIT ||
      drafts.length >= DASHBOARD_DRAFT_LIMIT;
    const dashboardRecords = [...mappedContacts, ...meetings, ...drafts].sort(
      (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    );

    return Response.json(
      {
        scope,
        kind: null,
        mode: "dashboard",
        visibleOwners: emails,
        records: dashboardRecords.map(mapRecord),
        total: dashboardRecords.length,
        mappedContactsTotal,
        mappedContactRecords: mappedContacts.length,
        meetings: meetings.length,
        drafts: drafts.length,
        truncated,
        mappedContactsTruncated,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  }

  const pageSize = 1000;
  const maxRecords = 20000;
  const allRecords: OwnedRecord[] = [];

  for (let from = 0; from < maxRecords; from += pageSize) {
    let query = account.supabase
      .from("vf_owned_records")
      .select("id,owner_email,kind,payload,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (scope === "all") query = query.in("owner_email", emails);
    else query = query.eq("owner_email", scope);

    if (kind) query = query.eq("kind", kind);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 400 });

    const page = (data ?? []) as OwnedRecord[];
    allRecords.push(...page);
    if (page.length < pageSize) break;
  }

  return Response.json(
    {
      scope,
      kind,
      mode: requestedMode === "full" ? "full" : null,
      visibleOwners: emails,
      records: allRecords.map(mapRecord),
      total: allRecords.length,
      truncated: allRecords.length >= maxRecords,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
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
    !allowedKinds.includes(body.kind as AllowedKind) ||
    !isPayloadObject(body.payload)
  )
    return Response.json({ error: "Registro inválido" }, { status: 400 });

  const normalized = normalizeCoordinates(body.payload);
  if (normalized.error)
    return Response.json({ error: normalized.error }, { status: 400 });

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
      payload: normalized.payload,
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
  if (!Number.isInteger(id) || id <= 0 || !isPayloadObject(body.payload))
    return Response.json({ error: "Registro inválido" }, { status: 400 });

  const { data: record } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,kind,payload")
    .eq("id", id)
    .single();

  if (!record || !["contact", "meeting"].includes(record.kind))
    return Response.json({ error: "Registro não encontrado" }, { status: 404 });

  const { emails } = await visibleOwners(account);
  if (!emails.includes(String(record.owner_email).toLowerCase()))
    return Response.json({ error: "Acesso negado" }, { status: 403 });

  const currentPayload = isPayloadObject(record.payload) ? record.payload : {};
  const normalized = normalizeCoordinates({
    ...currentPayload,
    ...body.payload,
  });
  if (normalized.error)
    return Response.json({ error: normalized.error }, { status: 400 });

  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .update({
      payload: normalized.payload,
      updated_at: new Date().toISOString(),
    })
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
