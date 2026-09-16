import { getAccount } from "../../../server-identity";

type ExportRow = {
  id: string;
  actor_email: string;
  owner_scope: string;
  format: string;
  item_count: number;
  created_at: string;
};

type ExportItemRow = {
  id: number;
  record_id: number;
  owner_email: string;
  snapshot: Record<string, unknown>;
  created_at: string;
};

type CurrentRecordRow = {
  id: number;
  owner_email: string;
  payload: Record<string, unknown>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await context.params;
  const { data: exportRow, error: exportError } = await account.supabase
    .from("vf_contact_exports")
    .select("id,actor_email,owner_scope,format,item_count,created_at")
    .eq("id", id)
    .maybeSingle();

  if (exportError)
    return Response.json({ error: exportError.message }, { status: 400 });
  if (!exportRow)
    return Response.json({ error: "Exportação não encontrada" }, { status: 404 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(
    100,
    Math.max(10, Number(url.searchParams.get("pageSize") || 50)),
  );
  const from = (page - 1) * pageSize;

  const { data: itemRows, count, error: itemError } = await account.supabase
    .from("vf_contact_export_items")
    .select("id,record_id,owner_email,snapshot,created_at", { count: "exact" })
    .eq("export_id", id)
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (itemError)
    return Response.json({ error: itemError.message }, { status: 400 });

  const items = (itemRows ?? []) as ExportItemRow[];
  const recordIds = items.map((item) => Number(item.record_id));
  const currentById = new Map<number, CurrentRecordRow>();

  if (recordIds.length) {
    const { data: currentRows, error: currentError } = await account.supabase
      .from("vf_owned_records")
      .select("id,owner_email,payload")
      .eq("kind", "contact")
      .in("id", recordIds);

    if (currentError)
      return Response.json({ error: currentError.message }, { status: 400 });

    for (const row of (currentRows ?? []) as CurrentRecordRow[]) {
      currentById.set(Number(row.id), row);
    }
  }

  const total = count ?? Number((exportRow as ExportRow).item_count || 0);
  return Response.json(
    {
      export: {
        id: (exportRow as ExportRow).id,
        actorEmail: (exportRow as ExportRow).actor_email,
        ownerScope: (exportRow as ExportRow).owner_scope,
        format: (exportRow as ExportRow).format,
        itemCount: Number((exportRow as ExportRow).item_count || 0),
        createdAt: (exportRow as ExportRow).created_at,
      },
      items: items.map((item) => {
        const current = currentById.get(Number(item.record_id));
        return {
          id: Number(item.id),
          recordId: Number(item.record_id),
          ownerEmail: item.owner_email,
          snapshot: item.snapshot,
          available: Boolean(current),
          current: current?.payload ?? null,
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
