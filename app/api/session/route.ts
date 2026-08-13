import { getAccount } from "../../server-identity";

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error: "Conta não liberada ou sessão inválida." }, { status: 401 });

  return Response.json({
    user: {
      email: account.email,
      name: account.name,
      role: account.role,
      accessRole: account.accessRole,
    },
  });
}
