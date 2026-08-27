import { getAccount } from "../../server-identity";

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const contextRpc =
    account.accessRole === "gestor"
      ? "vf_municipality_context_gestor_all"
      : "vf_municipality_context";

  const [{ data: context, error: contextError }, { data: overview, error: overviewError }] =
    await Promise.all([
      account.supabase.rpc(contextRpc),
      account.accessRole === "adm"
        ? account.supabase.rpc("vf_municipality_overview")
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (contextError) return Response.json({ error: contextError.message }, { status: 400 });
  return Response.json({ context, overview: overviewError ? null : overview });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as { municipalityId?: number };
  const municipalityId = Number(body.municipalityId);
  if (!Number.isInteger(municipalityId) || municipalityId <= 0) {
    return Response.json({ error: "Município inválido" }, { status: 400 });
  }

  const switchRpc =
    account.accessRole === "gestor"
      ? "vf_set_default_municipality_gestor_all"
      : "vf_set_default_municipality";

  const { data, error } = await account.supabase.rpc(switchRpc, {
    p_municipality_id: municipalityId,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ context: data });
}
