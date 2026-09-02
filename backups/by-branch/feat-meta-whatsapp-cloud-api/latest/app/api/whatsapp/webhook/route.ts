import { createHash, timingSafeEqual } from "node:crypto";

const VERIFY_TOKEN_SHA256 =
  "a4ea82f416c023db35f58d005ff416c0e6a4f8be32986985d8e8efe92611f2a9";

function verifyToken(candidate: string): boolean {
  const candidateHash = createHash("sha256").update(candidate, "utf8").digest();
  const expectedHash = Buffer.from(VERIFY_TOKEN_SHA256, "hex");

  return (
    candidateHash.length === expectedHash.length &&
    timingSafeEqual(candidateHash, expectedHash)
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode") || "";
  const token = url.searchParams.get("hub.verify_token") || "";
  const challenge = url.searchParams.get("hub.challenge") || "";

  if (mode === "subscribe" && challenge && verifyToken(token)) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json(
    { error: "Webhook verification failed" },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      object?: string;
      entry?: unknown[];
    };

    console.info("[whatsapp-webhook] event received", {
      object: payload?.object || "unknown",
      entries: Array.isArray(payload?.entry) ? payload.entry.length : 0,
    });

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
