

# Plano: Histórico apenas por sincronização inteligente + webhook completo

## Situação atual
- O webhook cria registros parciais no banco (channel-create, channel-answer, channel-hangup)
- O `sync_call_history` busca TODAS as páginas da Api4Com a cada chamada — ineficiente
- O `complete_call_log` ainda existe no backend (código morto)
- Após cada chamada, o frontend dispara sync completo desnecessariamente

## Mudanças

### 1. Webhook completo — não disparar sync se já tem todos os dados
**`supabase/functions/api4com-webhook/index.ts`**
- No evento `channel-hangup`: verificar se o payload já contém `duration`, `record_url`, `cost`, `hangup_cause`
- Se sim: fazer upsert completo no banco e **não** disparar sync (dados já estão completos)
- Se não: após salvar o que tem, disparar internamente a sync apenas para o `call_id` específico (buscar `GET /calls?call_id={id}` ou `GET /calls/{id}`)
- Resolver `cod_agent` via lookup no `phone_extensions` pelo `extensionNumber` quando não vier no payload

### 2. Sync incremental — buscar apenas o necessário
**`supabase/functions/api4com-proxy/index.ts`** — action `sync_call_history`
- Aceitar parâmetros opcionais: `callId`, `since` (timestamp)
- Se `callId` fornecido: buscar apenas `GET /calls/{callId}` e upsert esse registro
- Se `since` fornecido: buscar `GET /calls?start_date={since}` para pegar apenas chamadas recentes
- Se nenhum: buscar o `MAX(started_at)` do banco para o `cod_agent` e usar como `since` (sync incremental automático)
- Remover paginação exaustiva — limitar a últimas 24h se não houver parâmetro

### 3. Frontend — sync inteligente pós-chamada
**`DiscadorTab.tsx` e `PhoneCallDialog.tsx`**
- Após desligar, chamar `sync_call_history` com `since: <início da chamada>` (ou últimos 5 min)
- Se o webhook já tiver registrado tudo, o sync será no-op (upsert sem mudança)

### 4. Remover código morto
**`api4com-proxy/index.ts`**
- Remover case `complete_call_log` inteiro (linhas 583-661)

**`useTelefoniaData.ts`**
- Remover mutation `completeCallLog` e referências

## Arquivos alterados
- `supabase/functions/api4com-webhook/index.ts` — webhook com dados completos + lookup de cod_agent
- `supabase/functions/api4com-proxy/index.ts` — sync incremental + remover complete_call_log
- `src/pages/telefonia/components/DiscadorTab.tsx` — passar `since` no sync
- `src/pages/crm/components/PhoneCallDialog.tsx` — passar `since` no sync
- `src/pages/telefonia/hooks/useTelefoniaData.ts` — remover completeCallLog, ajustar syncCallHistory para aceitar params

