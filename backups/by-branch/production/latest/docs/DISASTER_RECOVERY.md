# Disaster Recovery — Voto Forte

## Objetivo

Garantir recuperação do banco PostgreSQL sem depender apenas do backup JSON da aplicação.

## Política atual

- Backup físico lógico: `pg_dump --format=custom` com PostgreSQL 17.
- Agendamento: todos os dias às 03:30 em `America/Sao_Paulo` (06:30 UTC).
- Cópia principal: Google Drive, pasta `Voto Forte / Backups / PostgreSQL`, retenção de 30 dias.
- Cópia secundária: GitHub Actions Artifact, retenção de 7 dias.
- Integridade: SHA-256, `pg_restore --list`, tamanho mínimo e manifesto JSON.
- Monitor de saúde: verifica diariamente se existe dump recente, sidecar SHA-256 e manifesto.
- Teste de restauração: workflow manual em banco isolado, com bloqueio explícito contra o projeto de produção.

## RPO e RTO

- RPO planejado: até 24 horas enquanto o backup diário estiver saudável.
- RTO: somente pode ser certificado após um teste de restauração isolado concluído com sucesso.

## Segredos necessários

Nunca versionar nem enviar estes valores por chat:

- `SUPABASE_DB_URL`: conexão PostgreSQL da produção, usada somente para leitura do dump.
- `SUPABASE_RESTORE_TEST_DB_URL`: conexão de um banco descartável e isolado, usada apenas no teste de restauração.

O workflow aborta se o destino de restauração for igual à conexão de produção ou contiver a referência do projeto de produção.

## Variáveis do repositório

- `GDRIVE_BACKUP_ENABLED=true`: habilita a execução agendada do backup.
- `RESTORE_TEST_ENABLED=true`: habilita o workflow manual de teste de restauração.

## Validação de um backup

Um backup só deve ser considerado íntegro quando:

1. o `pg_dump` terminar sem erro;
2. o arquivo tiver tamanho maior que 1 KiB;
3. `pg_restore --list` conseguir ler o conteúdo;
4. o SHA-256 for gerado;
5. dump, checksum, catálogo e manifesto forem enviados ao Google Drive;
6. o arquivo remoto tiver o mesmo tamanho e MD5 do arquivo local;
7. o monitor de saúde encontrar o dump com idade menor que 30 horas.

## Certificação de restauração

Para considerar a recuperação comprovada:

1. criar ou selecionar banco de teste descartável que NÃO seja produção;
2. definir `SUPABASE_RESTORE_TEST_DB_URL` no GitHub Actions;
3. definir `RESTORE_TEST_ENABLED=true`;
4. executar `PostgreSQL isolated restore validation` manualmente;
5. informar exatamente `RESTORE-ISOLATED-ONLY` na confirmação;
6. confirmar que o workflow termina `PASSED`;
7. verificar que SHA-256 e contagens de `vf_owned_records` e contatos coincidem com o manifesto do backup.

## Recuperação real após desastre

Nunca restaurar diretamente sobre uma produção parcialmente funcional sem diagnóstico.

Procedimento recomendado:

1. identificar o último dump saudável no Google Drive;
2. conferir o arquivo `.sha256`;
3. validar `pg_restore --list`;
4. restaurar primeiro em ambiente isolado;
5. comparar tabelas críticas e contagens com o manifesto;
6. somente após validação escolher a estratégia de recuperação da produção;
7. registrar horário, dump utilizado, operador e resultado da recuperação.

## Estado conhecido em 2026-09-16

A infraestrutura de backup e validação está preparada, mas a certificação completa depende de uma credencial `SUPABASE_DB_URL` válida no GitHub Actions e de pelo menos um teste de restauração isolado concluído com sucesso.
