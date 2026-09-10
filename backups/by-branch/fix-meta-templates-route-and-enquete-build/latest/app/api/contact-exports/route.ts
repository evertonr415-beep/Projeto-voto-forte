import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const EXPORT_FORMATS = new Set(["csv", "xlsx", "vcf"]);

type ExportRow = {
  id: string;
  actor_id: string;
  actor_email: string;
  owner_scope: string;
  format: string;
  item_count: number;
  created_at: string;
};

function mapExport(row: ExportRow) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    ownerScope: row.owner_scope,
    format: row.format,
    itemCount: Number(row.item_count || 0),
    createdAt: row.created_at,
  };
}

export async function GET() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await account.supabase
    .from("vf_contact_exports")
    .select("id,actor_id,actor_email,owner_scope,format,item_count,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error)
    return Response.json({ error: error.message }, { status: 400 });

  return Response.json(
    { exports: ((data ?? []) as ExportRow[]).map(mapExport) },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    format?: string;
    ownerScope?: string;
  };
  const format = String(body.format ?? "").trim().toLowerCase();
  if (!EXPORT_FORMATS.has(format))
    return Response.json(
      { error: "Formato de exportação inválido" },
      { status: 400 },
    );

  const visibleUsers = await getVisibleUsers(account);
  const visibleEmails = new Set(
    visibleUsers
      .filter((user) => user.status === "active")
      .map((user) => String(user.email).trim().toLowerCase()),
  );
  visibleEmails.add(account.email);

  const requested = String(body.ownerScope ?? "")
    .trim()
    .toLowerCase();
  let ownerScope = account.email;

  if (requested === "all") {
    if (!isAdministrator(account.role))
      return Response.json({ error: "Acesso negado" }, { status: 403 });
    ownerScope = "all";
  } else if (requested) {
    if (!visibleEmails.has(requested))
      return Response.json(
        { error: "Você não possui acesso a este ambiente" },
        { status: 403 },
      );
    ownerScope = requested;
  }

  const { data, error } = await account.supabase.rpc(
    "vf_create_contact_export",
    {
      p_owner_scope: ownerScope,
      p_format: format,
    },
  );

  if (error)
    return Response.json({ error: error.message }, { status: 400 });

  const result = Array.isArray(data) ? data[0] : data;
  const exportId = String(result?.export_id ?? "");
  const itemCount = Number(result?.item_count ?? 0);
  if (!exportId)
    return Response.json(
      { error: "A exportação não pôde ser registrada" },
      { status: 400 },
    );

  return Response.json(
    {
      export: {
        id: exportId,
        ownerScope,
        format,
        itemCount,
      },
    },
    { status: 201 },
  );
}
