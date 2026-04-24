## Plano: filtros pré-enqueue para eventos history (UaZapi)

Aplicar dois filtros no `uazapi-chat-webhook` **somente para eventos identificados como history** (replay/sync inicial), **antes de inserir** em `uazapi_history_items`. Eventos de mensagens em tempo real seguem inalterados.

### Local único de mudança
`supabase/functions/uazapi-chat-webhook/index.ts` — função `enqueueHistoryRun()` (linhas ~258-336).

---

### Filtro 1 — Grupos (reforço do existente)

Hoje já há `if (isGroupMessage(msg) || remoteJid.includes('@g.us')) { groupMessages++; continue; }` no loop de agrupamento. Está correto e fica como está. Apenas:

- Adicionar log resumido: `console.log('[history-enqueue] groups skipped: X / total: Y')` quando `groupMessages > 0`, para visibilidade.
- Garantir que mensagens com `key.participant` preenchido (indicador forte de grupo mesmo sem `@g.us` no remoteJid) sejam descartadas — `isGroupMessage` já cobre isso.

Custo: zero query, ~0ms. Continua eliminando 70-95% do volume típico de history.

---

### Filtro 2 — Dedup por `external_id` contra `chat_messages`

Após agrupar por chat e antes do `insert` em `uazapi_history_items`, fazer **um único SELECT em batch** para descobrir quais `external_id`s já existem.

**Fluxo:**

1. Coletar todos os `messageId` (= `msg.key?.id` ou `msg.messageid` ou `msg.id`) das mensagens já filtradas (sem grupos).
2. Uma query:
   ```sql
   SELECT external_id
   FROM chat_messages
   WHERE client_id = $1
     AND external_id = ANY($2)
   ```
   Usa o índice `idx_chat_messages_ext_lookup` (parcial em `external_id`).
3. Construir `Set<string>` dos IDs já presentes.
4. No loop de agrupamento, descartar mensagens cujo `messageId` está no Set. Contabilizar em novo campo `duplicate_messages` (já existe esquema com `duplicate_messages` em items — manter compatível adicionando contagem agregada no run).
5. Se um chat fica com 0 mensagens após dedup, não enfileirar item daquele chat.
6. Se todos os chats ficam vazios, marcar run como `done` direto (mesmo branch já existente quando `byChat.size === 0`).

**Performance:** 1 SELECT por evento history (não por mensagem). Em batches de 200-1000 mensagens, custa <50ms. Índice cobre 100%.

**Edge cases:**
- Mensagens sem `messageId` (raras): não dá pra deduplicar — mantém no batch (comportamento atual).
- Quando `external_id` veio de outra fila do mesmo cliente (cenário anti-eco): será detectado como duplicata e descartado — ganho extra grátis.

---

### Métricas adicionadas em `uazapi_history_runs`

Aproveitar campos já existentes (`group_messages`) e adicionar contagem de duplicados via update na inserção do run. Verificar se a coluna `duplicate_messages` existe no `uazapi_history_runs`; se não existir, adicionar via migração simples:

```sql
ALTER TABLE public.uazapi_history_runs
  ADD COLUMN IF NOT EXISTS duplicate_messages integer NOT NULL DEFAULT 0;
```

Isso permite ver no painel de monitoramento quantas msgs foram cortadas como duplicata vs. grupo vs. processadas.

---

### O que NÃO muda

- `uazapi-history-resume` / `uazapi-history-processor`: nenhuma alteração. Continuam recebendo apenas itens "limpos".
- `uazapi-history-dispatcher`: inalterado.
- Webhook de mensagens em tempo real (`event === 'messages'` sem flag history): inalterado. Sem dedup extra, sem custo adicional.
- `chat-webhook-dispatcher` (webhooks externos para Slack/Discord/etc): fora do escopo.

---

### Ordem de execução final em `enqueueHistoryRun`

```text
1. Loop mensagens:
   ├─ Skip se grupo (filtro 1, já existe)
   └─ Coletar messageId em lista
2. SELECT external_id batch em chat_messages (filtro 2, NOVO)
3. Loop mensagens novamente (ou no mesmo loop em 2 passos):
   ├─ Skip se duplicado (filtro 2)
   └─ Agrupar por chat
4. Insert run (com group_messages + duplicate_messages)
5. Insert items (apenas chats com mensagens novas)
```

---

### Resultado esperado

- **Volume enfileirado**: redução típica de 80-95% (grupos + reprocessamentos + ecos entre filas).
- **Custo do worker pool** (`uazapi-history-resume`): cai proporcionalmente — menos download de mídia, menos upserts em `chat_contacts`, menos triggers de realtime.
- **Tempo de drenagem do backlog**: eventos history grandes (1000+ msgs) processam em segundos em vez de minutos.

---

### Detalhes técnicos

**Arquivo único editado:** `supabase/functions/uazapi-chat-webhook/index.ts`

**Migração:** 1 ALTER TABLE adicionando `duplicate_messages` em `uazapi_history_runs` (se ainda não existe).

**Deploy:** apenas `uazapi-chat-webhook`.

**Rollback:** trivial — remover o SELECT de dedup; comportamento volta ao atual.

Confirma para implementar?