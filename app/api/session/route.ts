import { after } from "next/server";
import { getAccountForAuthenticatedUser } from "../../server-identity";
import { getServerSupabase } from "../../supabase-server";

const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;
const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

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

function shouldRefreshLastSeen(value: unknown, now: number) {
  if (typeof value !== "string" || !value) return true;
  const previous = Date.parse(value);
  return !Number.isFinite(previous) || now - previous >= LAST_SEEN_WRITE_INTERVAL_MS;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      ...PRIVATE_NO_STORE_HEADERS,
      ...(init.headers || {}),
    },
  });
}

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
  user: { id: string; email?: string },
): Promise<SessionAccessStatus | null> {
  try {
    const { data, error } = await supabase.rpc("vf_session_access_status");
    if (!error && data) return data as SessionAccessStatus;
  } catch (err) {
    console.error("Falha na RPC vf_session_access_status:", err);
  }

  const email = user.email?.trim().toLowerCase();
  // Fallback garantido para o ADM Principal (OWNER_EMAIL)
  if (email === "evertonr415@gmail.com") {
    return {
      state: "active",
      message: "Acesso administrativo principal liberado.",
      canEnterApplication: true,
      email: user.email,
    };
  }

  // Compatibilidade temporária para contas de Gestor já cadastradas.
  // O login não deve promover papel nem alterar vínculos municipais: essas
  // mudanças são administrativas e precisam passar pelas RPCs protegidas.
  if (
    email === "campanhaeleicaoxv@gmail.com" ||
    email === "threexdroid@gmail.com" ||
    email === "williammarquesmachado@gmail.com"
  ) {
    return {
      state: "active",
      message: "Acesso de Gestor liberado.",
      canEnterApplication: true,
      email: user.email,
    };
  }

  if (email) {
    const { data: userRow } = await supabase
      .from("vf_users")
      .select("*")
      .or(`auth_user_id.eq.${user.id},email.ilike.${email}`)
      .maybeSingle();

    if (userRow && userRow.status !== "blocked") {
      return {
        state: "active",
        message: "Acesso autorizado ao ambiente.",
        canEnterApplication: true,
        email: user.email,
      };
    }
  }

  return {
    state: "active",
    message: "Acesso autenticado.",
    canEnterApplication: true,
    email: user.email,
  };
}

async function activeSessionResponse(
  access: SessionAccessStatus,
  context: NonNullable<Awaited<ReturnType<typeof getAuthenticatedContext>>>,
) {
  const account = await getAccountForAuthenticatedUser(
    context.supabase,
    context.user,
  );
  if (!account) {
    return jsonResponse(
      {
        access: {
          ...access,
          state: "profile_inactive",
          message:
            "Seu perfil Voto Forte não está disponível para acesso. Procure o ADM responsável.",
          canEnterApplication: false,
          requiresAdmReview: true,
        },
      },
      { status: 200 },
    );
  }

  const now = Date.now();
  if (shouldRefreshLastSeen(account.last_seen_at, now)) {
    after(async () => {
      await context.supabase
        .from("vf_users")
        .update({ last_seen_at: new Date(now).toISOString() })
        .eq("auth_user_id", context.user.id);
    });
  }

  return jsonResponse({
    access,
    user: {
      email: account.email,
      name: account.name,
      // O dashboard legado habilita a area administrativa pelo campo role.
      // O accessRole continua sendo a fonte de verdade de autorizacao no servidor.
      role: account.accessRole === "gestor" ? "master" : account.role,
      accessRole: account.accessRole,
    },
  });
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) {
    return jsonResponse(
      { error: "Sessão inválida ou expirada." },
      { status: 401 },
    );
  }

  const access = await getAccessStatus(context.supabase, context.user);
  if (!access) {
    return jsonResponse(
      { error: "Não foi possível validar o estado de acesso desta conta." },
      { status: 503 },
    );
  }

  if (access.state !== "active") return jsonResponse({ access });
  return activeSessionResponse(access, context);
}

export async function POST() {
  const context = await getAuthenticatedContext();
  if (!context) {
    return jsonResponse(
      { error: "Sessão inválida ou expirada." },
      { status: 401 },
    );
  }

  const currentAccess = await getAccessStatus(context.supabase, context.user);
  if (!currentAccess) {
    return jsonResponse(
      { error: "Não foi possível validar o estado de acesso desta conta." },
      { status: 503 },
    );
  }

  if (currentAccess.state !== "invitation_ready") {
    return jsonResponse(
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
    return jsonResponse(
      { access: currentAccess, error: claimError.message },
      { status: 400 },
    );
  }

  const access = await getAccessStatus(context.supabase, context.user);
  if (!access) {
    return jsonResponse(
      {
        error:
          "O convite foi processado, mas o acesso não pôde ser revalidado.",
      },
      { status: 503 },
    );
  }

  if (access.state !== "active") return jsonResponse({ access });
  return activeSessionResponse(access, context);
}
