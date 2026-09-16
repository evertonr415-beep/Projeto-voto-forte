import { getAccount } from "../../../server-identity";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!(["adm", "gestor"] as string[]).includes(account.accessRole)) {
    return Response.json(
      { error: "Acesso restrito à Administração." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const role = (url.searchParams.get("role") || "").trim().toLowerCase();
  if (role !== "lideranca") {
    return Response.json({ error: "Nível inválido." }, { status: 400 });
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, numberParam(url.searchParams.get("limit"), DEFAULT_LIMIT)),
  );
  const offset = Math.max(0, numberParam(url.searchParams.get("offset"), 0));

  const { data, error, count } = await account.supabase
    .from("vf_owned_records")
    .select("id,owner_email,payload,created_at", { count: "exact" })
    .eq("kind", "contact")
    .eq("payload->>kind", "Liderança")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const items = (data ?? []).map((row: Record<string, unknown>) => {
    const payload =
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {};

    return {
      id: Number(row.id),
      name: String(payload.name ?? "Liderança sem nome"),
      phone: String(payload.phone ?? ""),
      email: String(payload.email ?? ""),
      district: String(payload.district ?? ""),
      city: String(payload.city ?? ""),
      ownerEmail: String(row.owner_email ?? ""),
      createdAt: String(row.created_at ?? ""),
      payload,
    };
  });

  return Response.json({
    role: "lideranca",
    total: count ?? items.length,
    offset,
    limit,
    items,
  });
}
