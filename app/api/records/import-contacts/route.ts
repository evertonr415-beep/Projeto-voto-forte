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

type PayloadRow = {
  payload: {
    phone?: string;
    phoneNormalized?: string;
  } | null;
};

const MAX_BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function sanitizeContact(input: ContactPayload) {
  const name = String(input.name ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const phoneNormalized = normalizePhone(phone);
  if (!name || phoneNormalized.length < 8) return null;

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

async function loadExistingPhones(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  ownerEmail: string,
) {
  const phones = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await account.supabase
      .from("vf_owned_records")
      .select("payload")
      .eq("owner_email", ownerEmail)
      .eq("kind", "contact")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as PayloadRow[]) {
      const phone =
        normalizePhone(row.payload?.phoneNormalized) ||
        normalizePhone(row.payload?.phone);
      if (phone) phones.add(phone);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  return phones;
}

async function countBatch(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  ownerEmail: string,
  batchId: string,
) {
  const { count, error } = await account.supabase
    .from("vf_owned_records")
    .select("id", { count: "exact", head: true })
    .eq("owner_email", ownerEmail)
    .eq("kind", "contact")
    .eq("payload->>importBatchId", batchId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function findExistingNormalizedPhones(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
  ownerEmail: string,
  phones: string[],
) {
  if (!phones.length) return new Set<string>();
  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .select("payload")
    .eq("owner_email", ownerEmail)
    .eq("kind", "contact")
    .in("payload->>phoneNormalized", phones);

  if (error) throw new Error(error.message);
  return new Set(
    ((data ?? []) as PayloadRow[])
      .map((row) => normalizePhone(row.payload?.phoneNormalized))
      .filter(Boolean),
  );
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOwner = url.searchParams.get("owner") ?? undefined;
  const batchId = url.searchParams.get("batchId")?.trim();
  const resolved = await resolveOwner(account, requestedOwner);
  if ("error" in resolved) return resolved.error;

  try {
    if (batchId) {
      const count = await countBatch(account, resolved.targetEmail, batchId);
      return Response.json({ batchId, count, completed: count > 0 });
    }

    const phones = await loadExistingPhones(account, resolved.targetEmail);
    return Response.json({
      ownerEmail: resolved.targetEmail,
      phones: [...phones],
      total: phones.size,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível conferir os contatos existentes",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    contacts?: ContactPayload[];
    ownerEmail?: string;
    existingPhonesChecked?: boolean;
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
  const { owner, targetEmail } = resolved;
  const importSessionId = String(body.importSessionId ?? "").trim();
  const importBatchId = String(body.importBatchId ?? "").trim();

  if (importBatchId) {
    try {
      const alreadyInserted = await countBatch(account, targetEmail, importBatchId);
      if (alreadyInserted > 0)
        return Response.json({
          inserted: alreadyInserted,
          duplicates: 0,
          invalid: 0,
          failed: 0,
          recovered: true,
        });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Falha ao conferir o lote" },
        { status: 400 },
      );
    }
  }

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

  const incoming = [...uniqueInBatch.values()];
  let existingPhones = new Set<string>();

  try {
    const normalizedExisting = await findExistingNormalizedPhones(
      account,
      targetEmail,
      incoming.map((contact) => contact.phoneNormalized),
    );
    normalizedExisting.forEach((phone) => existingPhones.add(phone));

    if (!body.existingPhonesChecked) {
      const allExistingPhones = await loadExistingPhones(account, targetEmail);
      for (const contact of incoming) {
        if (allExistingPhones.has(contact.phoneNormalized))
          existingPhones.add(contact.phoneNormalized);
      }
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível conferir duplicidades",
      },
      { status: 400 },
    );
  }

  let toInsert = incoming.filter(
    (contact) => !existingPhones.has(contact.phoneNormalized),
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
  let inserted = 0;

  for (let attempt = 0; attempt < 2 && toInsert.length; attempt++) {
    const rows = toInsert.map((contact) => ({
      owner_id: owner.auth_user_id,
      owner_email: owner.email,
      kind: "contact",
      payload: {
        ...contact,
        importSessionId: importSessionId || undefined,
        importBatchId: importBatchId || undefined,
      },
      updated_at: now,
    }));

    const { data, error } = await account.supabase
      .from("vf_owned_records")
      .insert(rows)
      .select("id");

    if (!error) {
      inserted += data?.length ?? 0;
      toInsert = [];
      break;
    }

    if (importBatchId) {
      const recovered = await countBatch(account, targetEmail, importBatchId).catch(
        () => 0,
      );
      if (recovered > 0) {
        inserted += recovered;
        toInsert = [];
        break;
      }
    }

    if (error.code !== "23505" || attempt === 1)
      return Response.json(
        {
          error: error.message,
          inserted,
          duplicates: existingPhones.size + duplicatesInFile,
          invalid,
          failed: toInsert.length,
        },
        { status: 400 },
      );

    const concurrentlyInserted = await findExistingNormalizedPhones(
      account,
      targetEmail,
      toInsert.map((contact) => contact.phoneNormalized),
    );
    concurrentlyInserted.forEach((phone) => existingPhones.add(phone));
    toInsert = toInsert.filter(
      (contact) => !concurrentlyInserted.has(contact.phoneNormalized),
    );
  }

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Importação de contatos em lote",
    detail: `${owner.email} · ${inserted} inseridos · ${existingPhones.size + duplicatesInFile} duplicados · ${invalid} inválidos`,
  });

  return Response.json({
    inserted,
    duplicates: existingPhones.size + duplicatesInFile,
    invalid,
    failed: toInsert.length,
  });
}
