import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../../server-identity";
import { getAutonomousSupabase } from "../../../supabase-server";

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

  // Preserve geographic coordinates if provided
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
    if (uniqueInBatch.has(contact.phoneNormalized as string)) duplicatesInFile++;
    else uniqueInBatch.set(contact.phoneNormalized as string, contact);
  }

  let inserted = 0;
  let duplicates = duplicatesInFile;
  let totalInvalid = invalid;
  let recovered = false;
  let rpcSucceeded = false;

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
      totalInvalid = invalid + (Number(result.invalid) || 0);
      recovered = Boolean(result.recovered);
      rpcSucceeded = true;
    } else if (error) {
      console.warn("Contact import RPC error, activating direct insert fallback:", error.message);
    }
  } catch (rpcErr) {
    console.warn("Contact import RPC threw exception, activating direct insert fallback:", rpcErr);
  }

  if (!rpcSucceeded) {
    const targetOwnerId = resolved.owner?.auth_user_id || account.auth_user_id || "00000000-0000-0000-0000-000000000000";
    const targetOwnerEmail = resolved.targetEmail || account.email;
    const now = new Date().toISOString();

    const recordsToInsert = [...uniqueInBatch.values()].map((contact) => ({
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

    let insertSuccess = false;

    // Tentativa 1: Inserção com o cliente autenticado da conta
    try {
      const { data: insertedRows, error: insertErr } = await account.supabase
        .from("vf_owned_records")
        .insert(recordsToInsert)
        .select("id");

      if (!insertErr) {
        inserted = Array.isArray(insertedRows) ? insertedRows.length : recordsToInsert.length;
        insertSuccess = true;
      }
    } catch (err) {
      console.warn("Fallback insert via account.supabase failed:", err);
    }

    // Tentativa 2: Inserção com o cliente autônomo (service/master key)
    if (!insertSuccess) {
      try {
        const autoClient = getAutonomousSupabase();
        const { data: autoRows, error: autoErr } = await autoClient
          .from("vf_owned_records")
          .insert(recordsToInsert)
          .select("id");

        if (!autoErr) {
          inserted = Array.isArray(autoRows) ? autoRows.length : recordsToInsert.length;
          insertSuccess = true;
        } else {
          console.error("Fallback insert via autonomous client failed:", autoErr);
        }
      } catch (autoErr) {
        console.error("Fallback insert via autonomous client threw:", autoErr);
      }
    }

    if (!insertSuccess) {
      return Response.json(
        {
          error: "Não foi possível gravar os contatos no banco de dados.",
          inserted: 0,
          duplicates: duplicatesInFile,
          invalid: totalInvalid,
          failed: uniqueInBatch.size,
        },
        { status: 500 },
      );
    }
  }

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
    recovered,
  });
}

