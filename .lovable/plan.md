

# Corrigir duplicatas no historico + fuso horario

## Problema 1: Registros duplicados
Os logs mostram que o webhook recebe o mesmo evento `channel-hangup` **duas vezes** (duas instancias da edge function bootan simultaneamente para o mesmo request). Ambas fazem `.maybeSingle()` quase ao mesmo tempo, nenhuma encontra registro existente, e ambas fazem `INSERT` — gerando duplicata.

Alem disso, o webhook cria registro no `channel-create`, depois no `channel-hangup`, e depois o `syncQueue` do frontend tambem faz upsert — potencialmente 3 registros.

### Correção
1. **Adicionar constraint UNIQUE em `call_id`** na tabela `phone_call_logs` — isso impede duplicatas no nivel do banco
2. **Usar `upsert` com `onConflict: 'call_id'`** no webhook em vez de select+insert manual
3. **Remover o insert do `channel-create`** — o webhook nao deve criar registros parciais, apenas o `channel-hangup` e o sync devem persistir dados

## Problema 2: Horario 3h a menos
A Api4Com envia timestamps como `"2026-03-22 18:18:52"` sem fuso — são horario de Brasilia (UTC-3). O webhook salva direto no banco sem adicionar o offset. O banco interpreta como UTC, resultando em 3h de diferença.

### Correção
No webhook, ao parsear `startedAt`, `endedAt`, `answeredAt` que vem sem timezone: **concatenar `-03:00`** (Brasilia) antes de salvar, para que o banco armazene corretamente.

Mesma logica no `sync_call_history` da proxy: os timestamps do CDR da Api4Com tambem vem sem fuso.

## Arquivos alterados
- Migration SQL: `ALTER TABLE phone_call_logs ADD CONSTRAINT phone_call_logs_call_id_unique UNIQUE (call_id)`
- `supabase/functions/api4com-webhook/index.ts` — upsert com onConflict, remover channel-create insert, fix timezone
- `supabase/functions/api4com-proxy/index.ts` — fix timezone nos timestamps do sync

