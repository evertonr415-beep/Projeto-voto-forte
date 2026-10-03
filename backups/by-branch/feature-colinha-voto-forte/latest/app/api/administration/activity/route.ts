import { getAccount } from "../../../server-identity";

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!['adm', 'gestor'].includes(account.accessRole)) {
    return Response.json({ error: "Acesso restrito à Administração" }, { status: 403 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind")?.trim().toLowerCase();
  const key = url.searchParams.get("key")?.trim();
  const ownerEmail = url.searchParams.get("owner")?.trim().toLowerCase() || null;

  if (kind && key) {
    const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit")) || 100));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const { data, error } = await account.supabase.rpc("vf_administration_activity_items", {
      p_kind: kind,
      p_key: key,
      p_owner_email: ownerEmail,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json(data ?? { kind, key, total: 0, items: [] }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }

  const limit = Math.min(500, Math.max(30, Number(url.searchParams.get("limit")) || 200));
  const { data, error } = await account.supabase.rpc("vf_administration_activity_feed", {
    p_limit: limit,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  return Response.json(
    {
      currentUserRole: account.accessRole,
      ...(data && typeof data === "object" ? data : {}),
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
