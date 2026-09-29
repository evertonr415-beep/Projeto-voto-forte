import { createHash } from "crypto";
import { getWhatsappAdminClient } from "../../whatsapp/admin";
import { GET as baseGET, POST as basePOST } from "../arapongas-preview/route";

const SENATOR_EVENT_TYPE = "web_poll_arapongas_senator_v1";
const POLL_ID = "arapongas-preview-v3";
const SENATOR_CANDIDATES = [
  "alexandre_curi",
  "cristina_graeml",
  "deltan_dallagnol",
  "filipe_barros",
  "gleisi",
  "dr_rosinha",
  "outro",
  "branco_nulo",
  "ainda_nao_sei",
] as const;

type SenatorCandidate = (typeof SENATOR_CANDIDATES)[number];
type RankingItem = { candidate: string; votes: number; percentage: number };

function isSenatorCandidate(value: string): value is SenatorCandidate {
  return (SENATOR_CANDIDATES as readonly string[]).includes(value);
}

function participantKey(participantId: unknown, phone: unknown) {
  const raw = `${String(participantId || "").trim()}|${String(phone || "").replace(/\D/g, "")}`;
  if (!raw.replace("|", "")) return "";
  return createHash("sha256").update(`${POLL_ID}:senator:${raw}`).digest("hex");
}

function zeroCounts() {
  return Object.fromEntries(SENATOR_CANDIDATES.map((candidate) => [candidate, 0])) as Record<string, number>;
}

function toRanking(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .map(([candidate, votes]) => ({
      candidate,
      votes,
      percentage: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.candidate.localeCompare(b.candidate));
}

async function separateSenatorCounts() {
  const supabase = getWhatsappAdminClient();
  if (!supabase) return zeroCounts();

  const { data, error } = await supabase
    .from("vf_whatsapp_events")
    .select("message_text")
    .eq("event_type", SENATOR_EVENT_TYPE)
    .order("occurred_at", { ascending: false })
    .limit(5000);

  if (error) throw error;

  const counts = zeroCounts();
  for (const row of data || []) {
    try {
      const parsed = JSON.parse(String(row.message_text || ""));
      const candidate = String(parsed?.q10 || "");
      if (isSenatorCandidate(candidate)) counts[candidate] += 1;
    } catch {
      // Ignora registros antigos ou inválidos.
    }
  }
  return counts;
}

async function mergedSenatorRanking(baseRanking: RankingItem[] | undefined) {
  const counts = zeroCounts();
  for (const item of Array.isArray(baseRanking) ? baseRanking : []) {
    if (isSenatorCandidate(String(item.candidate))) {
      counts[item.candidate] += Number(item.votes || 0);
    }
  }

  const extra = await separateSenatorCounts();
  for (const candidate of SENATOR_CANDIDATES) counts[candidate] += extra[candidate] || 0;
  return toRanking(counts);
}

function jsonFromBase(response: Response, body: unknown) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.delete("Content-Length");
  return new Response(JSON.stringify(body), { status: response.status, headers });
}

async function saveSenatorVote(body: Record<string, unknown>, candidate: SenatorCandidate) {
  const key = participantKey(body.participantId, body.phone);
  if (!key) return;

  const supabase = getWhatsappAdminClient();
  if (!supabase) throw new Error("Armazenamento da enquete não configurado.");

  const { data: existing, error: existingError } = await supabase
    .from("vf_whatsapp_events")
    .select("id")
    .eq("event_type", SENATOR_EVENT_TYPE)
    .eq("phone", key)
    .limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) return;

  const { error: insertError } = await supabase.from("vf_whatsapp_events").insert({
    direction: "inbound",
    event_type: SENATOR_EVENT_TYPE,
    status: "received",
    phone: key,
    contact_name: "Participante da enquete",
    message_type: "survey",
    message_text: JSON.stringify({ poll: POLL_ID, q10: candidate }),
    occurred_at: new Date().toISOString(),
    payload: { source: "web_poll", poll: POLL_ID, office: "senator", candidate },
  });
  if (insertError) throw insertError;
}

export async function GET() {
  const response = await baseGET();
  const data = await response.clone().json().catch(() => null);
  if (!response.ok || !data) return response;

  try {
    return jsonFromBase(response, {
      ...data,
      senatorRanking: await mergedSenatorRanking(data.senatorRanking),
    });
  } catch (error) {
    console.error("[arapongas-senator] results failed", error);
    return response;
  }
}

export async function POST(request: Request) {
  const cloned = request.clone();
  const body = await cloned.json().catch(() => ({} as Record<string, unknown>));
  const action = String(body.action || "submit");

  if (action !== "submit") return basePOST(request);

  const q10 = String(body.q10 || "");
  if (!isSenatorCandidate(q10)) {
    return Response.json({ error: "Selecione uma opção para Senador pelo Paraná." }, { status: 400 });
  }

  const response = await basePOST(request);
  const data = await response.clone().json().catch(() => null);

  if (!data) return response;

  if ((response.ok && data.success) || response.status === 409 || data.alreadyAnswered) {
    try {
      await saveSenatorVote(body, q10);
      return jsonFromBase(response, {
        ...data,
        senatorRanking: await mergedSenatorRanking(data.senatorRanking),
      });
    } catch (error) {
      console.error("[arapongas-senator] vote save failed", error);
      return Response.json(
        { error: "O voto principal foi registrado, mas não foi possível salvar a opção de senador nesta tentativa." },
        { status: 500 },
      );
    }
  }

  return response;
}