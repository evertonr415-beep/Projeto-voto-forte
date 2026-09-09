import { NextRequest, NextResponse } from "next/server";

const TERRITORIAL_API_PREFIX = "/api/territorial-pending";

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith(TERRITORIAL_API_PREFIX)) {
    return NextResponse.next();
  }

  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const sessionUrl = new URL("/api/session", request.url);
    const sessionResponse = await fetch(sessionUrl, {
      method: "GET",
      headers: { authorization },
      cache: "no-store",
    });
    const sessionData = await sessionResponse.json().catch(() => ({}));

    if (
      !sessionResponse.ok ||
      sessionData?.access?.state !== "active" ||
      sessionData?.user?.accessRole !== "adm"
    ) {
      return NextResponse.json(
        { error: "Somente o ADM pode acessar pendências territoriais" },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Não foi possível validar a permissão administrativa" },
      { status: 503 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/territorial-pending/:path*"],
};
