import { createHash } from "crypto";
import { getWhatsappAdminClient } from "../../whatsapp/admin";

const EVENT_TYPE = "web_poll_arapongas_preview_v2";
const POLL_ID = "arapongas-preview-v2";

const STATE_CANDIDATES = ["sergio_onofre", "bazana", "nenhum_indeciso"] as const;
const FEDERAL_CANDIDATES = [
  "pedro_lupion",
  "luciano_ducci",
  "ricardo_barros",
  "bonin",
  "beto_preto",
  "outro_nome",
] as const;
const KNOWLEDGE_OPTIONS = ["sim", "alguns", "nao"] as const;

type VotePayload = {
  poll?: string;
  q1?: string;
  q2?: string;
  q3?: string;
};

function getSurveyDb() {
  const supabase = getWhatsappAdminClient();
  if (!supabase) {
    throw new Error("Armazenamento da enquete não configurado no ambiente de preview.");
  }
  return supabase;
}

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

function participantKey(participantId: unknown, phone: unknown) {
  const normalizedPhone = normalizePhone(phone);
  const deviceId = String(participantId || "").trim().slice(0, 160);
  const source = normalizedPhone ? `phone:${normalizedPhone}` : `device:${deviceId}`;

  if (!normalizedPhone && deviceId.length < 12) return "";

  return createHash("sha256")
    .update(`${POLL_ID}:${source}`)
    .digest("hex");
}

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return (allowed as readonly string[]).includes(value);
}

function parseVote(messageText: unknown): VotePayload | null {
  if (typeof messageText !== "string" || !messageText) return null;
  try {
    const parsed = JSON.parse(messageText) as VotePayload;
    if (parsed.poll !== POLL_ID) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getResults() {
  const supabase = getSurveyDb();
  const { data, error } = await supabase
    .from("vf_whatsapp_events")
    .select("message_text")
    .eq("event_type", EVENT_TYPE)
    .order("occurred_at", { ascending: false })
    .limit(5000);

  if (error) throw error;

  const stateCounts: Record<string, number> = Object.fromEntries(
    STATE_CANDIDATES.map((candidate) => [candidate, 0]),
  );
  const federalCounts: Record<string, number> = Object.fromEntries(
    FEDERAL_CANDIDATES.map((candidate) => [candidate, 0]),
  );

  let totalResponses = 0;

  for (const row of data || []) {
    const vote = parseVote(row.message_text);
    if (!vote) continue;

    totalResponses += 1;
    if (vote.q2 && isAllowed(vote.q2, STATE_CANDIDATES)) {
      stateCounts[vote.q2] += 1;
    }
    if (vote.q3 && isAllowed(vote.q3, FEDERAL_CANDIDATES)) {
      federalCounts[vote.q3] += 1;
    }
  }

  const toRanking = (counts: Record<string, number>) => {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return Object.entries(counts)
      .map(([candidate, votes]) => ({
        candidate,
        votes,
        percentage: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.votes - a.votes || a.candidate.localeCompare(b.candidate));
  };

  return {
    totalResponses,
    stateRanking: toRanking(stateCounts),
    federalRanking: toRanking(federalCounts),
  };
}

export async function GET() {
  try {
    return Response.json({ success: true, ...(await getResults()) });
  } catch (error) {
    console.error("[arapongas-preview-poll] results failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar resultados" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "submit");
    const key = participantKey(body.participantId, body.phone);

    if (!key) {
      return Response.json(
        { error: "Não foi possível identificar este navegador para validar a participação." },
        { status: 400 },
      );
    }

    const supabase = getSurveyDb();
    const { data: existing, error: existingError } = await supabase
      .from("vf_whatsapp_events")
      .select("id")
      .eq("event_type", EVENT_TYPE)
      .eq("phone", key)
      .limit(1);

    if (existingError) throw existingError;

    const alreadyAnswered = Boolean(existing && existing.length > 0);

    if (action === "status") {
      return Response.json({ success: true, alreadyAnswered });
    }

    if (action !== "submit") {
      return Response.json({ error: "Ação inválida" }, { status: 400 });
    }

    const q1 = String(body.q1 || "");
    const q2 = String(body.q2 || "");
    const q3 = String(body.q3 || "");

    if (
      !isAllowed(q1, KNOWLEDGE_OPTIONS) ||
      !isAllowed(q2, STATE_CANDIDATES) ||
      !isAllowed(q3, FEDERAL_CANDIDATES)
    ) {
      return Response.json({ error: "Responda corretamente às três perguntas." }, { status: 400 });
    }

    if (alreadyAnswered) {
      return Response.json(
        { success: false, alreadyAnswered: true, ...(await getResults()) },
        { status: 409 },
      );
    }

    const messageText = JSON.stringify({ poll: POLL_ID, q1, q2, q3 });
    const { error: insertError } = await supabase.from("vf_whatsapp_events").insert({
      direction: "inbound",
      event_type: EVENT_TYPE,
      status: "received",
      phone: key,
      contact_name: "Participante da enquete",
      message_type: "survey",
      message_text: messageText,
      occurred_at: new Date().toISOString(),
      payload: { source: "web_poll_preview", poll: POLL_ID },
    });

    if (insertError) throw insertError;

    return Response.json({
      success: true,
      alreadyAnswered: false,
      ...(await getResults()),
    });
  } catch (error) {
    console.error("[arapongas-preview-poll] submit failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao registrar resposta" },
      { status: 500 },
    );
  }
}
