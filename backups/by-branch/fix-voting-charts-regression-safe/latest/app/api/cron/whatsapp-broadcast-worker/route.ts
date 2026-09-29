import { processWhatsappQueue } from "../../whatsapp/queue-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  const cronSchedule = request.headers.get("x-vercel-cron-schedule") || "";

  const authorizedBySecret =
    Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;
  const authorizedByVercelCron =
    process.env.VERCEL_ENV === "production" && cronSchedule === "* * * * *";

  if (!authorizedBySecret && !authorizedByVercelCron) {
    return Response.json(
      { error: "Não autorizado" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await processWhatsappQueue({
      budgetMs: 48_000,
      maxItems: 45,
    });
    return Response.json(
      {
        success: true,
        worker: "whatsapp-server-queue",
        ...result,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[whatsapp-queue-worker] fatal", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Falha no worker da fila.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
