import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../../server-identity";

type ContactPayload = {
  name?: string;
  phone?: string;
  district?: string;
  leader?: string;
  kind?: "Eleitor" | "Liderança";
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
};

const MAX_BATCH_SIZE = 500;

function normalizePhone(value: unknown) {
  let normalized = String(value ?? "").replace(/\D/g, "");
  if ((normalized.length === 12 || normalized.length === 13) && normalized.startsWith("55"))
    normalized = normalized.slice(2);
  return normalized;
}

function sanitizeContact(input: ContactPayload) {
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const phoneNormalized = normalizePhone(phone);
  if (!name || !/^[1-9]\d{9,10}$/.test(phoneNormalized) || /^(\d)\1+$/.test(phoneNormalized))
    return null;

  return {
    name,
    phone,
    phoneNormalized,
    district: String(input.district ?? "").trim(),
    leader: String(input.leader ?? "").trim(),
    kind: input.kind === "Liderança" ? "Liderança" : "Eleitor",
    cep: String(input.cep ?? "").trim(),
    street: String(input.street ?? "").trim(),
    number: String(input.number ?? "").trim(),
    city: String(input.city ?? "").trim(),
    state: String(input.state ?? "").trim(),
  };
}

async function resolveOwner(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  requestedOwner?: string,
) {
  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);

  const requested = requestedOwner?.trim().toLowerCase();
  const targetEmail = requested && requested !== "all" ? requested : account.email;

  if (targetEmail !== account.email && !isAdministrator(account.role))
    return { error: Response.json({ error: "Acesso negado" }, { status: 403 }) };
  if (!emails.includes(targetEmail))
    return {
      error: Response.json(
        { error: "O usuário selecionado não pertence à sua equipe" },
        { status: 403 },
      ),
    };

  const owner = users.find(
    (user) => String(user.email).toLowerCase() === targetEmail,
  );
  if (!owner)
    return {
      error: Response.json(
        { error: "Ambiente selecionado inválido" },
        { status: 400 },
      ),
    };

  return { owner, targetEmail };
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId")?.trim();
  const resolved = await resolveOwner(
    account,
    url.searchParams.get("owner") ?? undefined,
  );
  if ("error" in resolved) return resolved.error;

  if (!batchId)
    return Response.json(
      { error: "Informe o identificador do lote" },
      { status: 400 },
    );

  const { count, error } = await account.supabase
    .from("vf_owned_records")
    .select("id", { count: "exact", head: true })
    .eq("owner_email", resolved.targetEmail)
    .eq("kind", "contact")
    .eq("payload->>importBatchId", batchId);

  if (error) {
    console.error("Failed to check import batch", error);
    return Response.json(
      { error: "Não foi possível conferir o lote." },
      { status: 400 },
    );
  }

  return Response.json({ batchId, count: count ?? 0 });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    contacts?: ContactPayload[];
    ownerEmail?: string;
    importSessionId?: string;
    importBatchId?: string;
  };

  if (!Array.isArray(body.contacts) || !body.contacts.length)
    return Response.json({ error: "Nenhum contato enviado" }, { status: 400 });
  if (body.contacts.length > MAX_BATCH_SIZE)
    return Response.json(
      { error: `Envie no máximo ${MAX_BATCH_SIZE} contatos por lote` },
      { status: 400 },
    );

  const resolved = await resolveOwner(account, body.ownerEmail);
  if ("error" in resolved) return resolved.error;

  const valid = body.contacts
    .map(sanitizeContact)
    .filter(
      (contact): contact is NonNullable<ReturnType<typeof sanitizeContact>> =>
        Boolean(contact),
    );
  const invalid = body.contacts.length - valid.length;

  const uniqueInBatch = new Map<string, (typeof valid)[number]>();
  let duplicatesInFile = 0;
  for (const contact of valid) {
    if (uniqueInBatch.has(contact.phoneNormalized)) duplicatesInFile++;
    else uniqueInBatch.set(contact.phoneNormalized, contact);
  }

  const { data, error } = await account.supabase.rpc(
    "vf_import_contacts_deduplicated",
    {
      p_owner_email: resolved.targetEmail,
      p_contacts: [...uniqueInBatch.values()],
      p_import_session_id: String(body.importSessionId ?? "").trim() || null,
      p_import_batch_id: String(body.importBatchId ?? "").trim() || null,
    },
  );

  if (error) {
    console.error("Contact import RPC failed", error);
    const status = error.code === "42501" ? 403 : 400;
    const message =
      error.code === "42501"
        ? "Acesso negado"
        : error.code === "22023"
          ? "O lote de contatos contém dados inválidos."
          : "Não foi possível importar este lote agora.";
    return Response.json(
      {
        error: message,
        inserted: 0,
        duplicates: duplicatesInFile,
        invalid,
        failed: uniqueInBatch.size,
      },
      { status },
    );
  }

  const result = (data ?? {}) as {
    inserted?: number;
    duplicates?: number;
    invalid?: number;
    recovered?: boolean;
  };
  const inserted = Number(result.inserted) || 0;
  const duplicates = (Number(result.duplicates) || 0) + duplicatesInFile;
  const totalInvalid = invalid + (Number(result.invalid) || 0);

  try {
    const { error: auditError } = await account.supabase.from("vf_audit_logs").insert({
      actor_id: account.auth_user_id,
      actor_email: account.email,
      action: "Importação inteligente de contatos",
      detail: `${resolved.targetEmail} · ${inserted} inseridos · ${duplicates} duplicados descartados · ${totalInvalid} inválidos`,
    });
    if (auditError) console.error("Failed to audit contact import", auditError);
  } catch (auditError) {
    console.error("Unexpected contact import audit failure", auditError);
  }

  return Response.json({
    inserted,
    duplicates,
    invalid: totalInvalid,
    failed: 0,
    recovered: Boolean(result.recovered),
  });
}
