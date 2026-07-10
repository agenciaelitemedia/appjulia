## Diagnóstico

Na lista do /chat, o badge azul "CRM" (quadro · etapa) só aparece quando o `conversation_id` da conversa exibida bate com o `custom_fields.links.chat.conversation_id` guardado no deal do CRM Builder.

Mas a lista do chat mostra o contato pela "conversa líder" (mais recente entre todas as filas — ver memory `chat-contact-deduplication`). O deal, por outro lado, foi vinculado a UMA conversa específica no momento da criação. Quando o cliente volta a falar por outra fila/canal, a líder muda, o `conv.id` da linha do chat deixa de bater com o do deal, e o badge some — mesmo com o vínculo intacto no banco.

Confirmado no cliente `294`: 3.343 deals guardam `conversation_id`, apenas 105 guardam `contact_id`. Ou seja, hoje o casamento é 1:1 por conversa e não sobrevive à troca de líder.

## Correção proposta

Fazer o badge do CRM Builder no /chat resolver por **contato**, não só pela conversa exata.

### `src/hooks/useCRMBuilderLinkedConversations.ts`
- Continuar buscando `crm_deals` (não arquivados) com `crm_boards`/`crm_pipelines`.
- Coletar todos os `conversation_id` presentes em `custom_fields.links.chat`.
- Uma segunda query em `chat_conversations` (`id in (...)`) traz `contact_id` para cada conversa vinculada — resolve os ~3.343 deals que só têm `conversation_id`.
- Retornar duas estruturas:
  - `byConversation: Map<conversation_id, CrmBuilderLink>` (comportamento atual, sem regressão).
  - `byContact: Map<contact_id, CrmBuilderLink>` — construído a partir de (a) `links.chat.contact_id` quando existir e (b) do `contact_id` resolvido via lookup acima. Se um contato tiver múltiplos deals ativos, mantém o de `updated_at` mais recente.

### `src/components/chat/ChatList.tsx`
- Consumir as duas maps.
- Trocar a linha atual por:
  - `crmBuilderLink = crmBuilderMap.byConversation.get(conv.id) ?? crmBuilderMap.byContact.get(contact.id)`.
  - `hasCrmCard` segue a mesma regra.
- Nenhuma mudança de layout no `ChatContactItem` — o badge já sabe se renderizar quando `crmBuilderLink` chega preenchido.

### Escopo
- Só leitura/UI do /chat. Não altera dados do CRM, deals, conversas ou vínculos.
- Não mexe em `useChatCRMLinks` (painel do lado direito), nem em `ChatLinkedDealSheet`.
- Não altera regra de "conversa líder"; apenas usa `contact_id` como fallback para casar com o deal.

## Resultado esperado

Após aplicar, "ceo@grupoamjuridico.com" (e demais clientes) passam a ver o badge azul "CRM — Quadro · Etapa" em todo contato que tem deal ativo no CRM Builder, independentemente de qual fila/conversa está liderando a linha no momento.