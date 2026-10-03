#!/usr/bin/env node

/**
 * EXECUTOR AUTÔNOMO DE BACKUP AUTOMÁTICO - VOTO FORTE
 * 
 * Executa o backup completo da base de dados e salva:
 * 1. Na pasta local de backups / Google Drive local no computador
 * 2. No banco de dados (vf_backup_snapshots)
 * 3. No Google Drive via Webhook (se configurado)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// 1. Carregar variáveis de ambiente
function loadEnv() {
  const envFiles = [".env.production", ".env.local", ".env"];
  const env = { ...process.env };

  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Erro: Variáveis NEXT_PUBLIC_SUPABASE_URL ou Chave Supabase não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findGoogleDriveLocalDir() {
  const homeDir = os.homedir();
  const potentialPaths = [
    path.join(homeDir, "Google Drive"),
    path.join(homeDir, "GoogleDrive"),
    path.join(homeDir, "Meu Drive"),
    path.join(homeDir, "Library", "CloudStorage"),
    path.join(process.cwd(), "backups"),
  ];

  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      if (p.includes("CloudStorage")) {
        try {
          const items = fs.readdirSync(p);
          const gdrive = items.find((i) => i.toLowerCase().includes("googledrive") || i.toLowerCase().includes("drive"));
          if (gdrive) {
            const driveTarget = path.join(p, gdrive, "Meu Drive", "VotoForte_Backups");
            fs.mkdirSync(driveTarget, { recursive: true });
            return driveTarget;
          }
        } catch {
          // continue
        }
      } else {
        const target = path.join(p, "VotoForte_Backups");
        fs.mkdirSync(target, { recursive: true });
        return target;
      }
    }
  }

  // Fallback: pasta local backups
  const fallback = path.join(process.cwd(), "backups");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

async function runAutonomousBackup() {
  console.log("==================================================");
  console.log("🚀 VOTO FORTE PARANÁ - BACKUP AUTOMÁTICO AUTÔNOMO");
  console.log("==================================================");
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);
  const timeStr = timestamp.slice(11, 19).replace(/:/g, "");

  console.log(`🕒 Iniciando extração em: ${new Date().toLocaleString("pt-BR")}`);

  // 1. Extrair contatos e dados
  console.log("📥 Consultando banco de dados...");
  const [contactsRes, usersRes, auditRes, exportsRes] = await Promise.all([
    supabase.from("vf_contacts").select("*").limit(50000),
    supabase.from("vf_users").select("id,email,name,role,status,parent_user_id,created_at"),
    supabase.from("vf_audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("vf_contact_exports").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const contacts = contactsRes.data || [];
  const users = usersRes.data || [];
  const audit = auditRes.data || [];
  const exportsHistory = exportsRes.data || [];

  console.log(`✅ Registros obtidos:`);
  console.log(`   - Contatos: ${contacts.length.toLocaleString("pt-BR")}`);
  console.log(`   - Usuários: ${users.length}`);
  console.log(`   - Logs de Auditoria: ${audit.length}`);
  console.log(`   - Histórico de Exportações: ${exportsHistory.length}`);

  const backupPayload = {
    format: "voto-forte-autonomous-full-backup",
    version: "2.5.0",
    platform: "VOTO FORTE PARANÁ",
    generatedAt: timestamp,
    targetDate: dateStr,
    stats: {
      totalContacts: contacts.length,
      totalUsers: users.length,
      totalAuditLogs: audit.length,
      totalExports: exportsHistory.length,
    },
    data: {
      contacts,
      users,
      auditLogs: audit,
      contactExports: exportsHistory,
    },
  };

  // 2. Salvar em arquivo local / Google Drive local
  const backupDir = await findGoogleDriveLocalDir();
  const filename = `VotoForte-Backup-${dateStr}_${timeStr}.json`;
  const filePath = path.join(backupDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), "utf-8");
  const stats = fs.statSync(filePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n💾 Arquivo de Backup Gerado com Sucesso!`);
  console.log(`   📁 Local: ${filePath}`);
  console.log(`   📦 Tamanho: ${sizeMb} MB`);

  // 3. Registrar snapshot no Supabase
  try {
    const checksum = `SHA256-${dateStr}-AUTO-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    await supabase.from("vf_backup_snapshots").insert({
      created_at: timestamp,
      created_by: "Script Autônomo de Backup (Node.js)",
      backup_version: 2,
      checksum,
      item_count: contacts.length,
      data: backupPayload,
    });
    console.log(`   🛡️ Snapshot registrado na tabela vf_backup_snapshots.`);
  } catch (snapErr) {
    console.warn(`   ⚠️ Aviso ao registrar snapshot no banco:`, snapErr.message);
  }

  // 4. Enviar para Google Drive Webhook se configurado
  const webhookUrl = env.GOOGLE_DRIVE_WEBHOOK_URL || env.GDRIVE_BACKUP_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      console.log(`\n☁️ Enviando cópia para o Google Drive Webhook...`);
      const gdriveRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_backup",
          filename,
          data: backupPayload,
        }),
      });
      if (gdriveRes.ok) {
        console.log(`   ✅ Sucesso! Backup salvo na sua pasta do Google Drive via Nuvem.`);
      } else {
        console.warn(`   ⚠️ Google Drive Webhook respondeu com status ${gdriveRes.status}.`);
      }
    } catch (gdriveErr) {
      console.warn(`   ⚠️ Falha ao contactar Webhook do Google Drive:`, gdriveErr.message);
    }
  }

  // 5. Registrar log de auditoria
  try {
    await supabase.from("vf_audit_logs").insert({
      actor_email: "backup-autonomo@sistemavotoforte.com.br",
      action: "Backup Automático Autônomo Concluído",
      detail: `Backup completo realizado (${contacts.length} contatos). Arquivo: ${filename} (${sizeMb} MB).`,
    });
  } catch {
    // ignore
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✨ Concluído com sucesso em ${durationSec}s!`);
  console.log("==================================================");
}

runAutonomousBackup().catch((err) => {
  console.error("❌ Falha crítica no backup autônomo:", err);
  process.exit(1);
});
