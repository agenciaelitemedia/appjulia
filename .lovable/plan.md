# Plano: Gating de Transcrição/Resumo por client_id

## Objetivo
Trocar o gating das flags `AUTO_TRANSCRIBE_AUDIO`, `AUTO_SUMMARY_ON_RESOLVE`, `AUTO_SUMMARY_ON_CLOSE` para considerar **qualquer agente do mesmo `client_id`** da conversa/fila (em vez de só os agentes vinculados à fila). Também ocultar a aba "Resumos" do painel de contato quando ambas as flags de resumo estiverem off.

Flags ausentes em `agents.settings` continuam sendo tratadas como `false` (já está assim em `getAgentAutomationFlags`).

---

## 1. Backend (Edge Functions)

### 1.1 `supabase/functions/_shared/agentSettings.ts`
Adicionar nova função `fetchClientAutomationFlags(clientId)` que:
- Faz `SELECT settings FROM agents WHERE client_id = $1::bigint` via `db-query`.
- Itera todas as linhas e devolve `AgentAutomationFlags` com **OR lógico** (se ANY agente do client tiver true, flag = true).
- Cache em memória curto (ex: 60s, Map<clientId, {flags, ts}>) para evitar query repetida em rajadas de webhook.

### 1.2 `supabase/functions/chat-ai-assist/index.ts`
Substituir `isAutoSummaryAllowed`:
- Buscar `client_id` da `chat_conversations` (não mais `queue_id`).
- Chamar `fetchClientAutomationFlags(client_id)`.
- Retornar `flags.autoSummaryOnResolve` ou `flags.autoSummaryOnClose` conforme `triggered_by`.

### 1.3 `supabase/functions/uazapi-chat-webhook/index.ts`
No bloco de auto-transcribe (linhas 1338-1376):
- Remover lookup em `queue_agent_links`.
- Resolver `client_id` da fila (já temos `queueId` — usar `queues.client_id` ou já disponível no escopo).
- Chamar `fetchClientAutomationFlags(clientId)` e usar `flags.autoTranscribeAudio`.

---

## 2. Frontend

### 2.1 Novo hook `src/hooks/useClientAutomationFlags.ts`
- Recebe `clientId` do `AuthContext` (`user.client_id`).
- React Query, `staleTime: 5min`.
- Chama um novo endpoint (ver 2.2) que devolve as flags consolidadas do client.
- Retorna `{ autoTranscribeAudio, autoSummaryOnResolve, autoSummaryOnClose }`.

### 2.2 Nova edge function `supabase/functions/client-automation-flags/index.ts`
- Recebe `{ client_id }`.
- Usa `fetchClientAutomationFlags`.
- Retorna JSON com as 3 flags.
- Necessária porque o frontend não pode ler `agents.settings` (DB externo) diretamente.

### 2.3 `src/components/chat/ContactDetailPanel.tsx`
- Importar `useClientAutomationFlags`.
- Calcular `showResumos = autoSummaryOnResolve || autoSummaryOnClose`.
- Quando `false`:
  - Mudar `TabsList` para `grid-cols-2` e omitir o `TabsTrigger value="resumos"`.
  - Omitir o `TabsContent value="resumos"`.
  - Se a tab default estava em `resumos`, manter `defaultValue="geral"` (já é).

### 2.4 `src/hooks/useAutoSummaryOnStatusChange.ts`
Sem mudança — o servidor decide. (Já comentado: "gated server-side".)

---

## 3. Comportamento resultante

| Ação | Condição de disparo |
|---|---|
| Transcrição automática de áudio recebido/enviado | ANY agente do `client_id` da fila com `AUTO_TRANSCRIBE_AUDIO=true` |
| Resumo automático ao resolver manualmente | ANY agente do `client_id` da conversa com `AUTO_SUMMARY_ON_RESOLVE=true` |
| Resumo automático ao encerrar manualmente | ANY agente do `client_id` da conversa com `AUTO_SUMMARY_ON_CLOSE=true` |
| Aba "Resumos" visível em ContactDetailPanel | `AUTO_SUMMARY_ON_RESOLVE` OR `AUTO_SUMMARY_ON_CLOSE` true para o client logado |
| Botão "Gerar Resumo" manual | Continua existindo dentro da aba (logo só aparece se a aba aparece) |
| Flag ausente em `agents.settings` | Tratada como `false` (já implementado) |

---

## 4. Detalhes técnicos

- **Cache**: 60s server-side (em `_shared/agentSettings.ts` Map) + 5min client-side (React Query). Mudanças nas flags do agente refletem em ~1min nos webhooks e até 5min na UI (refetch on focus).
- **Type safety**: nenhuma migração SQL. Só código.
- **Compatibilidade**: a lógica antiga (por queue) é totalmente substituída — nenhum fallback necessário, pois o novo critério é mais amplo.
- **Edge function nova** (`client-automation-flags`) precisa de `verify_jwt = false` (padrão Lovable) e roda com service role internamente via `fetchClientAutomationFlags`.
