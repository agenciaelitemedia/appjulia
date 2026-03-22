

# Sincronizar histórico de ligações (CDR) da Api4Com para o cod_agent

## Objetivo
Criar uma action `sync_call_history` no `api4com-proxy` que busca os registros de chamadas (CDR) da Api4Com para todos os ramais do agente e faz upsert na tabela `phone_call_logs`. Adicionar botão "Sincronizar Histórico" no `HistoricoTab`.

## Alterações

### 1. `api4com-proxy/index.ts` — nova action `sync_call_history`
- Buscar todos os ramais do `cod_agent` no banco (`phone_extensions` com `api4com_ramal`)
- Para cada ramal, chamar `GET /cdr?extension={ramal}` (ou `/cdr?ramal={ramal}`) na Api4Com
- Para cada registro CDR retornado, fazer upsert em `phone_call_logs` usando `call_id` como chave única:
  - Se já existe registro com mesmo `call_id`: atualizar campos faltantes (duration, record_url, cost, hangup_cause, ended_at, status)
  - Se não existe: inserir novo registro completo
- Mapear campos da Api4Com para nosso schema (direction, caller, called, started_at, ended_at, duration_seconds, record_url, cost, hangup_cause)
- Retornar contagem de registros sincronizados

### 2. `useTelefoniaData.ts` — nova mutation `syncCallHistory`
- Chamar `api4com-proxy` com action `sync_call_history`
- Invalidar query `my-call-history` no sucesso
- Toast com resultado

### 3. `HistoricoTab.tsx` — botão "Sincronizar"
- Botão `RefreshCw` no header do card ao lado do título
- Ao clicar, dispara `syncCallHistory`
- Spinner durante loading

## Arquivos alterados
- `supabase/functions/api4com-proxy/index.ts` — action `sync_call_history`
- `src/pages/telefonia/hooks/useTelefoniaData.ts` — mutation `syncCallHistory`
- `src/pages/telefonia/components/HistoricoTab.tsx` — botão sincronizar

