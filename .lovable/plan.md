# Otimização Lista de Conversas — Julia, CRM Builder e Meta Ads

## 1. Como os dados são vinculados hoje

**Julia (etapa/status IA)** — `useCRMStageByPhone(pairs)` recebe pares `{ phone, codAgent }` derivados do `queue_id → cod_agent` (mapa `queueAgentMap`). Retorna `stageName/stageColor` por telefone. Vinculação: **telefone + cod_agent do agente da fila**.

**CRM Builder (quadro/pipeline)** — `useCRMBuilderLinkedConversations()` monta um `Map<conversation_id, CrmBuilderLink>` a partir de `chat_crm_links` (tabela local Supabase). Vinculação: **conversation_id → board/pipeline**.

**Meta Ads (campanha)** — `useContactsCampaignsMap(phones)` faz **1 única query** no banco externo (`campaing_ads` + `sessions`) filtrando por `regexp_replace(...) = ANY($1::varchar[])` com todas as variantes BR do telefone; devolve `Map<phone, campaign>`. Vinculação: **telefone (após normalização) → campaign_data**.

## 2. Diagnóstico do problema atual (Meta Ads lento / “some” ao rolar)

- `campaignPhones` é derivado apenas de `filteredContacts` (contatos paginados/visíveis). A cada nova página, o array cresce, o `queryKey` muda e o React Query descarta o `data` anterior — durante o refetch a linha “Meta Ads” some.
- A query externa faz regex por linha em `campaing_ads` sem índice funcional; com listas maiores fica lenta (100–500 telefones × varredura de tabela).
- Sem `placeholderData: keepPreviousData`, cada mudança causa flicker/perda visual.
- Não há cache persistente entre páginas — telefones já resolvidos são reconsultados.
- Não há debounce; scroll rápido dispara múltiplos refetches.

## 3. Plano de otimização

### 3.1 Frontend (`useContactCampaigns.ts` + `ChatList.tsx`)

1. **`placeholderData: keepPreviousData`** em `useContactsCampaignsMap` — o mapa anterior permanece visível enquanto novos telefones carregam. Elimina o “some ao rolar”.
2. **Cache incremental persistente** — manter um `useRef<Map<phone, ContactCampaignRow | null>>` no `ChatList` (ou dentro do próprio hook via `queryClient.setQueryData`) que acumula resultados. A cada refetch, só consulta **telefones ainda não resolvidos** (inclusive marcando `null` para “sem campanha” evitando re-queries).
3. **Debounce de 250 ms** sobre `campaignPhones` para agrupar mudanças durante scroll rápido.
4. **Chunk de 200 telefones por request** para manter cada query rápida e paralelizável.
5. Aplicar o mesmo padrão (`keepPreviousData`) em `useCRMStageByPhone` para eliminar flicker do badge da Júlia.

### 3.2 Banco externo — índice funcional

Adicionar (fora do escopo Supabase local — orientar o usuário / executar via migration no BD externo se aplicável):

```sql
CREATE INDEX IF NOT EXISTS idx_campaing_ads_phone_norm
  ON campaing_ads ((regexp_replace(coalesce((campaign_data::jsonb->>'phone'),''), '\D', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_sessions_whatsapp_norm
  ON sessions ((regexp_replace(coalesce(whatsapp_number::text,''), '\D', '', 'g')));
```

Se acesso ao BD externo não permitir DDL, manter só as otimizações de frontend + edge function (item 3.3).

### 3.3 (Opcional, se índices não puderem ser criados) Edge Function + cache

- Nova edge function `contacts-campaigns-map` que:
  - Recebe lista de telefones.
  - Faz a query externa uma vez.
  - Cacheia resultado em `link_preview_cache`-like (TTL 5–10 min) por telefone normalizado.
- Frontend passa a chamar essa function em vez de `externalDb.raw`, com cache lado servidor entre usuários.

## 4. Arquivos afetados

- `src/components/chat/hooks/useContactCampaigns.ts` — `keepPreviousData`, chunking, cache incremental.
- `src/components/chat/ChatList.tsx` — debounce de `campaignPhones`, opcionalmente `campaignPhones` derivado de `sortedConversations` (não só `filteredContacts`) para pré-carregar linhas futuras.
- `src/pages/crm/hooks/useCRMData.ts` (ou onde vive `useCRMStageByPhone`) — `keepPreviousData`.
- (Opcional) `supabase/functions/contacts-campaigns-map/index.ts` — nova função com cache.

## 5. Resultado esperado

- Meta Ads/CRM/Júlia aparecem já na primeira pintura e **permanecem visíveis** ao rolar.
- Consultas subsequentes só buscam telefones novos.
- Tempo de resposta da query externa cai (índice funcional) de segundos para <100 ms mesmo com centenas de telefones.
