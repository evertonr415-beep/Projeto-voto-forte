import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { recordWhatsappEvents, type WhatsappEventInsert } from "../admin";

const VERIFY_TOKEN_SHA256 =
  "a4ea82f416c023db35f58d005ff416c0e6a4f8be32986985d8e8efe92611f2a9";

function safeEqual(left: Buffer, right: Buffer) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyToken(candidate: string): boolean {
  const configured = process.env.META_WHATSAPP_VERIFY_TOKEN?.trim();
  if (configured) {
    return safeEqual(Buffer.from(candidate, "utf8"), Buffer.from(configured, "utf8"));
  }

  const candidateHash = createHash("sha256").update(candidate, "utf8").digest();
  const expectedHash = Buffer.from(VERIFY_TOKEN_SHA256, "hex");
  return safeEqual(candidateHash, expectedHash);
}

function verifySignature(rawBody: string, signature: string | null) {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) return true;
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
}

function eventTime(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstError(status: Record<string, unknown>) {
  const errors = Array.isArray(status.errors) ? status.errors : [];
  const error = asRecord(errors[0]);
  return {
    code: error.code == null ? null : String(error.code),
    message:
      error.title == null && error.message == null
        ? null
        : String(error.title || error.message || ""),
  };
}

function parseEvents(payload: Record<string, unknown>): WhatsappEventInsert[] {
  const events: WhatsappEventInsert[] = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const rawEntry of entries) {
    const entry = asRecord(rawEntry);
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const rawChange of changes) {
      const change = asRecord(rawChange);
      if (String(change.field || "") !== "messages") continue;
      const value = asRecord(change.value);

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactByWaId = new Map<string, string>();
      for (const rawContact of contacts) {
        const contact = asRecord(rawContact);
        const profile = asRecord(contact.profile);
        const waId = String(contact.wa_id || "");
        if (waId) contactByWaId.set(waId, String(profile.name || ""));
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const rawStatus of statuses) {
        const status = asRecord(rawStatus);
        const error = firstError(status);
        events.push({
          message_id: String(status.id || "") || null,
          direction: "status",
          event_type: "message_status",
          status: String(status.status || "") || null,
          phone: String(status.recipient_id || "") || null,
          error_code: error.code,
          error_message: error.message,
          occurred_at: eventTime(status.timestamp),
          payload: status,
        });
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const rawMessage of messages) {
        const message = asRecord(rawMessage);
        const type = String(message.type || "unknown");
        const from = String(message.from || "");
        const text = type === "text" ? String(asRecord(message.text).body || "") : "";
        events.push({
          message_id: String(message.id || "") || null,
          direction: "inbound",
          event_type: "message_received",
          status: "received",
          phone: from || null,
          contact_name: contactByWaId.get(from) || null,
          message_type: type,
          message_text: text || null,
          occurred_at: eventTime(message.timestamp),
          payload: message,
        });
      }
    }
  }

  return events;
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
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const events = parseEvents(payload);

    try {
      const result = await recordWhatsappEvents(events);
      console.info("[whatsapp-webhook] processed", {
        entries: Array.isArray(payload.entry) ? payload.entry.length : 0,
        events: events.length,
        stored: result.stored,
        storageConfigured: result.configured,
      });
    } catch (error) {
      console.error("[whatsapp-webhook] persistence failed", {
        events: events.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
