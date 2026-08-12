import { getServerSupabase } from "./supabase-server";

export const OWNER_EMAIL = "evertonr415@gmail.com";
export type UserRole = "master" | "gestor" | "lider" | "liderado";
export type AccessRole = "adm" | "master" | "lideranca" | "liderado" | "eleitor";

export type HierarchyUser = {
  id: number;
  auth_user_id: string;
  email: string;
  name: string;
  role: UserRole;
  access_role?: AccessRole;
  status: "active" | "blocked";
  parent_user_id: number | null;
  last_seen_at?: string | null;
  created_at?: string;
};

function legacyAccessRole(role: unknown, email: string): AccessRole {
  if (email === OWNER_EMAIL) return "adm";
  if (role === "master") return "master";
  if (role === "gestor" || role === "lider") return "lideranca";
  return "liderado";
}

function normalizeAccessRole(value: unknown, role: unknown, email: string): AccessRole {
  if (["adm", "master", "lideranca", "liderado", "eleitor"].includes(String(value))) {
    return value as AccessRole;
  }
  return legacyAccessRole(role, email);
}

export async function getAccount() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;

  const { data: existing } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: claimError } = await supabase.rpc("vf_claim_user_invitation");
    if (claimError) return null;
  }

  const { data: account } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!account || account.status === "blocked") return null;

  await supabase
    .from("vf_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  return {
    ...account,
    role: account.role as UserRole,
    accessRole: normalizeAccessRole(account.access_role, account.role, email),
    supabase,
  };
}

export function isAdministrator(role: string) {
  return role === "master" || role === "gestor" || role === "lider";
}

export function canCreateRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "master") return true;
  if (actorRole === "gestor")
    return targetRole === "lider" || targetRole === "liderado";
  if (actorRole === "lider") return targetRole === "liderado";
  return false;
}

export async function getVisibleUsers(
  account: Awaited<ReturnType<typeof getAccount>>,
): Promise<HierarchyUser[]> {
  if (!account) return [];

  const { data } = await account.supabase
    .from("vf_users")
    .select("*")
    .order("name");
  const users = (data ?? []) as HierarchyUser[];

  if (account.accessRole === "adm" || account.role === "master") return users;

  const visibleIds = new Set<number>([Number(account.id)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const user of users) {
      if (
        user.parent_user_id &&
        visibleIds.has(Number(user.parent_user_id)) &&
        !visibleIds.has(Number(user.id))
      ) {
        visibleIds.add(Number(user.id));
        changed = true;
      }
    }
  }

  return users.filter((user) => visibleIds.has(Number(user.id)));
}

export async function canManageUser(
  account: Awaited<ReturnType<typeof getAccount>>,
  targetId: number,
) {
  if (!account) return false;
  if (account.accessRole === "adm") return Number(account.id) !== targetId;
  const visible = await getVisibleUsers(account);
  return visible.some(
    (user) => Number(user.id) === targetId && Number(user.id) !== Number(account.id),
  );
}
