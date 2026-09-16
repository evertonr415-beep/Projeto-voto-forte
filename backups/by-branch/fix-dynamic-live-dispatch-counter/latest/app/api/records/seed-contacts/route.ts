import {
  getAccount,
  isAdministrator,
} from "../../../server-identity";

export const dynamic = "force-dynamic";

type SeedContact = {
  name: string;
  phone: string;
  phoneNormalized: string;
  district?: string;
  leader?: string;
  kind?: string;
  cep?: string;
  street?: string;
  number?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
};

const BATCH_SIZE = 200;

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  if (!isAdministrator(account.role) && account.accessRole !== "adm")
    return Response.json(
      { error: "Apenas administradores podem executar a importação em lote." },
      { status: 403 },
    );

  const body = (await request.json()) as { contacts?: SeedContact[] };
  if (!Array.isArray(body.contacts) || !body.contacts.length)
    return Response.json({ error: "Nenhum contato enviado" }, { status: 400 });

  const contacts = body.contacts;
  let inserted = 0;
  let duplicates = 0;
  let failed = 0;
  const now = new Date().toISOString();
  const sessionId = `seed-${Date.now()}`;

  // Process in batches
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const rows = batch.map((c) => ({
      owner_email: account.email,
      kind: "contact" as const,
      payload: {
        name: c.name,
        phone: c.phone,
        phoneNormalized: c.phoneNormalized,
        district: c.district || "",
        leader: c.leader || "",
        kind: c.kind === "Liderança" ? "Liderança" : "Eleitor",
        cep: c.cep || "",
        street: c.street || "",
        number: c.number || "",
        city: c.city || "",
        state: c.state || "PR",
        latitude: c.latitude,
        longitude: c.longitude,
        locationLabel: c.locationLabel || "",
        importSessionId: sessionId,
      },
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await account.supabase
      .from("vf_owned_records")
      .upsert(rows, {
        onConflict: "owner_email,kind,payload->phoneNormalized",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      // Fallback: insert one by one
      for (const row of rows) {
        const { error: singleError } = await account.supabase
          .from("vf_owned_records")
          .insert(row);
        if (singleError) {
          if (singleError.code === "23505") duplicates++;
          else failed++;
        } else {
          inserted++;
        }
      }
    } else {
      inserted += data?.length ?? batch.length;
    }
  }

  // Log audit
  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Importação em lote via CSV (seed)",
    detail: `${inserted} contatos inseridos de ${contacts.length} enviados. ${duplicates} duplicados. ${failed} falhas. Sessão: ${sessionId}`,
  });

  return Response.json({
    success: true,
    inserted,
    duplicates,
    failed,
    total: contacts.length,
    sessionId,
  });
}
