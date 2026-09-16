import { getAccount } from "../../../server-identity";

type SnapshotPayload = {
  format?: string | null;
  [key: string]: unknown;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.role !== "master") {
    return Response.json(
      { error: "O download de snapshots é exclusivo do Administrador Master." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const snapshotId = Number(id);
  if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
    return Response.json({ error: "Snapshot inválido." }, { status: 400 });
  }

  const { data: snapshot, error } = await account.supabase
    .from("vf_backup_snapshots")
    .select("id,created_at,created_by,item_count,checksum,backup_version,data")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load backup snapshot", error);
    return Response.json({ error: "Não foi possível carregar o snapshot." }, { status: 400 });
  }
  if (!snapshot) {
    return Response.json({ error: "Snapshot não encontrado." }, { status: 404 });
  }

  const payload = snapshot.data as SnapshotPayload | null;
  if (!payload || payload.format !== "voto-forte-backup") {
    return Response.json(
      {
        error:
          "Este registro contém somente metadados de rotina e não possui um arquivo histórico recuperável.",
      },
      { status: 409 },
    );
  }

  const serialized = JSON.stringify(payload, null, 2);
  const date = new Date(snapshot.created_at).toISOString().slice(0, 10);

  return new Response(serialized, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="VotoForte-Snapshot-${snapshot.id}-${date}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-VotoForte-Snapshot-Id": String(snapshot.id),
      "X-VotoForte-Snapshot-Checksum": String(snapshot.checksum ?? ""),
    },
  });
}
