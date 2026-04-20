

## Diagnóstico

Olhando o screenshot:
- **AGENTE PRINCIPAL** (fila com agente IA vinculado) → mostra ícone **User 👤** ❌ (deveria ser Bot 🤖)
- **OFICIAL** (fila SEM agente IA vinculado) → mostra ícone **Bot 🤖** ❌ (deveria ser User 👤)

Está **invertido**. Causa provável no `useQueueAgentLink` / `useQueueAgentLinks`:

```ts
const { data, error } = await supabase
  .from('queue_agent_links')
  .select('cod_agent, is_primary')
  .eq('queue_id', queueId);
```

A tabela `queue_agent_links` **mora no banco externo (CRM)**, igual `queues` e tudo do módulo `/agente/filas` — **não no Supabase Cloud**. Como o cliente Supabase Cloud não tem essa tabela, a query:
- ou retorna erro silencioso → `hasAgent=false` para todas (não bate com o screenshot)
- ou retorna dados de uma tabela homônima vazia/diferente → resultado inconsistente / invertido

Preciso confirmar onde `queue_agent_links` está hospedada e como o resto do `/chat` lê filas (provavelmente via `externalDb` / edge function).

## Investigação prevista
1. Ler `src/pages/agente/filas/hooks/useQueues.ts` para ver como `queue_agent_links` é carregada (cliente externo vs supabase).
2. Ler `src/lib/externalDb.ts` para entender o método de query usado.
3. Ler `ChatList.tsx` / hook que carrega `chat_conversations` para entender de qual base vêm `queue_id` e como mapear.

## Solução proposta (definitiva)

### 1. Corrigir fonte de dados de `queue_agent_links`
Trocar em `src/hooks/useQueueAgentLink.ts` o `supabase.from('queue_agent_links')` por **chamada ao banco externo** (mesmo método usado em `useQueues.ts`). Isso vale para as duas variantes (`useQueueAgentLink` single e `useQueueAgentLinks` batch).

### 2. Garantir match correto por `queueId`
- `chat_conversations.queue_id` (Supabase Cloud) deve referenciar o `id` da fila no banco externo. Confirmar no hook de filas que o `id` usado é o mesmo.
- Se houver descasamento de tipo (uuid string), normalizar para string nas duas pontas.

### 3. Fallback seguro
- Enquanto a query estiver carregando (`isLoading`), **não renderizar badge** (já é o comportamento — manter).
- Se o `queueId` não for encontrado em `queue_agent_links`, considerar `hasAgent=false` (User icon) — já é o comportamento.

### 4. Validação visual
Após a correção:
- AGENTE PRINCIPAL → Bot verde/vermelho conforme `useAgentSessionStatus`.
- OFICIAL → User verde se `assigned_to` preenchido, vermelho se vazio (no screenshot: "MARIO CASTRO" → verde).

## Arquivos previstos
- `src/hooks/useQueueAgentLink.ts` — trocar fonte para banco externo (single + batch).
- (Possível) `src/lib/externalDb.ts` — adicionar método helper `getQueueAgentLinks(queueIds[])` se ainda não existir.

## Não-quebra
- Nenhuma mudança em assinatura de componentes.
- `/atendimento-humano`, CRM, Campanhas continuam no caminho legado J/H.
- `/agente/filas` continua usando seu próprio hook de filas.

