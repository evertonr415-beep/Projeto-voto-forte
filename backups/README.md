# VOTO FORTE — Backups automáticos

Esta branch é reservada para snapshots automáticos do sistema.

Estrutura gerada pela automação:

`backups/by-branch/<nome-da-branch>/latest/`

Cada `push` feito em qualquer branch do repositório, por qualquer colaborador ou integração com permissão de escrita, gera/atualiza o snapshot correspondente nesta branch.

O diretório `latest/` mantém a cópia mais recente. Versões anteriores continuam recuperáveis pelo histórico Git da branch `backup/automatic`.

A própria branch `backup/automatic` é ignorada pelo gatilho para impedir loops infinitos de backup.
