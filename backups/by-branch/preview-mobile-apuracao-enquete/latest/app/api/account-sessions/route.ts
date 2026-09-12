import { getAccount } from "../../server-identity";

type RevokeBody = {
  mode?: "single" | "others" | "all";
  sessionId?: string | null;
};

export async function GET() {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.accessRole !== "adm")
    return Response.json({ error: "Acesso restrito ao ADM" }, { status: 403 });

  const { data, error } = await account.supabase.rpc("vf_adm_account_sessions");
  if (error) {
    console.error("Failed to load ADM account sessions", error);
    return Response.json(
      { error: "Não foi possível carregar as sessões da conta agora." },
      { status: 500 },
    );
  }

  return Response.json(data ?? { sessions: [] }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (account.accessRole !== "adm")
    return Response.json({ error: "Acesso restrito ao ADM" }, { status: 403 });

  let body: RevokeBody;
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    return Response.json({ error: "Solicitação inválida" }, { status: 400 });
  }

  const mode = body.mode;
  if (!mode || !["single", "others", "all"].includes(mode))
    return Response.json({ error: "Ação de sessão inválida" }, { status: 400 });
  if (mode === "single" && !body.sessionId)
    return Response.json({ error: "Sessão não informada" }, { status: 400 });

  const { data, error } = await account.supabase.rpc(
    "vf_revoke_adm_account_session",
    {
      p_mode: mode,
      p_session_id: mode === "single" ? body.sessionId : null,
    },
  );

  if (error) {
    console.error("Failed to revoke ADM account sessions", error);
    const denied = error.code === "42501";
    return Response.json(
      { error: denied ? "Acesso negado" : error.message || "Não foi possível encerrar a sessão." },
      { status: denied ? 403 : 400 },
    );
  }

  return Response.json(data ?? { mode, revoked: 0 }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
