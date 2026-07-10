## Diagnóstico (client_id=294, ceo@grupoamjuridico.com)

Rodei a análise nos vínculos chat↔CRM Builder deste cliente:

- Total de deals: **3.449**
- Deals com `custom_fields.links.chat` preenchido: **3.344**
- Deals SEM vínculo com o chat: **105** (103 têm telefone)
- Deals com vínculo apontando para conversa inexistente: **1**
- Registros na tabela `chat_crm_links`: **3.344**

Cruzando os 103 deals órfãos (com telefone) contra o chat:
- **103/103 têm contato correspondente em `chat_contacts`**
- **103/103 têm ao menos uma conversa em `chat_conversations`**

Ou seja: dá para restaurar 100% dos vínculos perdidos deste cliente pegando a conversa mais recente por telefone.

## Plano de restauração

Uma rotina única (SQL de reparo, executada via ferramenta de dados) que, apenas para `client_id='294'`:

1. **Deals sem `custom_fields.links.chat`** (105 casos)
   - Localiza o contato via telefone normalizado em `chat_contacts` (`client_id='294'`).
   - Escolhe a **conversa líder**: `chat_conversations` do mesmo contato, fila não excluída (`queues.is_deleted != true`), maior `updated_at`; desempate por `opened_at`/`created_at`.
   - Se encontrada:
     - Escreve em `crm_deals.custom_fields.links.chat` o objeto `{ conversation_id, contact_id, contact_phone, contact_name }` (mesma forma usada por `getChatLink` em `useCardLinks.ts`).
     - Faz `INSERT` correspondente em `chat_crm_links` (`client_id, cod_agent, conversation_id, contact_id, external_system='crm-builder', external_id=<deal.id>, sync_direction='restore'`), com `ON CONFLICT DO NOTHING` para não duplicar.
   - Se nenhum contato/conversa for encontrado: deal fica como está (registrado em log/relatório).

2. **Deal com `conversation_id` quebrado** (1 caso)
   - Mesma lógica do passo 1, substituindo o `links.chat` pelo par contato/conversa mais recente encontrado por telefone. Se não achar nada, remove o `links.chat` inválido.

3. **Relatório final**
   - Retorno com contagem `restored / skipped / broken_cleaned`, para confirmar o resultado sem precisar rodar nada manualmente.

## Restrições / segurança

- Escopo travado em `client_id='294'` (nada global).
- Nenhuma alteração em conversas, contatos ou filas — só em `crm_deals.custom_fields` e `chat_crm_links`.
- Só grava vínculo quando o telefone bate exatamente após normalização (`regexp_replace(phone,'\D','','g')`) e a fila da conversa não está soft-deleted (`queues.is_deleted != true`), respeitando a regra já aplicada em `useChatConversationPreview` / `useContactConversation`.
- Operação idempotente: se o deal já tem `links.chat`, é ignorado; `chat_crm_links` usa `ON CONFLICT DO NOTHING`.

## Fora de escopo

- Não vou mexer no fluxo que originalmente causou a perda (isso já foi tratado em memórias anteriores como filtro de fila excluída). Aqui só faço o backfill dos vínculos deste cliente.
- Não estendo para outros `client_id` — se quiser rodar para todos depois, faço em um segundo passo.
