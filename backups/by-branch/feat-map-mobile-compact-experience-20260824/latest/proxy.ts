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

  // A rota /api/territorial-pending já valida a sessão e exige accessRole=adm.
  // Evitamos uma segunda chamada interna para /api/session aqui porque, em
  // deployments de preview protegidos, essa requisição interna pode perder o
  // contexto de autenticação do preview e bloquear um ADM legítimo com 403.
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/territorial-pending/:path*"],
};
