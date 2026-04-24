

## Problema identificado

**174 dos 309 contatos UaZapi (56%) foram criados com identificador LinkedID (`@lid`) ao invés do número real do WhatsApp.**

Exemplo: contato `54014163079397` tem:
- `phone = 54014163079397` (NÃO é telefone — é um LID interno do WhatsApp)
- `remote_jid = 54014163079397@lid`
- `name = 54014163079397` (sem nome real)
- Mas no payload existe `sender_pn = 552120181195@s.whatsapp.net` (telefone real!)

### Causa raiz

Em `supabase/functions/uazapi-history-processor/index.ts` (linhas 154‑162), o agrupamento de mensagens é feito direto pelo `remoteJid` sem rejeitar `@lid`:

```ts
const remoteJid = msg?.key?.remoteJid ?? msg?.remoteJid ?? msg?.chatId ?? msg?.chatid ?? '';
if (!remoteJid || isGroupMessage(msg) || isGroupJid(remoteJid)) continue; // ❌ não filtra @lid
```

Depois `normalizePhone(remoteJid)` produz um "telefone" de 14 dígitos a partir do LID, e o contato é inserido com esse lixo. O webhook em tempo real (`uazapi-chat-webhook`) JÁ filtra `@lid` corretamente (linha 890), mas o processor de histórico não — daí a divergência.

Adicionalmente, o backfill (`uazapi-chat-backfill`) também usa `phone || chat_id` sem rejeitar `@lid`.

### Regra que vamos aplicar

Em **toda** ingestão de mensagem individual UaZapi:
1. Rejeitar qualquer JID com `@lid` como fonte de telefone
2. Resolver o número real na ordem: `sender_pn` → `chatid` (se for `@s.whatsapp.net` ou puro dígito) → demais campos não-LID
3. Se nenhum candidato válido (8–13 dígitos, sem `@lid`/`@g.us`) for encontrado → **descartar a mensagem** e logar como `skipped.lid`
4. Resolver o nome do lead via `pushName`/`senderName`/perfil UaZapi (`fetchWhatsappProfile`) — nunca usar o número como nome se houver alternativa real
5. Aplicar a mesma regra para o `remote_jid` salvo: sempre `<phone>@s.whatsapp.net`, nunca `@lid`

## Mudanças propostas

### 1. `supabase/functions/uazapi-history-processor/index.ts`
- Adicionar helpers `isLidJid()` e `resolvePeerPhone(msg)` (espelhando a lógica do webhook em tempo real)
- Reescrever o agrupamento para usar `resolvePeerPhone` como chave canônica em vez de `remoteJid` cru
- Descartar mensagens sem telefone válido (incrementar contador `skipped_lid` no run)
- Ao criar contato: usar `<phone>@s.whatsapp.net` como `remote_jid` e tentar `pushName`/perfil para o `name`
- Após o loop, sempre disparar enriquecimento de perfil (`fetchWhatsappProfile`) em background quando o nome ainda for igual ao telefone

### 2. `supabase/functions/uazapi-chat-backfill/index.ts`
- Em `senderPhone = normalizePhone(phone || chat_id)` adicionar rejeição de `@lid` e priorizar `phone` puro
- Se o `chat_id` recebido for `@lid`, NÃO chamar `/message/find` (não há como, é fake) e marcar `history_backfilled=true` para encerrar

### 3. `supabase/functions/uazapi-chat-webhook/index.ts`
- Pequeno reforço: nunca gravar `remote_jid` contendo `@lid` no `chat_contacts` (linha 963) — sempre normalizar para `<senderPhone>@s.whatsapp.net`
- Adicionar contador `skipped.lid` e log explícito

### 4. Migração de saneamento (corrige os 174 contatos já estragados)
Nova migração SQL que, para cada contato com `remote_jid LIKE '%@lid%'`:
- Tenta extrair o telefone real a partir de `chat_messages.raw_payload->>'sender_pn'` (mais frequente desse contato)
- **Se** existir um contato bom com esse telefone → mover mensagens para o contato bom e deletar o LID
- **Se não** existir → atualizar o registro LID: `phone` = telefone real, `remote_jid` = `<phone>@s.whatsapp.net`, `name` = NULL (para enriquecimento posterior)
- Disparar (via marcação `history_backfilled=false` + `profile_fetched_at=NULL`) o enriquecimento na próxima visita

Os contatos que não tiverem nenhum `sender_pn` em nenhuma mensagem ficam com flag `metadata->>'needs_review' = 'lid_unresolved'` para auditoria manual (deve ser muito raro).

### 5. UI — Aba "Histórico UaZapi" em /configuracoes
- Adicionar novo card no painel: **"Mensagens descartadas (LID)"** com tooltip explicando "mensagens sem número real do WhatsApp"
- Mostrar por run: `skipped_lid` (nova coluna em `uazapi_history_runs` e `uazapi_history_items`)

## Detalhes técnicos

```text
Payload UaZapi (history)
        │
        ▼
┌──────────────────────────┐
│ resolvePeerPhone(msg)    │
│  1. msg.sender_pn  ───┐  │
│  2. msg.chatid (não @lid)│
│  3. msg.PhoneNumber  │   │
│  4. msg.from/to (fromMe?)│
│  └──> normalize 8-13d ◄──┘
└──────────────────────────┘
        │
   válido? ──── não ──► skipped.lid++ (descarta)
        │ sim
        ▼
   group by phone real → cria/atualiza contato com remote_jid=<phone>@s.whatsapp.net
```

Migração de saneamento (resumo):
```sql
ALTER TABLE uazapi_history_runs ADD COLUMN skipped_lid INT DEFAULT 0;
ALTER TABLE uazapi_history_items ADD COLUMN skipped_lid INT DEFAULT 0;

WITH lid_contacts AS (
  SELECT cc.id, cc.client_id,
         (SELECT regexp_replace(cm.raw_payload->>'sender_pn','\D','','g')
            FROM chat_messages cm
           WHERE cm.contact_id=cc.id
             AND cm.raw_payload->>'sender_pn' ~ '^\d+@s\.whatsapp\.net'
           GROUP BY cm.raw_payload->>'sender_pn'
           ORDER BY count(*) DESC LIMIT 1) AS real_phone
    FROM chat_contacts cc
   WHERE cc.remote_jid LIKE '%@lid%'
)
-- merge ou update conforme existir contato bom
...
```

## Arquivos afetados
- `supabase/functions/uazapi-history-processor/index.ts` (refactor + helpers)
- `supabase/functions/uazapi-chat-backfill/index.ts` (rejeitar `@lid`)
- `supabase/functions/uazapi-chat-webhook/index.ts` (hardening)
- `supabase/functions/_shared/whatsapp-profile.ts` (sem mudança, apenas chamado mais vezes)
- `supabase/migrations/<timestamp>_fix_lid_contacts.sql` (nova — saneamento + 2 colunas)
- `src/pages/configuracoes/components/UazapiHistoryTab.tsx` (novo card "LID descartado")
- `src/pages/configuracoes/hooks/useUazapiHistoryRuns.ts` (incluir `skipped_lid`)
- `src/integrations/supabase/types.ts` (regenerado automaticamente)

## Resultado esperado
- Nenhum novo contato será criado a partir de `@lid` — mensagens sem telefone real são descartadas e contabilizadas
- Os 174 contatos LID atuais serão mesclados com seus equivalentes reais (ou corrigidos in‑place) e perfil reenriquecido
- Painel de monitoramento ganha visibilidade da nova métrica

