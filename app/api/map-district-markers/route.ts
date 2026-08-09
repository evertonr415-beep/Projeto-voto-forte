import {
  getAccount,
  getVisibleUsers,
  isAdministrator,
} from "../../server-identity";

type DistrictSummaryItem = {
  district?: string;
  total?: number | string;
};

type DistrictBubbleItem = {
  district?: string;
  voters?: number | string;
  leaders?: number | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  resolved?: boolean;
};

function normalizeDistrict(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

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

  const [summaryResult, bubbleResult] = await Promise.all([
    account.supabase.rpc("vf_contact_dashboard_summary", {
      p_owner_emails: scopeEmails,
    }),
    account.supabase.rpc("vf_map_district_bubbles", {
      p_owner_emails: scopeEmails,
      p_profile: null,
    }),
  ]);

  if (summaryResult.error) {
    console.error("Failed to load district dashboard summary", summaryResult.error);
    return Response.json(
      { error: "Não foi possível carregar os totais dos bairros agora." },
      { status: 500 },
    );
  }

  if (bubbleResult.error) {
    console.error("Failed to load district geocodes", bubbleResult.error);
    return Response.json(
      { error: "Não foi possível carregar as posições dos bairros agora." },
      { status: 500 },
    );
  }

  const summary = (summaryResult.data ?? {}) as { districts?: DistrictSummaryItem[] };
  const totals = new Map<string, { district: string; total: number }>();

  for (const item of Array.isArray(summary.districts) ? summary.districts : []) {
    const district = String(item.district || "").trim();
    const key = normalizeDistrict(district);
    if (!district || !key) continue;
    totals.set(key, {
      district,
      total: Math.max(0, Number(item.total || 0)),
    });
  }

  const markers = (Array.isArray(bubbleResult.data) ? bubbleResult.data : [])
    .map((item: DistrictBubbleItem) => {
      const key = normalizeDistrict(item.district);
      const summaryItem = totals.get(key);
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      if (
        !summaryItem ||
        !item.resolved ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return null;
      }

      return {
        district: summaryItem.district,
        total: summaryItem.total,
        voters: Math.max(0, Number(item.voters || 0)),
        leaders: Math.max(0, Number(item.leaders || 0)),
        latitude,
        longitude,
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number((right as { total: number }).total) -
          Number((left as { total: number }).total) ||
        String((left as { district: string }).district).localeCompare(
          String((right as { district: string }).district),
          "pt-BR",
        ),
    );

  return Response.json(
    {
      scope,
      markers,
      resolvedDistricts: markers.length,
      representedContacts: markers.reduce(
        (sum, marker) => sum + Number((marker as { total: number }).total || 0),
        0,
      ),
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
