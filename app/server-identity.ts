import { getServerSupabase } from "./supabase-server";

export const OWNER_EMAIL = "evertonr415@gmail.com";
export type UserRole = "adm" | "master" | "lideranca" | "liderado" | "eleitor";
export type UiRole = "master" | "admin" | "user";

export type HierarchyUser = {
  id: number;
  auth_user_id: string;
  email: string;
  name: string;
  role: string;
  access_role: UserRole;
  status: "active" | "blocked";
  parent_user_id: number | null;
  last_seen_at?: string | null;
  created_at?: string;
};

function uiRoleFor(accessRole: UserRole): UiRole {
  if (accessRole === "adm") return "master";
  if (accessRole === "eleitor") return "user";
  return "admin";
}

export async function getAccount() {
  const supabase = await getServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;

  let { data: account } = await supabase
    .from("vf_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account) {
    const claim = await supabase.rpc("vf_claim_user_invitation");
    if (claim.error) return null;

    const result = await supabase
      .from("vf_users")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    account = result.data;
  }

  if (!account || account.status === "blocked") return null;

  await supabase
    .from("vf_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  const accessRole = account.access_role as UserRole;
  return {
    ...account,
    role: uiRoleFor(accessRole),
    accessRole,
    supabase,
  };
}

export function isAdministrator(role: string) {
  return role === "master" || role === "admin";
}

export function canManageHierarchy(role: UserRole) {
  return role !== "eleitor";
}

export function childRoleFor(role: UserRole): UserRole | null {
  if (role === "adm") return "master";
  if (role === "master") return "lideranca";
  if (role === "lideranca") return "liderado";
  if (role === "liderado") return "eleitor";
  return null;
}

export function canCreateRole(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === "adm") return targetRole !== "adm";
  return childRoleFor(actorRole) === targetRole;
}

export async function getVisibleUsers(
  account: Awaited<ReturnType<typeof getAccount>>,
): Promise<HierarchyUser[]> {
  if (!account) return [];

  const { data } = await account.supabase
    .from("vf_users")
    .select("id,auth_user_id,email,name,role,access_role,status,parent_user_id,last_seen_at,created_at")
    .order("name");
  return (data ?? []) as HierarchyUser[];
}

export async function canManageUser(
  account: Awaited<ReturnType<typeof getAccount>>,
  targetId: number,
) {
  if (!account || Number(account.id) === targetId) return false;
  const visible = await getVisibleUsers(account);
  const target = visible.find((user) => Number(user.id) === targetId);
  if (!target || target.access_role === "adm") return false;
  if (account.accessRole === "adm") return true;
  return (
    Number(target.parent_user_id) === Number(account.id) &&
    childRoleFor(account.accessRole) === target.access_role
  );
}
