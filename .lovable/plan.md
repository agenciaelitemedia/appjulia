## Objetivo
Endurecer a aba **Campanhas** do `ContactDetailPanel` para:
1. Sempre encontrar a campanha do contato mesmo quando o telefone estiver salvo em formato diferente (com/sem 9º dígito, com sufixo `@s.whatsapp.net`, "055…", só dígitos etc.).
2. Eliminar qualquer risco de TS2552 (símbolo indefinido) alinhando o card usado com o estado/hook já presentes no arquivo.
3. Exibir na aba a **primeira mensagem real** que o lead enviou na conversa (fallback: `greetingMessageBody` do `campaign_data`), garantindo que a "Frase do lead" espelhe a mensagem inicial de fato.

## 1. Normalização de telefone + telemetria (busca robusta)

Arquivo: `src/components/chat/hooks/useContactCampaigns.ts`

- Trocar a normalização atual (`.replace(/\D/g,'')` + `getBrPhoneVariants`) por um pipeline dedicado que usa `normalizeBrPhone` de `@/lib/phoneNormalize` como forma canônica e depois combina com `getBrPhoneVariants` + `brPhoneVariants` para gerar TODAS as variantes plausíveis (13 díg com 9, 12 díg sem 9, prefixo `55` removido, número puro sem DDI). Deduplicar via `Set`.
- Aceitar entrada com `@s.whatsapp.net`, `@c.us`, `+55…`, espaços/parênteses (a normalize já cobre).
- Ampliar a query externa para casar em qualquer uma das variantes tanto em `campaign_data->>'phone'` quanto em `sessions.whatsapp_number`, e também numa versão só de dígitos (`regexp_replace(...,'\D','','g')`) da coluna do JSON — protege contra registros com máscara:

    ```sql
    WHERE regexp_replace(
            COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone',''),
                     s.whatsapp_number::text),
            '\D','','g') = ANY($1::varchar[])
    ```

- Adicionar telemetria estruturada (respeitando o padrão de logs do projeto):
  - `console.info('[useContactCampaigns] lookup', { phone, variants, rowsFound })` quando terminar.
  - `console.warn('[useContactCampaigns] no-match', { phone, variants })` quando `rows.length === 0` **e** houver telefone válido — ajuda a diagnosticar formatos novos.
  - Marcar `retry: 1`, `staleTime: 5 min` e `enabled: variants.length > 0` (mantido).

## 2. Consistência do card e prevenção de TS2552

Arquivo: `src/components/chat/ContactDetailPanel.tsx`

Estado atual: o arquivo já define `function ContactCampaignCard(...)` internamente e o renderiza em `TabsContent value="campanhas"`. O hook `useContactCampaigns` é importado e usa `isLoadingCampaigns`, `contactCampaigns`, `hasCampaigns`.

Correções para eliminar riscos de TS2552 e ambiguidade:

- Garantir uma única definição de `ContactCampaignCard` no arquivo (remover qualquer referência a `CampaignDetailCard` ou nome antigo, caso apareça em merges futuros — hoje já está OK, mas vou revalidar o import).
- Tipar as props do card com uma interface exportada `ContactCampaignRow` reaproveitada do hook (já existe em `useContactCampaigns.ts`); trocar o inline `{ id; created_at; campaign_data }` por essa interface para o TS reconciliar 100% com o retorno do `useQuery`.
- Passar a "Frase do lead" via prop (`greetingOverride?: string`) para permitir sobrescrever pelo item 3.

## 3. Usar a primeira mensagem real do lead como "Frase do lead"

Ainda em `ContactDetailPanel.tsx` + novo helper em `useContactCampaigns.ts`.

- Adicionar um segundo hook `useContactFirstInboundMessage(contactId)` (ou reusar `useQuery` inline) que faz:

    ```ts
    supabase.from('chat_messages')
      .select('id, body, created_at, conversation_id')
      .eq('contact_id', contact.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: true })
      .limit(1)
    ```

    (Se `chat_messages` não expõe `contact_id`, fazer join implícito via `conversation_id in (SELECT id FROM chat_conversations WHERE contact_id = ...)`.)

- Regra de exibição por card:
  1. `firstInbound.body` (quando existir e não vazio) → é a primeira mensagem real do lead na primeira conversa.
  2. Fallback: `campaign_data.greetingMessageBody` (comportamento atual).
- Passar `greetingOverride={firstInbound?.body}` para o card e usar dentro dele para o bloco "Frase do lead".
- Cache: `staleTime: 5 min`, `enabled: !!contact.id`.

## 4. Verificação

- Rodar `bunx tsgo --noEmit` (deve continuar limpo).
- Testar no `/chat` com contato conhecido: ver no console `[useContactCampaigns] lookup {...}` com `rowsFound > 0`.
- Reproduzir com contato cujo `chat_contacts.phone` está no formato 12 díg (sem 9) e conferir que a aba aparece habilitada.

## Fora de escopo

- Nenhuma alteração de schema, migration ou edge function.
- Sem mudanças em `/estrategico/campanhas`.
- Sem persistir `campaign_data` em `chat_contacts`.
