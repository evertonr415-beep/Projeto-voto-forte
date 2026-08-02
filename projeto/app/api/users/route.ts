import { getAccount, isAdministrator, OWNER_EMAIL } from "../../server-identity";

export async function GET() {
  const account = await getAccount();
  if (!account) return Response.json({ error:"Não autenticado" }, { status:401 });
  const admin = isAdministrator(account.role);
  let uq = account.supabase.from("vf_users").select("*").order("name");
  if (!admin) uq = uq.eq("auth_user_id",account.auth_user_id);
  let lq = account.supabase.from("vf_audit_logs").select("*").order("created_at",{ascending:false}).limit(admin?100:30);
  if (!admin) lq = lq.eq("actor_id",account.auth_user_id);
  const [{data:users},{data:logs}] = await Promise.all([uq,lq]);
  const mappedUsers=(users??[]).map((u:Record<string,unknown>)=>({email:u.email,name:u.name,role:u.role,status:u.status,lastSeenAt:u.last_seen_at,createdAt:u.created_at}));
  const mappedLogs=(logs??[]).map((l:Record<string,unknown>)=>({id:l.id,actorEmail:l.actor_email,action:l.action,detail:l.detail,createdAt:l.created_at}));
  return Response.json({users:mappedUsers,logs:mappedLogs,adminCount:mappedUsers.filter((u:{status:unknown;role:unknown})=>u.status==="active"&&(u.role==="master"||u.role==="admin")).length});
}

export async function PATCH(request:Request) {
  const account=await getAccount();
  if(!account||!isAdministrator(account.role)) return Response.json({error:"Acesso negado"},{status:403});
  const body=await request.json() as {email?:string;role?:"master"|"admin"|"user";status?:"active"|"blocked"};
  const email=body.email?.trim().toLowerCase()??"";
  if(!email||email===OWNER_EMAIL) return Response.json({error:"Alteração inválida"},{status:409});
  if(account.role!=="master"&&body.role&&body.role!=="user") return Response.json({error:"Somente o Administrador Master pode alterar administradores"},{status:403});
  const changes:Record<string,string>={}; if(body.role)changes.role=body.role;if(body.status)changes.status=body.status;
  const {error}=await account.supabase.from("vf_users").update(changes).eq("email",email);
  return error?Response.json({error:error.message},{status:400}):Response.json({ok:true});
}

export async function POST(){ return Response.json({error:"O usuário deve criar a própria conta na tela de acesso."},{status:400}); }
