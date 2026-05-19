## Diagnóstico

O lead `557599612331` aparece **duas vezes** em `chat_contacts` no client 294:

| id | phone | remote_jid | criado | mensagens |
|----|-------|------------|--------|-----------|
| 31b9d7cc… | `5575999612331` (13 díg, com 9) | `557599612331@s.whatsapp.net` | 08/05 | **5** |
| d9cb2e1c… | `557599612331` (12 díg, sem 9) | `557599612331@s.whatsapp.net` | 15/05 | **0** |

Ao abrir o contato sem 9º dígito, o painel fica vazio — as mensagens existem, mas estão atreladas ao outro registro. Não é um problema de paginação nem de webhook perdendo mensagem; é **duplicação de contato**.

O problema é sistêmico no client 294: há **97 pares duplicados** com o mesmo `remote_jid` mas `phone` diferente (com/sem 9). Boa parte foi criada em 30/04 e 15/05 — datas em que rotinas de sincronização/backfill rodaram.

### Causa raiz

`supabase/functions/uazapi-history-resume/index.ts` (linha ~165 e ~221):

```ts
let phone: string | null = item.phone && !isLidJid(item.remote_jid) ? item.phone : null;
...
await supabase.from('chat_contacts').insert({
  client_id: clientId, phone, ...   // ← phone sem passar por normalizeBrPhone
});
```

O `phone` vem do `remoteJid` do UaZapi (formato legacy, sem o 9), e é gravado direto em `chat_contacts.phone`. A busca por contato existente (`.eq('phone', phone)`) também usa o phone não normalizado, então nunca encontra o registro canônico (com 9) e cria um novo contato vazio.

Como webhooks normais (`uazapi-chat-webhook`) **passam** por `normalizeBrPhone`, novas mensagens continuam caindo no contato canônico com 9 — daí o duplicado fica órfão (zero mensagens) e o usuário vê chat vazio.

Também há ausência de **constraint UNIQUE** em `(client_id, channel_source, remote_jid)`, o que permite a duplicação acontecer.

---

## Plano de correção

### 1. Fix da fonte (uazapi-history-resume)

- Importar `normalizeBrPhone` de `_shared/phone-normalize.ts`.
- Aplicar `phone = normalizeBrPhone(phone)` imediatamente após resolver o telefone (linha ~171).
- Recalcular `remoteJid` a partir do phone normalizado **apenas para gravar/buscar**, mantendo o JID original recebido se necessário em outros pontos.
- Buscar contato existente também por variantes (`brPhoneVariants`) para reaproveitar registros já criados pelo webhook normal.

### 2. Backfill/processador — auditoria rápida

Verificar `uazapi-history-processor`, `uazapi-chat-backfill` e `uazapi-history-import` para garantir que todo `insert` em `chat_contacts` passa por `normalizeBrPhone` e que `.eq('phone', …)` usa o valor normalizado. Aplicar a mesma correção onde faltar.

### 3. Migração de consolidação (dados existentes)

Migration SQL que, para cada par duplicado em `chat_contacts` com o mesmo `(client_id, channel_source, remote_jid)`:

1. Elege como **canônico** o contato cujo `phone` tem 13 dígitos (com 9). Se ambos tiverem o mesmo formato, escolhe o mais antigo (`created_at` menor).
2. Faz `UPDATE chat_messages SET contact_id = canonical_id WHERE contact_id = duplicate_id`.
3. Faz `UPDATE chat_conversations SET contact_id = canonical_id WHERE contact_id = duplicate_id` (e demais tabelas referenciando contato, ex.: `chat_message_notes` se houver).
4. `DELETE FROM chat_contacts WHERE id = duplicate_id`.
5. Atualiza `last_message_at`/`last_message_text`/`unread_count` no canônico a partir do MAX da mensagem mais recente.

### 4. Constraint preventiva

Migration adicional:

```sql
-- Garantir unicidade por canal real
CREATE UNIQUE INDEX IF NOT EXISTS chat_contacts_unique_jid
  ON public.chat_contacts (client_id, channel_source, remote_jid)
  WHERE remote_jid IS NOT NULL AND is_group = false;
```

Isso bloqueia novas duplicações mesmo se algum caminho esquecer de normalizar.

### 5. Validação pós-deploy

- Rodar query de duplicidade para confirmar `0` pares restantes no client 294.
- Reabrir o contato `5575999612331` no /chat e confirmar que as 5 mensagens aparecem e o duplicado sumiu.

---

## Ordem de execução

1. Migration de consolidação (dedup) → 2. Migration de constraint UNIQUE → 3. Patch em `uazapi-history-resume` (+ auditoria nos demais) → 4. Validação.

A correção é segura: nenhuma mensagem é perdida (são apenas re-apontadas) e o contato canônico (com 9) é preservado. O usuário não precisa fazer nada no front.