import { getAccount } from "../../server-identity";

function currentMunicipalityId(context: unknown) {
  if (!context || typeof context !== "object") return null;
  const value = Number((context as { currentMunicipalityId?: unknown }).currentMunicipalityId);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function supabaseProjectRef() {
  try {
    return new URL(String(process.env.NEXT_PUBLIC_SUPABASE_URL || "")).hostname.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
}

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
  const contextRpc =
    account.accessRole === "gestor"
      ? "vf_municipality_context_gestor_all"
      : "vf_municipality_context";

  const { data, error } = await account.supabase.rpc(switchRpc, {
    p_municipality_id: municipalityId,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  const switchedId = currentMunicipalityId(data);
  const { data: verifiedContext, error: verifyError } = await account.supabase.rpc(contextRpc);
  const verifiedId = currentMunicipalityId(verifiedContext);

  console.info("[vf-municipality-switch]", {
    projectRef: supabaseProjectRef(),
    role: account.accessRole,
    requestedId: municipalityId,
    switchedId,
    verifiedId,
    verifyError: verifyError?.message || null,
  });

  if (verifyError) {
    return Response.json({ error: "Não foi possível confirmar a troca de município." }, { status: 409 });
  }
  if (switchedId !== municipalityId || verifiedId !== municipalityId) {
    return Response.json(
      {
        error: "A troca de município não foi persistida. Tente novamente.",
        requestedMunicipalityId: municipalityId,
        currentMunicipalityId: verifiedId,
      },
      { status: 409 },
    );
  }

  return Response.json({ context: verifiedContext });
}
