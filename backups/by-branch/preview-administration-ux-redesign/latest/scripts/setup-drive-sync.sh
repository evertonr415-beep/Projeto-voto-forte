#!/usr/bin/env bash

# Configuração e Execução de Backup Automático Diário (2x ao dia) - VOTO FORTE
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=================================================="
echo "🛡️ VOTO FORTE - Agendador de Backup Automático (2x ao Dia)"
echo "=================================================="

# Executar backup agora via Python nativo do Mac
/usr/bin/python3 scripts/auto-backup.py

echo ""
echo "💡 Agendamento no Mac (02:30 e 13:00):"
echo "   Para rodar automaticamente 2 vezes ao dia no seu Mac, adicione ao seu crontab:"
echo "   (crontab -l 2>/dev/null; echo \"30 2 * * * cd $DIR && /usr/bin/python3 scripts/auto-backup.py >> /tmp/votoforte_backup.log 2>&1\") | crontab -"
echo "   (crontab -l 2>/dev/null; echo \"0 13 * * * cd $DIR && /usr/bin/python3 scripts/auto-backup.py >> /tmp/votoforte_backup.log 2>&1\") | crontab -"
echo "=================================================="
