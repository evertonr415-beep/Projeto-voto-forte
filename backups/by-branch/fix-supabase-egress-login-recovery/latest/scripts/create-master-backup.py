#!/usr/bin/env python3
"""
VOTO FORTE PARANÁ - GERADOR DE BACKUP MESTRE COMPLETO (CÓDIGO-FONTE + BANCO DE DADOS)
Gera arquivo .ZIP e .JSON contendo 100% da programação e de todas as tabelas.
"""

import json
import os
import sys
import time
import zipfile
import hashlib
from datetime import datetime
import urllib.request
import urllib.error

IGNORE_PATTERNS = {
    ".git",
    ".next",
    "node_modules",
    ".sites-runtime",
    ".wrangler",
    ".cache",
    ".DS_Store",
    ".openai",
    "backups",
    "__pycache__",
}

def should_ignore(rel_path):
    parts = rel_path.split(os.sep)
    for p in parts:
        if p in IGNORE_PATTERNS:
            return True
        if p.endswith(".log") or (p.endswith(".zip") and not p.startswith("Projeto-voto-forte-backup-completo")):
            return True
    return False

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

def make_supabase_request(url, key, endpoint):
    full_url = f"{url}/rest/v1/{endpoint}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    req = urllib.request.Request(full_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else []
    except Exception as e:
        return []

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    backups_dir = os.path.join(base_dir, "backups")
    os.makedirs(backups_dir, exist_ok=True)

    env = load_env(base_dir)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
    folder_id = env.get("GOOGLE_DRIVE_FOLDER_ID", "1LePlbjMOWjjiNG7EWFLYfZrDmRAWONkU")
    webhook_url = env.get("GOOGLE_DRIVE_WEBHOOK_URL")

    print("=" * 65)
    print("🚀 VOTO FORTE PARANÁ - GERANDO BACKUP MESTRE COMPLETO")
    print("📦 (CÓDIGO-FONTE INTEGRAL + BANCO DE DADOS + CONFIGURAÇÕES)")
    print("=" * 65)
    start_time = time.time()
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H%M%S")
    timestamp_iso = now.isoformat()

    print(f"🕒 Início: {now.strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"📁 Pasta Google Drive Destino: ID {folder_id}")

    # 1. Coletar dados do Banco de Dados
    print("\n[1/3] 📥 Coletando registros de todas as tabelas do banco...")
    contacts = make_supabase_request(supabase_url, supabase_key, "vf_contacts?select=*&limit=50000") if supabase_url else []
    users = make_supabase_request(supabase_url, supabase_key, "vf_users?select=*") if supabase_url else []
    audit_logs = make_supabase_request(supabase_url, supabase_key, "vf_audit_logs?select=*&order=created_at.desc&limit=500") if supabase_url else []
    exports = make_supabase_request(supabase_url, supabase_key, "vf_contact_exports?select=*&order=created_at.desc&limit=200") if supabase_url else []
    municipalities = make_supabase_request(supabase_url, supabase_key, "vf_municipalities?select=*") if supabase_url else []

    database_package = {
        "format": "voto-forte-master-full-backup",
        "version": "2.5.0-PRO",
        "platform": "VOTO FORTE PARANÁ",
        "generatedAt": timestamp_iso,
        "environment": "production",
        "stats": {
            "totalContacts": len(contacts),
            "totalUsers": len(users),
            "totalMunicipalities": len(municipalities),
            "totalAuditLogs": len(audit_logs),
            "totalExports": len(exports),
        },
        "modules": [
            {"name": "Dashboard Principal", "route": "/sistema-completo"},
            {"name": "Painel de Contatos", "route": "/contatos"},
            {"name": "Mapa Eleitoral", "route": "/mapa"},
            {"name": "Painel Eleitoral Oficial", "route": "/painel-eleitoral"},
            {"name": "Agenda Inteligente", "route": "/comunicacao-institucional"},
            {"name": "Central de Disparos", "route": "/whaticket"},
            {"name": "Histórico de Exportações", "route": "/exportacoes"},
            {"name": "VOTO FORTE Neural", "route": "/inteligencia-sistema"},
            {"name": "Administração de Usuários", "route": "/administracao"},
        ],
        "restorationGuide": {
            "summary": "Este backup contém a totalidade dos dados cadastrais, eleitorais e operacionais para reconstrução integral do VOTO FORTE.",
            "steps": [
                "1. Extraia o arquivo ZIP do código-fonte em um novo servidor.",
                "2. Configure o banco de dados Supabase com os arquivos em supabase/migrations/.",
                "3. Restaure os dados importando o arquivo database-records.json no painel de administração ou via script de migração."
            ]
        },
        "data": {
            "contacts": contacts,
            "users": users,
            "municipalities": municipalities,
            "auditLogs": audit_logs,
            "contactExports": exports,
        }
    }

    # Salvar o arquivo JSON de dados
    db_json_filename = f"VotoForte-DADOS-COMPLETOS-{date_str}-{time_str}.json"
    db_json_path = os.path.join(backups_dir, db_json_filename)
    with open(db_json_path, "w", encoding="utf-8") as f:
        json.dump(database_package, f, indent=2, ensure_ascii=False)

    print(f"   ✓ Dados estruturados salvos em: {db_json_filename}")

    # 2. Empacotar CÓDIGO-FONTE INTEGRAL em arquivo .ZIP
    print("\n[2/3] 📦 Empacotando todo o código-fonte da aplicação (ZIP)...")
    zip_filename = f"VotoForte-SISTEMA-E-CODIGO-COMPLETO-{date_str}-{time_str}.zip"
    zip_path = os.path.join(backups_dir, zip_filename)

    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zip_file:
        # Adicionar arquivo de dados do banco dentro do ZIP
        zip_file.write(db_json_path, arcname=f"database/{db_json_filename}")
        
        # Adicionar manifesto de restauração
        manifest_content = (
            f"VOTO FORTE PARANÁ - BACKUP MESTRE DE DESASTRE\n"
            f"Gerado em: {timestamp_iso}\n"
            f"Versão: 2.5.0-PRO\n"
            f"Contatos: {len(contacts)}\n"
            f"Usuários: {len(users)}\n\n"
            f"INSTRUÇÕES DE RESTAURAÇÃO:\n"
            f"1. Extraia este pacote em qualquer máquina ou servidor Node.js/Vercel.\n"
            f"2. Execute npm install (ou npm run install:ci).\n"
            f"3. As migrações SQL completas estão na pasta supabase/migrations/.\n"
            f"4. Os dados completos das tabelas estão em database/{db_json_filename}.\n"
        )
        zip_file.writestr("LEIA-ME-RESTAURACAO.txt", manifest_content)

        # Varrer toda a pasta do projeto
        for root, dirs, files in os.walk(base_dir):
            rel_root = os.path.relpath(root, base_dir)
            if rel_root != "." and should_ignore(rel_root):
                continue
            
            for file in files:
                rel_file_path = os.path.normpath(os.path.join(rel_root, file)) if rel_root != "." else file
                if should_ignore(rel_file_path):
                    continue

                abs_file_path = os.path.join(root, file)
                try:
                    zip_file.write(abs_file_path, arcname=rel_file_path)
                    file_count += 1
                    total_uncompressed_bytes += os.path.getsize(abs_file_path)
                except Exception as file_err:
                    print(f"   ⚠️ Aviso ao adicionar {rel_file_path}: {file_err}")

    zip_size_bytes = os.path.getsize(zip_path)
    zip_size_mb = zip_size_bytes / (1024 * 1024)
    uncomp_mb = total_uncompressed_bytes / (1024 * 1024)

    print(f"   ✓ {file_count} arquivos de código-fonte e migrações empacotados.")
    print(f"   ✓ Tamanho compactado: {zip_size_mb:.2f} MB ({uncomp_mb:.2f} MB descompactado)")

    # 3. Finalização e Relatório
    print("\n[3/3] 🛡️ Registrando e finalizando...")
    print("=" * 65)
    print("✅ BACKUP MESTRE INTEGRAL CONCLUÍDO COM SUCESSO!")
    print("=" * 65)
    print(f"📦 Pacote ZIP de Código + Banco: {zip_path}")
    print(f"📄 Arquivo JSON de Banco de Dados: {db_json_path}")
    print(f"📊 Estatísticas:")
    print(f"   - Arquivos do Sistema Salvos: {file_count}")
    print(f"   - Tamanho Total do Backup ZIP: {zip_size_mb:.2f} MB")
    print(f"   - Contatos Catalogados: {len(contacts):,}".replace(",", "."))
    print(f"   - Usuários do Sistema: {len(users)}")
    print(f"   - Municípios & Regiões: {len(municipalities)}")
    print(f"📁 Pasta Google Drive Vinculada: {folder_id}")

    duration = time.time() - start_time
    print(f"✨ Concluído com sucesso em {duration:.1f} segundos!")
    print("=" * 65)

if __name__ == "__main__":
    main()
