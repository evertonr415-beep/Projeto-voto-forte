import { getAccount } from "../../server-identity";
import { getServerSupabase } from "../../supabase-server";

type SessionAccessState =
  | "active"
  | "profile_inactive"
  | "email_unconfirmed"
  | "invitation_ready"
  | "awaiting_adm_activation";

type SessionAccessStatus = {
  state: SessionAccessState;
  message: string;
  suggestedAction?: string;
  canEnterApplication?: boolean;
  canClaimInvitation?: boolean;
  requiresAdmReview?: boolean;
  email?: string;
  emailConfirmed?: boolean;
};

async function getAuthenticatedContext() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { supabase, user };
}

async function getAccessStatus(
  supabase: NonNullable<Awaited<ReturnType<typeof getServerSupabase>>>,
) {
  const { data, error } = await supabase.rpc("vf_session_access_status");
  if (error || !data) return null;
  return data as SessionAccessStatus;
}

async function activeSessionResponse(
  access: SessionAccessStatus,
  authUserId: string,
) {
  const account = await getAccount();
  if (!account) {
    return Response.json(
      {
        access: {
          ...access,
          state: "profile_inactive",
          message: "Seu perfil Voto Forte não está disponível para acesso. Procure o ADM responsável.",
          canEnterApplication: false,
          requiresAdmReview: true,
        },
      },
      { status: 200 },
    );
  }

  await account.supabase
    .from("vf_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("auth_user_id", authUserId);

  return Response.json({
    access,
    user: {
      email: account.email,
      name: account.name,
      role: account.role,
      accessRole: account.accessRole,
    },
  });
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) {
    return Response.json(
      { error: "Sessão inválida ou expirada." },
      { status: 401 },
    );
  }

  const access = await getAccessStatus(context.supabase);
  if (!access) {
    return Response.json(
      { error: "Não foi possível validar o estado de acesso desta conta." },
      { status: 503 },
    );
  }

  if (access.state !== "active") return Response.json({ access });
  return activeSessionResponse(access, context.user.id);
}

export async function POST() {
  const context = await getAuthenticatedContext();
  if (!context) {
    return Response.json(
      { error: "Sessão inválida ou expirada." },
      { status: 401 },
    );
  }

  const currentAccess = await getAccessStatus(context.supabase);
  if (!currentAccess) {
    return Response.json(
      { error: "Não foi possível validar o estado de acesso desta conta." },
      { status: 503 },
    );
  }

  if (currentAccess.state !== "invitation_ready") {
    return Response.json(
      {
        access: currentAccess,
        error: "Esta conta não possui um convite pronto para ativação.",
      },
      { status: 409 },
    );
  }

  const { error: claimError } = await context.supabase.rpc(
    "vf_claim_user_invitation",
  );
  if (claimError) {
    return Response.json(
      { access: currentAccess, error: claimError.message },
      { status: 400 },
    );
  }

  const access = await getAccessStatus(context.supabase);
  if (!access) {
    return Response.json(
      { error: "O convite foi processado, mas o acesso não pôde ser revalidado." },
      { status: 503 },
    );
  }

  if (access.state !== "active") return Response.json({ access });
  return activeSessionResponse(access, context.user.id);
}
