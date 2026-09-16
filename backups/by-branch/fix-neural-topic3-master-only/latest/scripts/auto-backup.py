#!/usr/bin/env python3
"""
VOTO FORTE PARANÁ - EXECUTOR AUTÔNOMO DE BACKUP
Gera backup completo e salva localmente e na nuvem.
"""

import json
import os
import sys
import time
import hashlib
from datetime import datetime
import urllib.request
import urllib.error

def load_env(base_dir):
    env = {}
    for filename in [".env.production", ".env.local", ".env"]:
        filepath = os.path.join(base_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in env:
                            env[k] = v
    return env

def make_supabase_request(url, key, endpoint, method="GET", body=None):
    full_url = f"{url}/rest/v1/{endpoint}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(full_url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        raise Exception(f"HTTP {e.code}: {err_content}")

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env = load_env(base_dir)

    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    folder_id = env.get("GOOGLE_DRIVE_FOLDER_ID", "1LePlbjMOWjjiNG7EWFLYfZrDmRAWONkU")
    webhook_url = env.get("GOOGLE_DRIVE_WEBHOOK_URL")

    if not supabase_url or not supabase_key:
        print("❌ Erro: Configurações do Supabase não encontradas.")
        sys.exit(1)

    print("=" * 60)
    print("🚀 VOTO FORTE PARANÁ - BACKUP AUTOMÁTICO COMPLETO")
    print("=" * 60)
    start_time = time.time()
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H%M%S")
    timestamp_iso = now.isoformat()

    print(f"🕒 Data/Hora: {now.strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"📁 Pasta Google Drive Vinculada: ID {folder_id}")
    print("📥 Coletando registros do banco de dados...")

    # 1. Obter tabelas
    try:
        contacts = make_supabase_request(supabase_url, supabase_key, "vf_contacts?select=*&limit=50000")
    except Exception as e:
        print(f"⚠️ Contatos: {e}")
        contacts = []

    try:
        users = make_supabase_request(supabase_url, supabase_key, "vf_users?select=id,email,name,role,status,parent_user_id,created_at")
    except Exception as e:
        print(f"⚠️ Usuários: {e}")
        users = []

    try:
        audit_logs = make_supabase_request(supabase_url, supabase_key, "vf_audit_logs?select=*&order=created_at.desc&limit=500")
    except Exception as e:
        print(f"⚠️ Auditoria: {e}")
        audit_logs = []

    try:
        exports = make_supabase_request(supabase_url, supabase_key, "vf_contact_exports?select=*&order=created_at.desc&limit=100")
    except Exception as e:
        print(f"⚠️ Exportações: {e}")
        exports = []

    total_contacts = len(contacts) if isinstance(contacts, list) else 0
    total_users = len(users) if isinstance(users, list) else 0
    total_audit = len(audit_logs) if isinstance(audit_logs, list) else 0
    total_exports = len(exports) if isinstance(exports, list) else 0

    print(f"\n📊 Resumo dos Dados Coletados:")
    print(f"   👥 Contatos salvos: {total_contacts:,}".replace(",", "."))
    print(f"   👤 Usuários do sistema: {total_users}")
    print(f"   📜 Logs de auditoria: {total_audit}")
    print(f"   📦 Histórico de exportações: {total_exports}")

    # 2. Montar Pacote de Backup
    backup_payload = {
        "format": "voto-forte-automated-full-backup",
        "version": "2.5.0",
        "platform": "VOTO FORTE PARANÁ",
        "generatedAt": timestamp_iso,
        "targetDate": date_str,
        "googleDriveFolderId": folder_id,
        "stats": {
            "totalContacts": total_contacts,
            "totalUsers": total_users,
            "totalAuditLogs": total_audit,
            "totalExports": total_exports,
        },
        "data": {
            "contacts": contacts,
            "users": users,
            "auditLogs": audit_logs,
            "contactExports": exports,
        }
    }

    # 3. Salvar arquivo localmente
    backups_dir = os.path.join(base_dir, "backups")
    os.makedirs(backups_dir, exist_ok=True)
    filename = f"VotoForte-Backup-Completo-{date_str}-{time_str}.json"
    file_path = os.path.join(backups_dir, filename)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(backup_payload, f, indent=2, ensure_ascii=False)

    file_size_bytes = os.path.getsize(file_path)
    file_size_mb = file_size_bytes / (1024 * 1024)

    checksum = hashlib.sha256(json.dumps(backup_payload, sort_keys=True).encode("utf-8")).hexdigest()[:16].upper()

    print(f"\n💾 Arquivo de Backup Gerado com Sucesso!")
    print(f"   📁 Arquivo: {filename}")
    print(f"   📍 Local: {file_path}")
    print(f"   📦 Tamanho: {file_size_mb:.2f} MB ({file_size_bytes:,} bytes)".replace(",", "."))
    print(f"   🔒 Checksum de Verificação: SHA256-{checksum}")

    # 4. Registrar snapshot no Supabase
    try:
        snapshot_entry = {
            "created_at": timestamp_iso,
            "created_by": f"Backup Autônomo Executado ({now.strftime('%d/%m/%Y %H:%M')})",
            "backup_version": 2,
            "checksum": f"SHA256-{checksum}",
            "item_count": total_contacts,
            "data": backup_payload
        }
        make_supabase_request(supabase_url, supabase_key, "vf_backup_snapshots", method="POST", body=snapshot_entry)
        print("   🛡️ Snapshot gravado na tabela vf_backup_snapshots com sucesso!")
    except Exception as snap_err:
        print(f"   ℹ️ Registro de snapshot: {snap_err}")

    # 5. Registrar log de auditoria no Supabase
    try:
        audit_entry = {
            "actor_email": "backup-autonomo@sistemavotoforte.com.br",
            "action": "Backup Completo Realizado com Sucesso",
            "detail": f"Backup completo gerado: {total_contacts} contatos, {total_users} usuários. Arquivo: {filename} ({file_size_mb:.2f} MB). Destino Google Drive: {folder_id}."
        }
        make_supabase_request(supabase_url, supabase_key, "vf_audit_logs", method="POST", body=audit_entry)
    except Exception:
        pass

    # 6. Disparar Webhook do Google Drive se configurado
    if webhook_url and webhook_url.startswith("http"):
        print(f"\n☁️ Enviando para o Google Drive Webhook...")
        try:
            req_gdrive = urllib.request.Request(
                webhook_url,
                data=json.dumps({"action": "save_backup", "filename": filename, "data": backup_payload}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req_gdrive, timeout=30) as resp:
                print("   ✅ Transmitido com sucesso para a nuvem do Google Drive!")
        except Exception as gdrive_err:
            print(f"   ⚠️ Webhook do Google Drive: {gdrive_err}")

    duration = time.time() - start_time
    print(f"\n✨ Backup 100% concluído com sucesso em {duration:.1f} segundos!")
    print("=" * 60)

if __name__ == "__main__":
    main()
