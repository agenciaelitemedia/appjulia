
## Objetivo

Garantir que **toda** desativação da Julia dispare `n8n_execute-followup-stop` e **toda** ativação dispare `n8n_execute-agent_and_followup-reactive`, com os parâmetros corretos (`codAgent`, `whatsappNumber`, `hubFila`).

## Mapeamento — locais que controlam ativar/desativar Julia

| # | Local | Tipo de ação | followup-stop hoje | reactive hoje | O que falta |
|---|---|---|---|---|---|
| 1 | `src/contexts/WhatsAppDataContext.tsx` `disableJuliaOnAssignOrTransfer` (linhas 573-620) | Desativa (Assumir / Transferir manual no chat) | ✅ Sim | — (não ativa) | Nada — já OK |
| 2 | `src/components/chat/ChatHeader.tsx` `handleToggleSession` (linhas 98-111) | Toggle Julia no header do chat (switch on/off) | ❌ Não | ❌ Não | Chamar `followup-stop` no desligar e `reactive` no ligar |
| 3 | `src/pages/crm/components/SessionStatusDialog.tsx` `handleToggleStatus` (linhas 70-93) | Toggle Julia no diálogo do CRM | ❌ Não | ❌ Não | Chamar `followup-stop` no desligar e `reactive` no ligar |
| 4 | `src/pages/crm/components/WhatsAppMessagesDialog.tsx` `handleToggleSession` (linhas 907-920) | Toggle Julia no diálogo de mensagens do CRM | ❌ Não | ❌ Não | Chamar `followup-stop` no desligar e `reactive` no ligar |
| 5 | `supabase/functions/_shared/disableJuliaOnHumanSend.ts` (helper legado) | Desativa em envio manual server-side | ✅ Sim | N/A | Nada (não é chamado hoje, mantido) |

Não existem outros pontos que chamem `updateSessionStatus` — grep confirmou 4 call sites no frontend + 1 helper edge.

## Estratégia de implementação

### Passo 1 — Criar helper único no frontend

Criar `src/lib/juliaSessionControl.ts` exportando:

```ts
toggleJuliaSession(args: {
  sessionId: number;
  active: boolean;                // novo valor desejado
  codAgent: string;
  whatsappNumber: string;         // telefone do lead (qualquer formato)
  hubFila: 'uazapi' | 'waba';     // canal da fila
}): Promise<void>
```

Comportamento:
1. `externalDb.updateSessionStatus(sessionId, active)` (mantém a mudança direta na tabela `sessions` — mesmo comportamento atual, garante consistência quando a edge function falhar).
2. Se `active === false` → `supabase.functions.invoke('n8n_execute-followup-stop', { body: { codAgent, sessionId: whatsappNumber } })`.
3. Se `active === true` → `supabase.functions.invoke('n8n_execute-agent_and_followup-reactive', { body: { codAgent, whatsappNumber, hubFila } })`. Nota: a edge `reactive` já executa o `UPDATE sessions.active=TRUE` internamente — o passo 1 aqui vira redundante mas idempotente (garante rollback se a edge falhar antes do UPDATE).
4. Erros da edge function são `console.warn` (best-effort) — não bloqueiam a UI, seguindo o padrão de `disableJuliaOnAssignOrTransfer`.

### Passo 2 — Resolver `hubFila` nos 3 call sites de CRM

`ChatHeader` já tem `queueLink` mas não expõe `channel_type`. Precisa-se de `hubFila` derivado de `queues.channel_type` (valor já é `'uazapi'` ou `'waba'`, casa 1:1 com `hubFila`).

- **ChatHeader** (item 2): `queueId` disponível → estender `useQueueAgentLink` **ou** criar hook auxiliar leve para incluir `channel_type` da fila. Preferir estender o hook existente devolvendo `channelType`.
- **SessionStatusDialog** (item 3) e **WhatsAppMessagesDialog** (item 4): recebem `whatsappNumber` + `codAgent` mas não têm `queueId`. Duas opções:
  - **(a)** Buscar `queues` via `queue_agent_links.cod_agent = codAgent` (primeiro/primary) e ler `channel_type`. Reusar em um único hook `useHubFilaByCodAgent(codAgent)`.
  - **(b)** Fallback para `'uazapi'` quando não encontrar (canal mais comum no legado CRM).

Adotar **(a)** com fallback **(b)**.

### Passo 3 — Aplicar o helper nos 3 call sites

Substituir cada bloco `updateSessionStatus(sessionData.id, newStatus)` por `toggleJuliaSession({ sessionId, active: newStatus, codAgent, whatsappNumber, hubFila })`. Manter o restante da lógica (invalidação de cache, toast, `setUpdating`).

### Passo 4 — Reforçar `disableJuliaOnAssignOrTransfer` (opcional, coerência)

Nada a mudar — já chama `followup-stop`. Como esse fluxo é sempre "desativação" (assumir/transferir), não precisa do `reactive`.

## Detalhes técnicos

- **Parâmetros da `reactive`**: `codAgent` (string), `whatsappNumber` (qualquer formato — a edge normaliza via `brPhoneVariants` + `toBrCanonicalByDDD`), `hubFila` (`'uazapi'|'waba'`).
- **Parâmetros da `followup-stop`**: `codAgent`, `sessionId` (telefone limpo — edge normaliza).
- **Retro-compat**: o comportamento atual (só flip do `active` na tabela) é mantido pelo passo 1 do helper — a chamada da edge é aditiva. Nenhum caller quebra se as edges estiverem fora do ar.
- **Sem mudanças em edge functions**: `n8n_execute-followup-stop` e `n8n_execute-agent_and_followup-reactive` já existem e estão deployadas.

## Arquivos afetados

- **Novo**: `src/lib/juliaSessionControl.ts`
- **Novo/estendido**: `src/hooks/useQueueAgentLink.ts` (adicionar `channelType`) e novo hook `src/hooks/useHubFilaByCodAgent.ts`
- **Editados**: `src/components/chat/ChatHeader.tsx`, `src/pages/crm/components/SessionStatusDialog.tsx`, `src/pages/crm/components/WhatsAppMessagesDialog.tsx`
- **Memória**: atualizar `mem/features/ai-agent/human-override-logic.md` para refletir os 3 novos pontos e a chamada da `reactive`.

## Fora do escopo

- Não alterar o helper edge `_shared/disableJuliaOnHumanSend.ts` (não é chamado hoje).
- Não introduzir chamada de `reactive` em `disableJuliaOnAssignOrTransfer` (é fluxo de desligar).
- Não mexer em `useAgentSessionStatusesBatch` (só leitura).
