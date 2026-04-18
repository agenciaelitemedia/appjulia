

## Diagnóstico

Validei no banco: chegou mensagem WABA para o número `667282786474815` (fila "Oficial" — `queue_id=0f4abeb4...`, `client_id=30`), mas a tag exibida é "Agente Principal" (fila UaZapi `client_id=30`). Causas combinadas:

1. **`meta-webhook/persistToChat` grava `client_id` errado**: usa `agents.user_id` (=145, dono Meta) em vez do `client_id=30` da fila WABA. O contato fica num tenant onde a fila WABA nem existe.
2. **`meta-webhook` não cria `chat_conversations`** nem associa `queue_id`. Quem cria é o front (`getOrCreateConversation` em `WhatsAppDataContext`).
3. **Fallback de fila no front confunde `channel_source` com `queue_id`** (linha 300 de `WhatsAppDataContext.tsx`): para UaZapi `channel_source` é UUID de fila, mas para WABA é o `phone_number_id` da Meta. O cast falha silenciosamente e o fluxo cai no fallback final → usa a fila selecionada no topo ("Agente Principal").
4. **`channel_source` deveria ser o `queue_id` da fila WABA correta**, não o `phone_number_id` cru.

## Correções

### 1. `supabase/functions/meta-webhook/index.ts`
- Antes de chamar `persistToChat`, resolver a fila WABA pelo `phone_number_id` usando `resolveQueueByWabaNumberId(supabase, phoneNumberId)` (já importado mas não usado).
- Se encontrar fila, usar `queue.client_id` como `client_id` do contato (ignorando `agents.user_id`) e gravar `channel_source = queue.id` (UUID), não o `phone_number_id`.
- Se não houver fila WABA configurada para aquele número, manter comportamento atual como fallback (logando warning), para não quebrar tenants antigos.
- Adicionar `queue_id` no upsert de `chat_contacts` (coluna existe? vou checar; se não, fica só em `channel_source`).
- Criar `chat_conversations` (status `pending`, `queue_id` = id da fila WABA, `channel='whatsapp_waba'`) na primeira mensagem se não houver conversa aberta para o contato. Idempotente: SELECT antes de INSERT.

### 2. `src/contexts/WhatsAppDataContext.tsx` — `getOrCreateConversation`
- Validar `channel_source` como UUID antes de usar como `queue_id`. Regex simples: `/^[0-9a-f-]{36}$/i`. Se não bater, ignora e segue para o passo 3 (busca por `channel_type`).
- No passo 3, quando o contato é `whatsapp_waba`, **filtrar também por `waba_number_id` da fila** matching o `channel_source` do contato (que pode ser phone_number_id legado), garantindo que só a fila correta seja escolhida.

### 3. Backfill (opcional, em SQL via migração)
- Atualizar contatos WABA existentes para `channel_source = queue.id` quando `channel_source` bate com algum `queues.waba_number_id`.
- Atualizar `chat_conversations` órfãs (queue_id de fila UaZapi mas contato é WABA) para a fila WABA correta.

## Arquivos
- `supabase/functions/meta-webhook/index.ts` — resolver fila WABA, corrigir client_id, gravar channel_source = queue.id, criar conversa.
- `src/contexts/WhatsAppDataContext.tsx` — validação UUID em channel_source + match por waba_number_id no fallback.
- Migração SQL de backfill (one-shot) para corrigir contatos/conversas WABA já existentes.

## Validação
1. Enviar nova mensagem para o número WABA (`667282786474815`) → contato deve aparecer no client_id correto, com `channel_source = 0f4abeb4...` (UUID da fila Oficial).
2. Conversa criada deve ter `queue_id = 0f4abeb4...` e badge "Oficial" (não "Agente Principal").
3. Contato/conversa antigos devem aparecer corrigidos após backfill.
4. Mensagens UaZapi continuam roteando normalmente para "Agente Principal".

