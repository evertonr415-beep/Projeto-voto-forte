import { getServerSupabase } from "../../supabase-server";

export async function POST() {
  const supabase = await getServerSupabase();
  if (!supabase) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Sessão inválida" }, { status: 401 });

  const municipalityName = String(user.user_metadata?.municipalityName ?? "").trim();
  const state = String(user.user_metadata?.municipalityState ?? "PR").trim().toUpperCase();
  if (!municipalityName) return Response.json({ status: "no_request" });

  const { data, error } = await supabase.rpc("vf_register_signup_request", {
    p_municipality_name: municipalityName,
    p_state: state,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ request: data });
}
