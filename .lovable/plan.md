

# Implementar Suporte a API Oficial Meta (WABA) nos Agentes

## Resumo

Adicionar suporte ao WhatsApp oficial (Meta Cloud API) como segundo provider de conexao, ao lado do UaZapi existente. O N8N ja suporta o fluxo WABA -- falta apenas o banco, backend e UI.

## Fases de Implementacao

### FASE 1 -- Banco de Dados (DB Externo)

**Task 1: Adicionar colunas WABA na tabela `agents`**

Executar SQL direto no banco externo (nao e migration Supabase):

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_token TEXT DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS waba_number_id VARCHAR(50) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_waba_id ON agents(waba_id) WHERE waba_id IS NOT NULL;
```

Risco zero -- colunas nullable nao afetam agentes existentes.

---

### FASE 2 -- Backend (Edge Functions)

**Task 2: Estender `db-query` com actions WABA**

Arquivo: `supabase/functions/db-query/index.ts`

- Adicionar 3 novos cases no switch: `update_agent_waba_connection`, `clear_agent_waba_connection`, `get_agent_waba_status`
- Atualizar query `get_user_agents` adicionando ao SELECT: `a.waba_id`, `a.waba_number_id`, e campo calculado `waba_configured`
- Nenhuma query existente sera alterada

**Task 3: Criar Edge Function `waba-admin`**

Arquivo: `supabase/functions/waba-admin/index.ts`

Actions:
- `exchange_token` -- troca code OAuth por token permanente via Graph API v22.0 (reutiliza logica do `meta-auth`)
- `save_credentials` -- salva waba_id/token/number_id no DB externo, seta `hub='waba'`
- `verify_connection` -- GET na Graph API para validar token e phone_number_id
- `disconnect` -- limpa campos WABA no DB, seta `hub=NULL`

Usa mesma conexao PostgreSQL do `uazapi-admin` como modelo.

---

### FASE 3 -- Frontend

**Task 4: Atualizar tipos e lib**

Arquivos:
- `src/pages/agente/meus-agentes/types.ts` -- adicionar `WhatsAppProvider` type, campos `waba_id`, `waba_number_id`, `waba_configured` ao `UserAgent`, e status `waba_connected`
- `src/lib/externalDb.ts` -- adicionar metodos `updateAgentWabaConnection`, `clearAgentWabaConnection`, `getAgentWabaStatus`

**Task 5: Atualizar `useConnectionStatus` para suportar ambos os providers**

Arquivo: `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts`

- Adicionar parametros `wabaConfigured` e `agentId`
- Branch `hub === 'waba'`: verificar via `waba-admin/verify_connection`
- Branch `hub === 'uazapi'`: manter logica atual intacta
- Cache de 2 minutos para WABA (rate limit Graph API)

**Task 6: Criar `ProviderSelector.tsx`**

Arquivo: `src/pages/agente/meus-agentes/components/ProviderSelector.tsx`

Dialog com duas opcoes quando `hub === null`:
- UaZapi (QR Code) -- abre fluxo atual
- API Oficial Meta -- abre `WabaSetupDialog`

**Task 7: Criar `WabaSetupDialog.tsx`**

Arquivo: `src/pages/agente/meus-agentes/components/WabaSetupDialog.tsx`

Fluxo step-by-step:
1. Iniciar Embedded Signup (FB Login SDK popup)
2. Capturar `code`, `waba_id`, `phone_number_id` do callback
3. Chamar `waba-admin/exchange_token` (code -> token permanente)
4. Chamar `waba-admin/save_credentials`
5. Verificar conexao
6. Exibir confirmacao

Referencia: `EmbeddedSignupTest.tsx` existente em `/admin/meta-test/`

**Task 8: Atualizar componentes existentes**

Arquivos:
- `ConnectionControlButtons.tsx` -- switch por `agent.hub`: `null` mostra ProviderSelector, `uazapi` mantem fluxo atual, `waba` mostra status + botoes Reconectar/Desconectar
- `ConnectionStatusBadge.tsx` -- adicionar case `waba_connected` com badge azul + icone Shield "API Oficial"
- `AgentCard.tsx` -- passar novos campos ao `useConnectionStatus`, exibir info diferenciada por provider

---

## Seguranca -- Nao Quebrar UaZapi

- Colunas WABA sao `NULL DEFAULT`
- Campo `hub` diferencia providers: `'uazapi'` vs `'waba'` vs `NULL`
- Todas alteracoes sao aditivas
- Nenhuma query existente sera modificada (apenas novas actions)
- Edge function `uazapi-admin` permanece inalterada

## Secrets Necessarios

- `META_APP_ID` e `META_APP_SECRET` -- ja existem
- `META_CONFIG_ID` -- novo, Config ID do Embedded Signup (criar no painel Meta)
- `META_WEBHOOK_VERIFY_TOKEN` -- novo, para verificacao do webhook

## Ordem de Execucao

| # | Task | Estimativa |
|---|---|---|
| 1 | Migration SQL (colunas WABA) | 5 min |
| 2 | Estender db-query | 30 min |
| 3 | Criar waba-admin | 45 min |
| 4 | Atualizar tipos e lib | 15 min |
| 5 | Atualizar useConnectionStatus | 20 min |
| 6 | ProviderSelector | 20 min |
| 7 | WabaSetupDialog | 60 min |
| 8 | Atualizar componentes existentes | 30 min |

