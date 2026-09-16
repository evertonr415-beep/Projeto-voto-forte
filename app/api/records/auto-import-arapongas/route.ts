import { getAccount, getVisibleUsers } from "../../../server-identity";

export const dynamic = "force-dynamic";

type ContactInput = {
  nome: string;
  telefone: string;
  bairro?: string;
  rua?: string;
  numero?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  perfil?: string;
  cpf?: string;
};

function normalizePhone(value: unknown) {
  let normalized = String(value ?? "").replace(/\D/g, "");
  if ((normalized.length === 12 || normalized.length === 13) && normalized.startsWith("55"))
    normalized = normalized.slice(2);
  return normalized;
}

export async function POST(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (account.accessRole !== "adm" && account.accessRole !== "gestor") {
    return Response.json(
      { error: "Apenas ADM ou Gestor podem executar esta importação." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    contacts?: ContactInput[];
    ownerEmail?: string;
  };

  if (!Array.isArray(body.contacts) || !body.contacts.length) {
    return Response.json({ error: "Nenhum contato enviado" }, { status: 400 });
  }

  const targetEmail = String(body.ownerEmail || account.email)
    .trim()
    .toLowerCase();
  const visibleUsers = await getVisibleUsers(account);
  const targetVisible = visibleUsers.find(
    (user) =>
      user.status === "active" &&
      String(user.email).trim().toLowerCase() === targetEmail,
  );

  const isOwnTarget = targetEmail === String(account.email).trim().toLowerCase();
  if (!targetVisible && !isOwnTarget) {
    return Response.json(
      { error: "Você não possui acesso ao responsável informado." },
      { status: 403 },
    );
  }

  const targetUserId = Number(targetVisible?.id ?? account.id);
  const targetAuthUserId = String(
    targetVisible?.auth_user_id ?? account.auth_user_id ?? "",
  ).trim();
  const targetAccessRole = String(
    targetVisible?.access_role ?? (isOwnTarget ? account.accessRole : ""),
  );

  if (
    !Number.isInteger(targetUserId) ||
    targetUserId <= 0 ||
    !targetAuthUserId ||
    targetAccessRole === "eleitor"
  ) {
    return Response.json(
      {
        error:
          "O responsável informado não possui um vínculo ativo compatível com importação de contatos.",
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const records = body.contacts.map((c) => {
    const phoneNorm = normalizePhone(c.telefone);
    return {
      owner_id: targetAuthUserId,
      owner_email: targetEmail,
      assigned_user_id: targetUserId,
      kind: "contact",
      payload: {
        name: String(c.nome || "").trim(),
        phone: String(c.telefone || "").trim(),
        phoneNormalized: phoneNorm,
        district: String(c.bairro || "").trim(),
        street: String(c.rua || "").trim(),
        number: String(c.numero || "").trim(),
        cep: String(c.cep || "").trim(),
        city: String(c.cidade || "Arapongas").trim(),
        state: String(c.uf || "PR").trim(),
        kind: c.perfil === "Liderança" ? "Liderança" : "Eleitor",
        cpf: String(c.cpf || "").trim(),
        importBatchId: "direct_arapongas_import_2026",
      },
      updated_at: now,
    };
  });

  // Usa a sessão autenticada para que as políticas RLS validem município,
  // hierarquia e destinatário. Esta rota não usa mais service_role.
  const { data, error } = await account.supabase
    .from("vf_owned_records")
    .insert(records)
    .select("id");

  if (error) {
    console.error("Auto import error:", error);
    return Response.json({ error: error.message }, { status: 400 });
  }

  await account.supabase.from("vf_audit_logs").insert({
    actor_id: account.auth_user_id,
    actor_email: account.email,
    action: "Importação automática de contatos",
    detail: `${data?.length ?? records.length} contatos importados para ${targetEmail}`,
  });

  return Response.json({
    success: true,
    count: data ? data.length : records.length,
  });
}
