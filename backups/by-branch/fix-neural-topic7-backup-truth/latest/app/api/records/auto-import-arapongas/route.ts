import { getAutonomousSupabase } from "../../../supabase-server";
import { getAccount, isAdministrator } from "../../../server-identity";

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
  const isAdmin = account && (account.accessRole === "adm" || account.accessRole === "gestor" || isAdministrator(account.role));
  
  const body = (await request.json()) as {
    contacts: ContactInput[];
    ownerEmail?: string;
  };

  if (!Array.isArray(body.contacts) || !body.contacts.length) {
    return Response.json({ error: "Nenhum contato enviado" }, { status: 400 });
  }

  const targetEmail = body.ownerEmail?.trim().toLowerCase() || (account ? account.email : "evertonr415@gmail.com");
  const supabase = getAutonomousSupabase();

  const now = new Date().toISOString();
  const records = body.contacts.map((c) => {
    const phoneNorm = normalizePhone(c.telefone);
    return {
      owner_id: account?.auth_user_id || "00000000-0000-0000-0000-000000000000",
      owner_email: targetEmail,
      kind: "contact",
      payload: {
        name: c.nome.trim(),
        phone: c.telefone.trim(),
        phoneNormalized: phoneNorm,
        district: (c.bairro || "").trim(),
        street: (c.rua || "").trim(),
        number: (c.numero || "").trim(),
        cep: (c.cep || "").trim(),
        city: (c.cidade || "Arapongas").trim(),
        state: (c.uf || "PR").trim(),
        kind: c.perfil === "Liderança" ? "Liderança" : "Eleitor",
        cpf: (c.cpf || "").trim(),
        importBatchId: "direct_arapongas_import_2026",
      },
      updated_at: now,
    };
  });

  const { data, error } = await supabase
    .from("vf_owned_records")
    .insert(records)
    .select("id");

  if (error) {
    console.error("Auto import error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    count: data ? data.length : records.length,
  });
}
