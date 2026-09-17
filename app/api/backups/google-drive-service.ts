/**
 * Serviço de Integração e Sincronização Autônoma com Google Drive
 * VOTO FORTE PARANÁ
 */

export interface GoogleDriveBackupOptions {
  filename?: string;
  webhookUrl?: string;
  folderId?: string;
}

export interface GoogleDriveSyncResult {
  success: boolean;
  message: string;
  filename?: string;
  fileId?: string;
  folderId?: string;
  viewUrl?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Envia o payload de backup completo diretamente para o Google Drive
 */
export async function sendBackupToGoogleDrive(
  backupPayload: Record<string, unknown>,
  options: GoogleDriveBackupOptions = {}
): Promise<GoogleDriveSyncResult> {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);
  const timeStr = timestamp.slice(11, 16).replace(":", "h");
  
  const filename =
    options.filename ||
    `VotoForte-Backup-Automatico-${dateStr}-${timeStr}.json`;

  const folderId =
    options.folderId ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    "1LePlbjMOWjjiNG7EWFLYfZrDmRAWONkU";

  const webhookUrl =
    options.webhookUrl ||
    process.env.GOOGLE_DRIVE_WEBHOOK_URL ||
    process.env.GDRIVE_BACKUP_WEBHOOK_URL;

  // 1. Tentativa via Google Apps Script Webhook (Método Direto e Confiável)
  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "save_backup",
          filename,
          mimeType: "application/json",
          data: backupPayload,
          metadata: {
            system: "VOTO FORTE PARANÁ",
            version: "2.5.0",
            timestamp,
            itemCount: (backupPayload.stats as { totalContacts?: number })?.totalContacts || 0,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Google Drive Webhook retornou status HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json().catch(() => ({ status: "ok" }));
      return {
        success: true,
        message: "Backup enviado e salvo no Google Drive com sucesso!",
        filename,
        fileId: result.fileId || result.id,
        folderId: result.folderId || options.folderId,
        viewUrl: result.viewUrl || result.url,
        timestamp,
        details: result,
      };
    } catch (webhookErr) {
      console.error("[Google Drive Backup] Erro no Webhook:", webhookErr);
      return {
        success: false,
        message: `Falha ao enviar para o Google Drive via Webhook: ${webhookErr instanceof Error ? webhookErr.message : "Erro desconhecido"}`,
        filename,
        timestamp,
      };
    }
  }

  // 2. Sem Webhook configurado: Retorna instruções para habilitar
  return {
    success: false,
    message:
      "URL do Webhook do Google Drive não configurada. Configure a variável GOOGLE_DRIVE_WEBHOOK_URL ou defina a URL no painel para upload automático.",
    filename,
    timestamp,
  };
}

/**
 * Realiza teste de conexão e gravação na pasta do Google Drive
 */
export async function testGoogleDriveConnection(
  webhookUrl?: string
): Promise<{ success: boolean; message: string; details?: unknown }> {
  const targetUrl =
    webhookUrl ||
    process.env.GOOGLE_DRIVE_WEBHOOK_URL ||
    process.env.GDRIVE_BACKUP_WEBHOOK_URL;

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return {
      success: false,
      message: "Nenhuma URL de Webhook do Google Drive foi configurada.",
    };
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ping",
        test: true,
        timestamp: new Date().toISOString(),
        system: "VOTO FORTE PARANÁ - Teste de Conexão",
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        success: false,
        message: `Servidor do Google Drive respondeu com status ${response.status}: ${errText}`,
      };
    }

    const data = await response.json().catch(() => ({ status: "ok" }));
    return {
      success: true,
      message: "Conexão com a pasta do Google Drive estabelecida com sucesso!",
      details: data,
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao conectar com o Google Drive: ${error instanceof Error ? error.message : "Erro de conexão"}`,
    };
  }
}
