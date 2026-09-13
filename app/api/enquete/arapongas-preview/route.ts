import { createHash, createHmac, randomUUID } from "crypto";
import { getWhatsappAdminClient } from "../../whatsapp/admin";

const EVENT_TYPE = "web_poll_arapongas_preview_v3";
const POLL_ID = "arapongas-preview-v3";
const DEVICE_COOKIE = "vf_poll_device_v2";
const MAX_BODY_BYTES = 12_000;
const MAX_VOTES_PER_IP = 4;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 12;

const MANAGEMENT_OPTIONS = ["boa", "media", "ruim"] as const;
const MANAGEMENT_LABELS: Record<(typeof MANAGEMENT_OPTIONS)[number], string> = {
  boa: "Boa",
  media: "Média",
  ruim: "Ruim",
};
const KNOWLEDGE_OPTIONS = ["sim", "nao", "alguns_nao_lembro"] as const;
const DECISION_OPTIONS = ["sim", "nao", "indeciso"] as const;
const PRESIDENT_CANDIDATES = [
  "lula_pt", "flavio_bolsonaro_pl", "augusto_cury_avante", "renan_santos_missao",
  "ronaldo_caiado_psd", "romeu_zema_novo", "outro", "branco_nulo", "ainda_nao_sei",
] as const;
const GOVERNOR_CANDIDATES = [
  "sergio_moro_pl", "requiao_filho_pdt", "sandro_alex_psd", "luiz_franca_missao",
  "outro", "branco_nulo", "ainda_nao_sei",
] as const;
const FEDERAL_CANDIDATES = [
  "neto_santos", "ricardo_barros", "pedro_lupion", "beto_preto", "luciano_ducci",
  "bonin", "marco_brasil", "santin_roveda", "outro", "branco_nulo", "ainda_nao_sei",
] as const;
const STATE_CANDIDATES = [
  "pedro_paulo_bazana", "sergio_onofre", "aline_franzon", "delegado_jacovos",
  "cobra_reporter", "outro", "branco_nulo", "ainda_nao_sei",
] as const;

type VotePayload = {
  poll?: string;
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
  q5?: string;
  q6?: string;
  q7?: string;
  q8?: string;
  q9?: string;
};

type RateEntry = { startedAt: number; count: number };
const rateStore = new Map<string, RateEntry>();

function getSurveyDb() {
  const supabase = getWhatsappAdminClient();
  if (!supabase) throw new Error("Armazenamento da enquete não configurado.");
  return supabase;
}

function securitySecret() {
  const secret =
    process.env.POLL_SECURITY_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  if (!secret) throw new Error("Segredo de segurança da enquete não configurado.");
  return secret;
}

function digest(value: string) {
  return createHmac("sha256", securitySecret()).update(`${POLL_ID}:${value}`).digest("hex");
}

function parseCookies(request: Request) {
  const raw = request.headers.get("cookie") || "";
  return Object.fromEntries(
    raw.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      if (index < 0) return [part, ""];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }),
  );
}

function deviceIdentity(request: Request) {
  const cookies = parseCookies(request);
  const current = String(cookies[DEVICE_COOKIE] || "").trim();
  const valid = /^[a-f0-9-]{20,80}$/i.test(current);
  const raw = valid ? current : randomUUID();
  return { raw, key: digest(`device:${raw}`), shouldSetCookie: !valid };
}

function getClientIp(request: Request) {
  const trusted = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "";
  const first = trusted.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return first.slice(0, 128);
}

function browserSignal(request: Request) {
  return [
    request.headers.get("user-agent") || "",
    request.headers.get("accept-language") || "",
    request.headers.get("sec-ch-ua") || "",
    request.headers.get("sec-ch-ua-mobile") || "",
    request.headers.get("sec-ch-ua-platform") || "",
  ].join("|").slice(0, 1500);
}

function legacyParticipantKey(participantId: unknown, phone: unknown) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  const phoneValue = normalizedPhone.length >= 10 && normalizedPhone.length <= 15 ? normalizedPhone : "";
  const deviceId = String(participantId || "").trim().slice(0, 160);
  const source = phoneValue ? `phone:${phoneValue}` : `device:${deviceId}`;
  if (!phoneValue && deviceId.length < 12) return "";
  return createHash("sha256").update(`${POLL_ID}:${source}`).digest("hex");
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function rateAllowed(key: string) {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry || now - entry.startedAt >= RATE_WINDOW_MS) {
    rateStore.set(key, { startedAt: now, count: 1 });
    return true;
  }
  entry.count += 1;
  if (rateStore.size > 5000) {
    for (const [storedKey, stored] of rateStore) {
      if (now - stored.startedAt >= RATE_WINDOW_MS) rateStore.delete(storedKey);
    }
  }
  return entry.count <= RATE_MAX_REQUESTS;
}

function secureJson(body: unknown, init: ResponseInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  if (cookie) {
    headers.append(
      "Set-Cookie",
      `${DEVICE_COOKIE}=${encodeURIComponent(cookie)}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  return Response.json(body, { ...init, headers });
}

function isAllowed<T extends readonly string[]>(value: string, allowed: T): value is T[number] {
  return (allowed as readonly string[]).includes(value);
}

function parseVote(messageText: unknown): VotePayload | null {
  if (typeof messageText !== "string" || !messageText) return null;
  try {
    const parsed = JSON.parse(messageText) as VotePayload;
    return parsed.poll === POLL_ID ? parsed : null;
  } catch {
    return null;
  }
}

function emptyCounts(candidates: readonly string[]) {
  return Object.fromEntries(candidates.map((candidate) => [candidate, 0])) as Record<string, number>;
}

function toRanking(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .map(([candidate, votes]) => ({ candidate, votes, percentage: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.votes - a.votes || a.candidate.localeCompare(b.candidate));
}

function toManagementRanking(counts: Record<string, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return MANAGEMENT_OPTIONS
    .map((option) => ({ candidate: MANAGEMENT_LABELS[option], votes: counts[option] || 0, percentage: total > 0 ? Math.round((((counts[option] || 0) / total) * 1000)) / 10 : 0 }))
    .sort((a, b) => b.votes - a.votes || a.candidate.localeCompare(b.candidate, "pt-BR"));
}

async function getResults() {
  const supabase = getSurveyDb();
  const { data, error } = await supabase.from("vf_whatsapp_events").select("message_text")
    .eq("event_type", EVENT_TYPE).order("occurred_at", { ascending: false }).limit(5000);
  if (error) throw error;

  const presidentCounts = emptyCounts(PRESIDENT_CANDIDATES);
  const governorCounts = emptyCounts(GOVERNOR_CANDIDATES);
  const federalCounts = emptyCounts(FEDERAL_CANDIDATES);
  const stateCounts = emptyCounts(STATE_CANDIDATES);
  const managementCounts = emptyCounts(MANAGEMENT_OPTIONS);
  let totalResponses = 0;

  for (const row of data || []) {
    const vote = parseVote(row.message_text);
    if (!vote) continue;
    totalResponses += 1;
    if (vote.q2 && isAllowed(vote.q2, MANAGEMENT_OPTIONS)) managementCounts[vote.q2] += 1;
    if (vote.q6 && isAllowed(vote.q6, PRESIDENT_CANDIDATES)) presidentCounts[vote.q6] += 1;
    if (vote.q7 && isAllowed(vote.q7, GOVERNOR_CANDIDATES)) governorCounts[vote.q7] += 1;
    if (vote.q8 && isAllowed(vote.q8, FEDERAL_CANDIDATES)) federalCounts[vote.q8] += 1;
    if (vote.q9 && isAllowed(vote.q9, STATE_CANDIDATES)) stateCounts[vote.q9] += 1;
  }

  return {
    totalResponses,
    managementRanking: toManagementRanking(managementCounts),
    presidentRanking: toRanking(presidentCounts),
    governorRanking: toRanking(governorCounts),
    federalRanking: toRanking(federalCounts),
    stateRanking: toRanking(stateCounts),
  };
}

export async function GET() {
  try {
    return secureJson({ success: true, ...(await getResults()) });
  } catch (error) {
    console.error("[arapongas-preview-poll] results failed", error);
    return secureJson({ error: "Falha ao carregar resultados" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let device: ReturnType<typeof deviceIdentity> | null = null;
  try {
    if (!sameOrigin(request)) return secureJson({ error: "Origem da requisição não autorizada." }, { status: 403 });
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return secureJson({ error: "Formato de requisição inválido." }, { status: 415 });
    }
    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) return secureJson({ error: "Requisição excede o limite permitido." }, { status: 413 });

    device = deviceIdentity(request);
    const ipHash = digest(`ip:${getClientIp(request)}`);
    const browserHash = digest(`browser:${browserSignal(request)}`);
    if (!rateAllowed(ipHash)) {
      return secureJson({ error: "Muitas tentativas em pouco tempo. Tente novamente mais tarde." }, { status: 429 }, device.shouldSetCookie ? device.raw : undefined);
    }

    const body = await request.json();
    const action = String(body.action || "submit");
    const legacyKey = legacyParticipantKey(body.participantId, body.phone);
    const keys = [device.key, legacyKey].filter(Boolean);
    const supabase = getSurveyDb();

    const { data: existing, error: existingError } = await supabase.from("vf_whatsapp_events")
      .select("id").eq("event_type", EVENT_TYPE).in("phone", keys).limit(1);
    if (existingError) throw existingError;

    let alreadyAnswered = Boolean(existing && existing.length > 0);
    if (!alreadyAnswered) {
      const { data: sameDeviceNetwork, error: signalError } = await supabase.from("vf_whatsapp_events")
        .select("id").eq("event_type", EVENT_TYPE)
        .contains("payload", { poll: POLL_ID, ipHash, browserHash }).limit(1);
      if (signalError) throw signalError;
      alreadyAnswered = Boolean(sameDeviceNetwork && sameDeviceNetwork.length > 0);
    }

    if (action === "status") {
      return secureJson({ success: true, alreadyAnswered }, {}, device.shouldSetCookie ? device.raw : undefined);
    }
    if (action !== "submit") return secureJson({ error: "Ação inválida" }, { status: 400 }, device.shouldSetCookie ? device.raw : undefined);

    const q1 = String(body.q1 || "");
    const q2 = String(body.q2 || "");
    const q3 = String(body.q3 || "");
    const q4 = String(body.q4 || "");
    const q5 = String(body.q5 || "");
    const q6 = String(body.q6 || "");
    const q7 = String(body.q7 || "");
    const q8 = String(body.q8 || "");
    const q9 = String(body.q9 || "");

    if (!isAllowed(q1, MANAGEMENT_OPTIONS) || !isAllowed(q2, MANAGEMENT_OPTIONS) ||
      !isAllowed(q3, KNOWLEDGE_OPTIONS) || !isAllowed(q4, DECISION_OPTIONS) ||
      !isAllowed(q5, DECISION_OPTIONS) || !isAllowed(q6, PRESIDENT_CANDIDATES) ||
      !isAllowed(q7, GOVERNOR_CANDIDATES) || !isAllowed(q8, FEDERAL_CANDIDATES) ||
      !isAllowed(q9, STATE_CANDIDATES)) {
      return secureJson({ error: "Responda corretamente às nove perguntas." }, { status: 400 }, device.shouldSetCookie ? device.raw : undefined);
    }

    if (alreadyAnswered) {
      return secureJson({ success: false, alreadyAnswered: true, ...(await getResults()) }, { status: 409 }, device.shouldSetCookie ? device.raw : undefined);
    }

    const { data: sameIpVotes, error: ipError } = await supabase.from("vf_whatsapp_events")
      .select("id").eq("event_type", EVENT_TYPE).contains("payload", { poll: POLL_ID, ipHash }).limit(MAX_VOTES_PER_IP + 1);
    if (ipError) throw ipError;
    if ((sameIpVotes?.length || 0) >= MAX_VOTES_PER_IP) {
      return secureJson({ error: "Esta rede atingiu o limite de participações permitido para proteção contra fraude." }, { status: 429 }, device.shouldSetCookie ? device.raw : undefined);
    }

    const messageText = JSON.stringify({ poll: POLL_ID, q1, q2, q3, q4, q5, q6, q7, q8, q9 });
    const { error: insertError } = await supabase.from("vf_whatsapp_events").insert({
      direction: "inbound",
      event_type: EVENT_TYPE,
      status: "received",
      phone: device.key,
      contact_name: "Participante da enquete",
      message_type: "survey",
      message_text: messageText,
      occurred_at: new Date().toISOString(),
      payload: { source: "web_poll", poll: POLL_ID, ipHash, browserHash, antiFraudVersion: 2 },
    });
    if (insertError) throw insertError;

    return secureJson({ success: true, alreadyAnswered: false, ...(await getResults()) }, {}, device.shouldSetCookie ? device.raw : undefined);
  } catch (error) {
    console.error("[arapongas-preview-poll] submit failed", error);
    return secureJson({ error: "Falha ao registrar resposta" }, { status: 500 }, device?.shouldSetCookie ? device.raw : undefined);
  }
}
