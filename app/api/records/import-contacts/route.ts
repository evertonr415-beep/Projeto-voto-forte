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
  return String(value ?? "").replace(/\D/g, "");
}

function sanitizeContact(input: ContactPayload) {
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const normalizedPhone = normalizePhone(phone);
  if (!name || normalizedPhone.length < 8) return null;

  return {
    name,
    phone,
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

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    contacts?: ContactPayload[];
    ownerEmail?: string;
  };

  if (!Array.isArray(body.contacts) || !body.contacts.length)
    return Response.json({ error: "Nenhum contato enviado" }, { status: 400 });
  if (body.contacts.length > MAX_BATCH_SIZE)
    return Response.json(
      { error: `Envie no máximo ${MAX_BATCH_SIZE} contatos por lote` },
      { status: 400 },
    );

  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);

  const requested = body.ownerEmail?.trim().toLowerCase();
  const targetEmail = requested && requested !== "all" ? requested : account.email;

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
    return Response.json({ error: "Ambiente selecionado inválido" }, { status: 400 });

  const valid = body.contacts
    .map(sanitizeContact)
    .filter((contact): contact is NonNullable<ReturnType<typeof sanitizeContact>> => Boolean(contact));

  const invalid = body.contacts.length - valid.length;
  const uniqueInBatch = new Map<string, (typeof valid)[number]>();
  let duplicatesInFile = 0;
  for (const contact of valid) {
    const phone = normalizePhone(contact.phone);
    if (uniqueInBatch.has(phone)) duplicatesInFile++;
    else uniqueInBatch.set(phone, contact);
  }

  const incoming = [...uniqueInBatch.values()];
  const incomingPhones = new Set(incoming.map((contact) => normalizePhone(contact.phone)));
  const existingPhones = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await account.supabase
      .from("vf_owned_records")
      .select("payload")
      .eq("owner_email", targetEmail)
      .eq("kind", "contact")
      .range(from, from + pageSize - 1);

    if (error) return Response.json({ error: error.message }, { status: 400 });
    for (const row of data ?? []) {
      const payload = row.payload as { phone?: string } | null;
      const phone = normalizePhone(payload?.phone);
      if (phone && incomingPhones.has(phone)) existingPhones.add(phone);
    }
    if (!data || data.length < pageSize) break;
  }

  const toInsert = incoming.filter(
    (contact) => !existingPhones.has(normalizePhone(contact.phone)),
  );

  if (!toInsert.length) {
    return Response.json({
      inserted: 0,
      duplicates: existingPhones.size + duplicatesInFile,
      invalid,
      failed: 0,
    });
  }

  const now = new Date().toISOString();
  const rows = toInsert.map((contact) => ({
    owner_id: owner.auth_user_id,
    owner_email: owner.email,
    kind: "contact",
    payload: contact,
    updated_at: now,
  }));

  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .insert(rows)
    .select("id");

  if (error)
    return Response.json(
      {
        error: error.message,
        inserted: 0,
        duplicates: existingPhones.size + duplicatesInFile,
        invalid,
        failed: toInsert.length,
      },
      { status: 400 },
    );

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Importação de contatos em lote",
    detail: `${owner.email} · ${data?.length ?? 0} inseridos · ${existingPhones.size + duplicatesInFile} duplicados · ${invalid} inválidos`,
  });

  return Response.json({
    inserted: data?.length ?? 0,
    duplicates: existingPhones.size + duplicatesInFile,
    invalid,
    failed: Math.max(0, toInsert.length - (data?.length ?? 0)),
  });
}
