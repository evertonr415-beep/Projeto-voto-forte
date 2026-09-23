/**
 * RECEPTOR DE BACKUP AUTOMÁTICO - GOOGLE APPS SCRIPT
 * Sistema: VOTO FORTE PARANÁ
 * 
 * INSTRUÇÕES RÁPIDAS DE INSTALAÇÃO (1 MINUTO):
 * 1. Abra o Google Drive (https://drive.google.com)
 * 2. Crie uma pasta ou abra a pasta onde quer guardar os backups.
 * 3. Copie o ID da pasta (é o código no final da URL da pasta no navegador).
 *    Exemplo: https://drive.google.com/drive/folders/1ABC_XYZ123 -> ID: 1ABC_XYZ123
 * 4. Acesse: https://script.google.com e clique em "Novo projeto".
 * 5. Cole todo este código lá.
 * 6. Altere a variável FOLDER_ID abaixo com o ID da sua pasta.
 * 7. Clique em "Implantar" (Deploy) -> "Nova implantação" (New deployment).
 * 8. Escolha tipo: "Aplicativo da Web" (Web app).
 * 9. Em "Quem tem acesso" (Who has access), selecione: "Qualquer pessoa" (Anyone).
 * 10. Copie a "URL do app da Web" gerada e cole no Painel do Voto Forte ou na variável GOOGLE_DRIVE_WEBHOOK_URL.
 */

// 👉 ID DA SUA PASTA DO GOOGLE DRIVE CONFIGURADO:
var FOLDER_ID = "1LePlbjMOWjjiNG7EWFLYfZrDmRAWONkU";

function doPost(e) {
  try {
    var rawData = e.postData ? e.postData.contents : "";
    if (!rawData) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Nenhum dado recebido" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(rawData);

    // Se for teste de conexão
    if (payload.action === "ping" || payload.test) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "success",
          message: "Conexão com Google Drive estabelecida com sucesso!",
          timestamp: new Date().toISOString()
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Obter ou criar pasta de destino
    var folder;
    if (FOLDER_ID && FOLDER_ID !== "COLE_O_ID_DA_SUA_PASTA_AQUI") {
      try {
        folder = DriveApp.getFolderById(FOLDER_ID);
      } catch (errFolder) {
        folder = DriveApp.getRootFolder();
      }
    } else {
      // Se não especificou ID, salva na pasta raiz ou cria pasta VotoForte_Backups
      var folders = DriveApp.getFoldersByName("VotoForte_Backups");
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder("VotoForte_Backups");
      }
    }

    // Formatar nome do arquivo
    var filename = payload.filename || ("VotoForte-Backup-" + Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd_HHmm") + ".json");
    var fileContent = typeof payload.data === "string" ? payload.data : JSON.stringify(payload.data || payload, null, 2);

    // Criar arquivo na pasta
    var file = folder.createFile(filename, fileContent, MimeType.PLAIN_TEXT);
    file.setDescription("Backup automático do sistema VOTO FORTE PARANÁ gerado em " + new Date().toISOString());

    return ContentService.createTextOutput(
      JSON.stringify({
        status: "success",
        message: "Backup salvo com sucesso no Google Drive!",
        fileId: file.getId(),
        filename: filename,
        viewUrl: file.getUrl(),
        folderName: folder.getName(),
        sizeBytes: file.getSize(),
        createdAt: new Date().toISOString()
      })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: "error",
        message: error.toString()
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: "active",
      service: "VOTO FORTE - Google Drive Backup Receiver",
      ready: true,
      timestamp: new Date().toISOString()
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
