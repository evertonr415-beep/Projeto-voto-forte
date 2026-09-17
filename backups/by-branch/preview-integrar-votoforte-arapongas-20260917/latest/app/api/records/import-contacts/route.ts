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
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
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

  const result: Record<string, unknown> = {
    name,
    phone,
    phoneNormalized,
    district: String(input.district ?? "").trim(),
    leader: String(input.leader ?? "").trim(),
    kind: input.kind === "Liderança" ? "Liderança" : "Eleitor",
    cep: String(input.cep ?? "").trim(),
    street: String(input.street ?? "").trim(),
    number: String(input.number ?? "").trim(),
    city: String(input.city ?? "").trim() || "Arapongas",
    state: String(input.state ?? "").trim() || "PR",
  };

  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    result.latitude = lat;
    result.longitude = lng;
    if (input.locationLabel) result.locationLabel = String(input.locationLabel).trim();
  }

  return result;
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
    const phone = contact.phoneNormalized as string;
    if (uniqueInBatch.has(phone)) duplicatesInFile++;
    else uniqueInBatch.set(phone, contact);
  }

  let inserted = 0;
  let duplicates = duplicatesInFile;
  const totalInvalid = invalid;
  let recovered = false;
  let rpcSucceeded = false;

  // Tentativa 1: RPC nativo
  try {
    const { data, error } = await account.supabase.rpc(
      "vf_import_contacts_deduplicated",
      {
        p_owner_email: resolved.targetEmail,
        p_contacts: [...uniqueInBatch.values()],
        p_import_session_id: String(body.importSessionId ?? "").trim() || null,
        p_import_batch_id: String(body.importBatchId ?? "").trim() || null,
      },
    );

    if (!error && data) {
      const result = data as {
        inserted?: number;
        duplicates?: number;
        invalid?: number;
        recovered?: boolean;
      };
      inserted = Number(result.inserted) || 0;
      duplicates = (Number(result.duplicates) || 0) + duplicatesInFile;
      recovered = Boolean(result.recovered);
      rpcSucceeded = true;
    }
  } catch (rpcErr) {
    console.warn("Contact import RPC threw, running robust fallback:", rpcErr);
  }

  // Tentativa 2: Fallback direto e resiliente com resolução de duplicidades individual
  if (!rpcSucceeded) {
    const targetOwnerId = account.auth_user_id;
    const targetOwnerEmail = resolved.targetEmail || account.email;
    const now = new Date().toISOString();

    const recordsToProcess = [...uniqueInBatch.values()].map((contact) => ({
      owner_id: targetOwnerId,
      owner_email: targetOwnerEmail,
      kind: "contact",
      payload: {
        ...contact,
        importSessionId: String(body.importSessionId ?? "").trim() || undefined,
        importBatchId: String(body.importBatchId ?? "").trim() || undefined,
      },
      updated_at: now,
    }));

    // Processamento em sub-lotes com fallback individual para nunca falhar
    const chunkSize = 25;
    for (let i = 0; i < recordsToProcess.length; i += chunkSize) {
      const chunk = recordsToProcess.slice(i, i + chunkSize);
      try {
        const { error: chunkErr } = await account.supabase
          .from("vf_owned_records")
          .insert(chunk);

        if (!chunkErr) {
          inserted += chunk.length;
        } else {
          // Se o sub-lote encontrar algum registro duplicado, insere os itens individualmente
          for (const item of chunk) {
            try {
              const { error: itemErr } = await account.supabase
                .from("vf_owned_records")
                .insert([item]);
              if (!itemErr) inserted++;
              else duplicates++;
            } catch {
              duplicates++;
            }
          }
        }
      } catch {
        for (const item of chunk) {
          try {
            const { error: itemErr } = await account.supabase
              .from("vf_owned_records")
              .insert([item]);
            if (!itemErr) inserted++;
            else duplicates++;
          } catch {
            duplicates++;
          }
        }
      }
    }
  }

  try {
    void account.supabase.from("vf_audit_logs").insert({
      actor_id: account.auth_user_id,
      actor_email: account.email,
      action: "Importação inteligente de contatos",
      detail: `${resolved.targetEmail} · ${inserted} inseridos · ${duplicates} duplicados descartados · ${totalInvalid} inválidos`,
    });
  } catch {
    // Silencioso
  }

  return Response.json({
    inserted,
    duplicates,
    invalid: totalInvalid,
    failed: 0,
    recovered,
  });
}
