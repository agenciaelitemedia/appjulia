# Fazer o vínculo com o CRM aparecer no chat

## Causa confirmada

O botão CRM só fica azul quando `useChatDealLink` encontra um card — e ele procura **exclusivamente** dentro de `crm_deals.custom_fields.links.chat` (por `contact_id`, `conversation_id` ou `contact_phone`).

Verificado no banco:

- Os cards do escritório 405 têm `custom_fields = {}` — nenhum deal desse cliente tem a chave `links` (0 de todos).
- Ao mesmo tempo existem **27 linhas em `chat_crm_links`** (`external_system = 'crm_builder'`) para o cliente 405, ou seja: o vínculo existe, mas em outra tabela.
- Motivo: quem cria esses cards é a automação (`_shared/flow-engine/crm-actions.ts`). Ela grava o vínculo apenas em `chat_crm_links` (`linkConversation`) e insere o deal **sem** `custom_fields`. Já o `CreateCrmCardSheet` (criação manual pelo chat) grava nos dois lugares.

Resultado: cards criados por automação ficam "invisíveis" para o botão CRM do chat.

## O que será feito

1. **Automação passa a gravar o vínculo no card também**
   Em `actionCrmCreateCard`, incluir no insert `custom_fields: { source: 'automation', links: { chat: { conversation_id, contact_id, contact_phone, contact_name } } }`, com os dados do contexto do run. `linkConversation` continua gravando `chat_crm_links` (compatibilidade com `findDeal`).

2. **Fallback de leitura no chat**
   Em `useChatDealLink`, adicionar um 4º estágio: se nada for encontrado por `custom_fields`, buscar em `chat_crm_links` (por `conversation_id`, e por `contact_id` como âncora estável) o `external_id` e carregar o deal por `id` (filtrando `client_id` e `status != 'archived'`). Ao achar por esse caminho, reaproveitar o auto-reparo já existente para gravar `links.chat` no card — assim as próximas leituras acertam no estágio 1.

3. **Backfill dos vínculos antigos**
   Migração de dados que preenche `custom_fields.links.chat` nos `crm_deals` que já têm linha em `chat_crm_links` (`external_system = 'crm_builder'`), sem sobrescrever `links` já existentes. Isso faz o botão CRM ficar azul imediatamente nas conversas antigas, incluindo as 27 do escritório 405.

4. **Mesmo vínculo no CRM Builder**
   Com `links.chat` preenchido, o bloco "Vinculado ao Chat" (`DealLinksSection`) passa a aparecer nesses cards automaticamente — nenhuma mudança extra necessária.

## Detalhes técnicos

- Arquivos: `supabase/functions/_shared/flow-engine/crm-actions.ts`, `src/hooks/useChatDealLink.ts`.
- Redeploy de `chat-flow-engine` e `chat-flow-scheduler`.
- O backfill é `UPDATE ... jsonb_set` em `crm_deals`, restrito a deals com vínculo em `chat_crm_links` e sem `links` no `custom_fields`.
- Nada muda no `client_id` usado (chat e CRM Builder já usam `user.client_id` de forma consistente).
