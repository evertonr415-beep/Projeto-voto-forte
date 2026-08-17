import { getAccount } from "../../server-identity";

async function getGeneralAdm() {
  const account = await getAccount();
  if (!account) return { response: Response.json({ error: "Não autenticado" }, { status: 401 }) };
  if (account.accessRole !== "adm") {
    return { response: Response.json({ error: "Somente o ADM Geral pode administrar municípios." }, { status: 403 }) };
  }
  return { account };
}

async function listMunicipalities(account: NonNullable<Awaited<ReturnType<typeof getAccount>>>) {
  const { data, error } = await account.supabase.rpc("vf_admin_municipalities");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function GET() {
  const auth = await getGeneralAdm();
  if (auth.response) return auth.response;

  try {
    return Response.json({ municipalities: await listMunicipalities(auth.account!) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar os municípios." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await getGeneralAdm();
  if (auth.response) return auth.response;
  const account = auth.account!;

  const body = (await request.json()) as {
    action?: "invite_master" | "activate";
    municipalityId?: number;
    name?: string;
    email?: string;
  };
  const municipalityId = Number(body.municipalityId);

  if (!Number.isInteger(municipalityId) || municipalityId <= 0) {
    return Response.json({ error: "Município inválido." }, { status: 400 });
  }

  let result: unknown = null;
  let error: { message: string } | null = null;

  if (body.action === "invite_master") {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!name || !email || !email.includes("@")) {
      return Response.json({ error: "Informe nome e e-mail válidos para o Master." }, { status: 400 });
    }
    const response = await account.supabase.rpc("vf_invite_configuring_municipality_master", {
      p_municipality_id: municipalityId,
      p_name: name,
      p_email: email,
    });
    result = response.data;
    error = response.error;
  } else if (body.action === "activate") {
    const response = await account.supabase.rpc("vf_activate_municipality", {
      p_municipality_id: municipalityId,
    });
    result = response.data;
    error = response.error;
  } else {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }

  if (error) return Response.json({ error: error.message }, { status: 400 });

  try {
    return Response.json({ result, municipalities: await listMunicipalities(account) });
  } catch {
    return Response.json({ result });
  }
}
