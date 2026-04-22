

# Por que a sincronização trouxe mensagens, mas o /chat não foi atualizado

## O que descobri

Olhei o último job (`877f9b93`, cliente 300, 15 números) e os logs por número:

| phone | messages_found | messages_inserted | contact_created |
|---|---|---|---|
| 5522998770726 | 3 | **0** | sim |
| 554896361439 | 30 | **0** | sim |
| 558491298778 | 4 | **0** | sim |
| ... (todos os 15) | >0 | **0** | sim |

Resultado real: 15 contatos criados, **0 mensagens inseridas em todos os contatos**. Confirmei na tabela `chat_contacts`: os 3 contatos criados existem, têm `unread_count=0`, `history_backfilled=true`, e cada um com `msg_count=0`. Por isso o /chat não mostra nada — os contatos aparecem vazios.

## A causa raiz

O upsert em `chat_messages` está usando `onConflict: 'message_id'`, mas existem **dois** índices únicos na tabela:

1. `idx_chat_messages_message_id_unique` em `(message_id)` ← o que esperamos
2. `idx_chat_messages_contact_external` em `(contact_id, external_id)` ← este também é único

Como o código também passa `external_id: messageId`, e webhooks anteriores podem ter gravado a mesma mensagem com **outro `contact_id`** (vinculado a outro agente/cliente), o segundo índice dispara conflito. Combinado com `ignoreDuplicates: true`, o PostgREST silenciosamente devolve `count: 0` e o loop pula para a próxima — **sem erro, sem log**, mas sem inserir nada.

Outra hipótese (precisa verificar com try/catch real): mensagens com `timestamp` inválido ou `text` nulo combinado com algum NOT NULL constraint estão sendo rejeitadas em massa, mas o `error` está vindo `null` porque o `ignoreDuplicates: true` engole erros de conflito. Os 708 registros já existentes em `chat_messages` com `channel_type='whatsapp_uazapi'` reforçam que a tabela está sendo populada por outra rota (webhook em tempo real) — então o backfill colide com tudo.

## Como corrigir

Mudança cirúrgica em `supabase/functions/uazapi-history-import/index.ts` (sem migrations, sem mexer no /chat):

### 1. Trocar a estratégia de upsert para detectar e logar de verdade

Em vez de `upsert + ignoreDuplicates`, fazer:

```ts
// 1) Verifica se a mensagem já existe (por message_id OU por contact_id+external_id)
const { data: existing } = await supabase
  .from('chat_messages')
  .select('id, contact_id')
  .or(`message_id.eq.${messageId},and(contact_id.eq.${contactId},external_id.eq.${messageId})`)
  .maybeSingle();

if (existing) {
  // Já existe — se for em outro contact_id, re-vincular ao contato correto do backfill
  if (existing.contact_id !== contactId) {
    await supabase.from('chat_messages')
      .update({ contact_id: contactId })
      .eq('id', existing.id);
  }
  continue; // não conta como inserted
}

// 2) Insert real
const { error: insErr } = await supabase
  .from('chat_messages')
  .insert({ /* mesmos campos de hoje */ });

if (insErr) {
  console.warn(`[insert msg failed] phone=${phone} msg=${messageId} err=${insErr.message}`);
  continue;
}
inserted++;
```

Isso:
- **Insere** as mensagens novas (problema atual resolvido).
- **Re-vincula** mensagens já existentes em outro contato para o contato do backfill (caso webhook anterior tenha criado em contato órfão).
- **Loga erros reais** no console da edge function (hoje estão sendo silenciados pelo `ignoreDuplicates`).

### 2. Ajustar `external_id` para evitar futuros conflitos cruzados

Em vez de `external_id: messageId` (que colide com webhooks vindos de outras instâncias usando o mesmo ID), usar:

```ts
external_id: `backfill:${messageId}`
```

Mantém idempotência por `message_id` (campo global) sem brigar com o índice composto `(contact_id, external_id)` populado pelos webhooks.

### 3. Reprocessar o job que falhou

Depois do fix deployado, o usuário clica em **Reiniciar** no histórico do job `877f9b93` — a mesma lógica de reaproveitamento que já existe vai re-rodar com o código corrigido. Os 15 contatos vazios serão preenchidos com as mensagens.

## Resumo de Arquivos

- **Editar:** `supabase/functions/uazapi-history-import/index.ts` (substituir upsert por insert+lookup + prefixo `backfill:` em `external_id`)

Sem migrations, sem mudanças no /chat, sem impacto em webhooks em tempo real.

