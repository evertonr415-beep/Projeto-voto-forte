import fs from "fs";
import path from "path";

// Carrega variáveis do .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
let token = process.env.META_WA_ACCESS_TOKEN;
let phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || "1319478581243565";

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (key === "META_WA_ACCESS_TOKEN") token = value;
      if (key === "META_WA_PHONE_NUMBER_ID") phoneNumberId = value;
    }
  }
}

const numbers = [
  "5543998037541",
  "5543996100248",
  "5543996098821",
  "5543999125154",
  "5543999868065",
  "5561983197408",
  "5543999709710",
];

const messageBody = `Olá! Tudo bem?

Estamos realizando uma rápida enquete cidadã para ouvir a população sobre as prioridades e o futuro de Arapongas.

Sua opinião é fundamental e leva menos de 1 minuto para responder. Acesse pelo link:
https://voto-forte-parana.vercel.app/enquete/arapongas`;

async function sendMessages() {
  if (!token || token.startsWith("SEU_TOKEN")) {
    console.error("❌ Token da Meta não configurado ou inválido.");
    process.exit(1);
  }

  console.log(`🚀 Iniciando disparo para ${numbers.length} contatos usando Phone ID: ${phoneNumberId}...`);

  for (let i = 0; i < numbers.length; i++) {
    const phone = numbers[i];
    console.log(`\n[${i + 1}/${numbers.length}] Enviando para +${phone}...`);

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: {
            preview_url: true,
            body: messageBody,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.messages?.[0]?.id) {
        console.log(`✅ Sucesso! ID da mensagem: ${data.messages[0].id}`);
      } else {
        console.error(`❌ Erro no envio para +${phone}:`, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`❌ Falha de rede para +${phone}:`, err.message);
    }

    // Intervalo de 800ms entre envios
    if (i < numbers.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  console.log("\n🎉 Disparo finalizado!");
}

sendMessages();
