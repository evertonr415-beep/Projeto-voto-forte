import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

const PROFILES = new Set(["Eleitor", "Liderança"]);

async function visibleEmails(
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>,
) {
  const users = await getVisibleUsers(account);
  const emails = users
    .filter((user) => user.status === "active")
    .map((user) => String(user.email).trim().toLowerCase());
  if (!emails.includes(account.email)) emails.push(account.email);
  return emails;
}

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account)
    return Response.json({ error: "Não autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOwner = url.searchParams.get("owner")?.trim().toLowerCase();
  const requestedProfile = url.searchParams.get("profile")?.trim() || "";
  const includeStats = url.searchParams.get("stats") === "1";

  const allVisibleEmails = await visibleEmails(account);
  let scopeEmails = [account.email];
  let scope = account.email;

  if (requestedOwner === "all" && isAdministrator(account.role)) {
    scopeEmails = allVisibleEmails;
    scope = "all";
  } else if (requestedOwner && allVisibleEmails.includes(requestedOwner)) {
    scopeEmails = [requestedOwner];
    scope = requestedOwner;
  } else if (requestedOwner && requestedOwner !== account.email) {
    return Response.json(
      { error: "Você não possui acesso a este ambiente" },
      { status: 403 },
    );
  }

  const profile = PROFILES.has(requestedProfile) ? requestedProfile : "";

  const exactPromise = account.supabase.rpc("vf_map_exact_contact_points", {
    p_owner_emails: scopeEmails,
    p_profile: profile || null,
  });

  const districtPromise = account.supabase.rpc("vf_map_district_bubbles", {
    p_owner_emails: scopeEmails,
    p_profile: profile || null,
  });

  const statsPromise = includeStats
    ? account.supabase.rpc("vf_map_scope_stats", {
        p_owner_emails: scopeEmails,
        p_profile: profile || null,
      })
    : Promise.resolve({ data: undefined, error: null });

  const [exactResult, districtResult, statsResult] = await Promise.all([
    exactPromise,
    districtPromise,
    statsPromise,
  ]);

  if (exactResult.error) {
    console.error("Failed to load exact map contacts", exactResult.error);
    return Response.json(
      { error: "Não foi possível carregar os pinos do mapa agora." },
      { status: 500 },
    );
  }

  if (districtResult.error) {
    console.error("Failed to load district bubbles", districtResult.error);
    return Response.json(
      { error: "Não foi possível carregar as bolhas dos bairros agora." },
      { status: 500 },
    );
  }

  if (statsResult.error) {
    console.error("Failed to load map stats", statsResult.error);
    return Response.json(
      { error: "Não foi possível carregar os totais do mapa agora." },
      { status: 500 },
    );
  }

  const features = Array.isArray(exactResult.data) ? exactResult.data : [];
  const bubbles = Array.isArray(districtResult.data) ? districtResult.data : [];

  let stats:
    | {
        totalContacts: number;
        mappedContacts: number;
        approximatedContacts: number;
        unresolvedContacts: number;
        resolvedDistricts: number;
      }
    | undefined;

  if (includeStats) {
    const row = Array.isArray(statsResult.data) ? statsResult.data[0] : undefined;
    const totalContacts = Number(row?.total_contacts ?? 0);
    const mappedContacts = Number(row?.mapped_contacts ?? features.length);
    const resolvedContacts = bubbles.reduce(
      (
        sum: number,
        item: { total?: number | string; resolved?: boolean },
      ) => sum + (item.resolved ? Number(item.total || 0) : 0),
      0,
    );

    stats = {
      totalContacts,
      mappedContacts,
      approximatedContacts: resolvedContacts,
      unresolvedContacts: Math.max(0, totalContacts - resolvedContacts),
      resolvedDistricts: bubbles.filter(
        (item: { resolved?: boolean }) => item.resolved,
      ).length,
    };
  }

  return Response.json(
    {
      scope,
      profile: profile || null,
      features,
      approximateDistricts: bubbles,
      stats,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
