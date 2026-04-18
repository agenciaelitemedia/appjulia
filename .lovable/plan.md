

## Goal
Ajustar exibição de eventos no chat:
1. **Ocultar** o evento `opened` quando o ator é "Sistema (webhook)".
2. **Corrigir o "Ontem"** que aparece em mensagens/eventos do dia atual (problema de timezone — usa data crua do banco com `new Date()` em vez do helper `parseDbTimestamp`/`getDbDateGroupLabel`).
3. **Reformular o evento `assigned`**: quando `from_value` é vazio/nulo (primeira atribuição = "assumir"), mostrar `"{actor} assumiu a conversa"` em vez de `"{actor} transferiu para {to_value}"`. Manter o texto atual de transferência apenas quando já existe um atendente anterior (`from_value` preenchido e diferente de `to_value`).

## Investigação necessária
- `src/components/chat/ConversationEvent.tsx` — onde está a label e o `format()` do timestamp.
- Verificar se `ConversationHistoryEntry` já expõe `from_value` (sim, está no `actionConfig.assigned` atual).
- Confirmar onde a lista de eventos é renderizada para garantir que filtrar `opened`+webhook não quebra agrupamento por data (provavelmente `MessagesArea` ou similar — apenas precisa pular o item).

## Mudanças

### `src/components/chat/ConversationEvent.tsx`
1. **Datas**: trocar `format(new Date(entry.created_at), 'dd/MM HH:mm', ...)` por `formatDbDateTime` (ou montar com `parseDbTimestamp` + format curto `dd/MM HH:mm` sem ano) de `@/lib/dateUtils`. Isso resolve o "Ontem" incorreto, pois timestamps do banco externo vêm sem offset real.
2. **`assigned` dinâmico**: transformar a label em função que decide:
   - Se `!from_value` ou `from_value === to_value` ou `from_value === actor_name` → `"{actor_name} assumiu a conversa"`.
   - Senão → manter `"{actor_name} transferiu para {to_value}"`.
3. **Filtrar `opened` do webhook**: retornar `null` quando `entry.action === 'opened'` e (`actor_name` contém "webhook" ou `actor_name === 'Sistema'` sem identificação humana). Critério proposto: ocultar se `actor_name` for nulo, "Sistema", "Sistema (webhook)" ou contiver "webhook".

### Renderização (caller)
Como o componente passa a poder retornar `null`, nenhuma mudança extra é necessária no caller — React simplesmente não renderiza nada para esse item.

## Arquivos
- `src/components/chat/ConversationEvent.tsx` (única alteração)

## Validação
1. Abrir conversa antiga: o card cinza "Sistema (webhook) abriu a conversa" não aparece mais.
2. Eventos de hoje mostram "18/04 HH:mm" e qualquer agrupamento "Hoje" (não "Ontem").
3. Primeira atribuição (advogado pega o lead): "Mario Castro assumiu a conversa 18/04 08:50".
4. Transferência real (atendente A → atendente B): mantém "Mario Castro transferiu para João Silva 18/04 09:10".

