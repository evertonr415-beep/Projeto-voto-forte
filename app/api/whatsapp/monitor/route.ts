export const dynamic = "force-dynamic";

function forwardHeaders(request: Request) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  if (cookie) headers.set("cookie", cookie);
  if (authorization) headers.set("authorization", authorization);
  return headers;
}

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url);
  const liveUrl = new URL("/api/whatsapp/live-feed", sourceUrl.origin);
  const surveyUrl = new URL("/api/whatsapp/survey", sourceUrl.origin);

  for (const [key, value] of sourceUrl.searchParams.entries()) {
    liveUrl.searchParams.set(key, value);
  }

  const headers = forwardHeaders(request);

  const [liveResponse, surveyResponse] = await Promise.all([
    fetch(liveUrl, { cache: "no-store", headers }),
    fetch(surveyUrl, { cache: "no-store", headers }),
  ]);

  const liveData = await liveResponse.json().catch(() => null);
  if (!liveResponse.ok || !liveData?.success) {
    return Response.json(
      {
        success: false,
        error: "Não foi possível carregar o monitor de envios.",
        sourceStatus: liveResponse.status,
      },
      { status: liveResponse.ok ? 502 : liveResponse.status },
    );
  }

  const surveyData = await surveyResponse.json().catch(() => null);
  const surveyTotal = Number(
    surveyData?.totalResponses ?? surveyData?.kpis?.totalResponses ?? liveData?.kpis?.repliedCount ?? 0,
  );
  const repliedCount = Number.isFinite(surveyTotal) ? surveyTotal : Number(liveData?.kpis?.repliedCount || 0);
  const deliveredCount = Number(liveData?.kpis?.deliveredCount || 0);
  const responseRate = deliveredCount > 0 ? Math.round((repliedCount / deliveredCount) * 1000) / 10 : 0;

  return Response.json(
    {
      ...liveData,
      success: true,
      totalResponses: repliedCount,
      kpis: {
        ...(liveData.kpis || {}),
        repliedCount,
        responseRate,
      },
      surveyKpis: surveyData?.kpis || null,
      dataSource: "survey-consolidated",
      synchronizedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
