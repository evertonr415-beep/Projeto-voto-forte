import { getAccount } from "../../server-identity";

const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

function isAdm(accessRole: string) { return accessRole === "adm"; }

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account || !isAdm(account.accessRole)) return Response.json({ error: "Acesso exclusivo do ADM" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("download"));
  if (Number.isInteger(id) && id > 0) {
    const { data, error } = await account.supabase.from("vf_backup_snapshots").select("data,created_at,checksum").eq("id", id).single();
    if (error || !data) return Response.json({ error: "Backup não encontrado" }, { status: 404 });
    const date = new Date(data.created_at).toISOString().slice(0, 10);
    return new Response(JSON.stringify(data.data, null, 2), { headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="VotoForte-Backup-${date}.json"`,
      "x-backup-checksum": data.checksum,
    }});
  }
  const { data, error } = await account.supabase.from("vf_backup_snapshots").select("id,created_at,created_by,backup_version,checksum,item_count").order("created_at", { ascending: false }).limit(30);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ backups: data ?? [], automatic: true, schedule: "Diariamente às 03:00 (horário de Brasília)", retentionDays: 30 });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account || !isAdm(account.accessRole)) return Response.json({ error: "Acesso exclusivo do ADM" }, { status: 403 });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) return Response.json({ error: "O arquivo excede o limite de 64 MB" }, { status: 413 });
  let body: { action?: string; backup?: unknown };
  try { body = JSON.parse(text || "{}"); }
  catch { return Response.json({ error: "Arquivo JSON inválido" }, { status: 400 }); }
  if (body.action === "create") {
    const { data, error } = await account.supabase.rpc("vf_create_manual_backup");
    if (error) return Response.json({ error: error.message }, { status: 400 });
    await account.supabase.from("vf_audit_logs").insert({ actor_id: account.auth_user_id, actor_email: account.email, action: "Backup manual criado", detail: "Cópia completa disponível para download" });
    return Response.json({ backup: data }, { status: 201 });
  }
  if (body.action === "restore") {
    const backup = body.backup as Record<string, unknown> | null;
    const version = Number(backup?.version ?? 0);
    if (!backup || backup.format !== "voto-forte-backup" || ![1, 2].includes(version)) return Response.json({ error: "Arquivo de backup inválido ou incompatível" }, { status: 400 });
    const { data, error } = await account.supabase.rpc("vf_restore_backup", { payload: backup });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ restored: data });
  }
  return Response.json({ error: "Operação de backup inválida" }, { status: 400 });
}
