## Causa raiz

A aba "Em aberto" usa o auto-load eager (`runConvAutoLoad('active', POSITIVE_INFINITY)`) e funciona; o problema do filtro "humano vs Julia" não é a paginação de conversas em si, mas três condições de corrida que aparecem juntas quando há ~1.6k conversas:

1. **`queueAgentMap` chega depois das conversas.** Em `getConversationMode` (ChatList.tsx:465-474), enquanto `queueAgentMap` ainda não retornou para uma `queue_id`, `queueLink` é `undefined` → cai em `return 'human'`. Resultado: ao filtrar por "humano", entram conversas que na verdade são Julia ativa.

2. **`sessionActiveMap` é construído incrementalmente.** O hook `useAgentSessionStatusesBatch` recalcula a queryKey a cada mudança de `sessionPairs` (que cresce conforme `contacts` é paginado por scroll de 50 em 50). Cada novo lote dispara um novo fetch e, no intervalo, `getSessionActive` devolve `undefined`, classificado como `'human'` na linha 460/471. Por isso, ao rolar, conversas "vão aparecendo como Julia" — elas estavam temporariamente classificadas como humano.

3. **`sessionPairs` depende de `contacts`, não de `conversations`.** O loop que monta os pares (linhas 352-368) só inclui contatos já carregados na paginação de `chat_contacts` (50 em 50). Conversas cujo `contact_id` ainda não foi paginado nunca entram no batch de sessão e ficam permanentemente classificadas como humano até o usuário rolar e disparar `loadMoreContacts`.

A combinação faz com que o filtro "humano" mostre lixo (conversas Julia) que vai sumindo conforme: (a) `queueAgentMap` carrega, (b) `sessionActiveMap` cresce, (c) contatos faltantes são paginados.

## Objetivo

Filtro "Progressivo seguro": a lista pode crescer aos poucos, mas **nenhum item é classificado como `julia` ou `human` até termos os dados mínimos** (queue link + sessão) para aquele item. Itens "indefinidos" ficam ocultos do filtro humano/Julia em vez de cair no balde errado.

## Mudanças

### 1. `src/components/chat/ChatList.tsx` — classificação tri-state

Trocar `getConversationMode` / `getContactMode` para retornar `'julia' | 'human' | 'unknown'`:

- `unknown` quando: `queueAgentMap` ainda não carregou para a queue, OU `queueLink.hasAgent === true` mas `sessionActiveMap` ainda não tem entrada para `(phone, codAgent)` E o batch ainda está em fetch/pending.
- `human` só quando: queue confirmada sem agente, OU sessão confirmadamente ausente/`active=false`.
- `julia` só quando: sessão confirmada com `active=true`.

No filtro (linhas 515-517, 673-676, 786-788): `if (modeFilter !== 'all' && mode !== modeFilter) continue` — itens `unknown` ficam de fora do "humano" E do "Julia". Isso elimina o vazamento entre as duas abas.

Expor o estado de carregamento do `useAgentSessionStatusesBatch` (`isFetching`, `isPending`) e do `useQueueAgentLinks` para o `getConversationMode` saber quando ainda há dados em voo (e portanto retornar `unknown` em vez de `human`).

### 2. `src/components/chat/ChatList.tsx` — construir `sessionPairs` a partir de `conversations`, não `contacts`

Hoje (linha 355) o loop é `contacts.forEach`. Trocar por `sortedConversations.forEach` usando o `convMetaByContact` (que já tem queueId) e juntar com o telefone do contato — quando o contato ainda não está carregado, usar o telefone derivado do `remote_jid` da conversa (já existe no schema). Isso garante que **todas as conversas em memória entram no batch de sessão**, mesmo antes do contato ser paginado, eliminando a classificação errada por contato faltante.

### 3. `src/components/chat/ChatList.tsx` — banner de status do filtro

Quando `modeFilter !== 'all'` E (`queueAgentMap` ainda carregando OU `sessionActiveMap.isFetching` OU `missingContactIds.length > 0`), mostrar um banner discreto no topo da lista: "Classificando conversas… (X/Y prontas)" com contador baseado em `pairs resolvidos / pairs totais`. Substitui a sensação de "filtro errado" por "filtro ainda processando".

### 4. `src/contexts/WhatsAppDataContext.tsx` — pré-carregar contatos das conversas em memória

Adicionar, dentro do `runConvAutoLoad('active', ...)` (após cada página chegar), um disparo silencioso: pegar `contact_id`s da página que **não estão** em `contacts` e fazer um `select` em lote para hidratar a cache local de `contacts` (sem alterar `hasMoreContacts`/paginação visual). Reduz o `missingContactIds` a quase zero antes do usuário aplicar o filtro.

Limites:
- Lote de até 200 ids por chamada.
- Marcar esses contatos como "hidratação silenciosa" para o `loadMoreContacts` continuar funcionando normal sem duplicar.

### 5. `useAgentSessionStatusesBatch` — estabilizar fetch incremental

A queryKey muda toda vez que um novo par entra (a cada lote de contatos). Trocar para uma estratégia incremental: dividir `pairs` em "chunks estáveis" (ordenado por `phone:codAgent`, agrupado em janelas de 200) e usar `useQueries` por chunk. Resultado: chunks já resolvidos não refazem fetch quando novos pares chegam, e o `Map` final é a união dos chunks. Reduz drasticamente o tempo em que o filtro fica "incompleto".

## Detalhes técnicos

```ts
// ChatList.tsx
type ConvMode = 'julia' | 'human' | 'unknown';

const getConversationMode = (conv): ConvMode => {
  if (queueAgentLoading) return 'unknown';
  const link = conv.queue_id ? queueAgentMap?.get(conv.queue_id) : undefined;
  if (!link) return 'unknown';            // queue não resolvida
  if (!link.hasAgent) return 'human';     // queue sem agente Julia → humano
  const phone = contactPhoneById.get(conv.contact_id) ?? phoneFromRemoteJid(conv);
  if (!phone) return 'unknown';
  const active = getSessionActive(phone, link.codAgent);
  if (active === undefined) {
    return sessionStatusesIsFetching ? 'unknown' : 'human';
  }
  return active ? 'julia' : 'human';
};
```

```ts
// sessionPairs a partir de conversas
const sessionPairs = React.useMemo(() => {
  const pairs = []; const seen = new Set();
  for (const conv of sortedConversations) {
    const link = conv.queue_id ? queueAgentMap?.get(conv.queue_id) : undefined;
    if (!link?.hasAgent || !link.codAgent) continue;
    const phone = (contactPhoneById.get(conv.contact_id) ?? phoneFromRemoteJid(conv) ?? '')
      .replace(/\D/g, '');
    if (!phone) continue;
    const key = `${phone}:${link.codAgent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ whatsappNumber: phone, codAgent: link.codAgent });
  }
  return pairs;
}, [sortedConversations, queueAgentMap, contactPhoneById]);
```

A normalização BR (`normalizeBrPhone` / `brPhoneVariants`) já está dentro de `useAgentSessionStatusesBatch`, então o lookup em `getSessionActive` continua válido.

## Critérios de aceitação

- Trocar de "Em aberto" → filtro "Atendimento humano" não exibe nenhuma conversa com badge "Julia ativa", em qualquer momento da rolagem.
- Enquanto o batch de sessões está carregando, o contador "X de Y" pode crescer, mas itens nunca migram da aba humano para Julia (ou vice-versa) após aparecerem.
- Banner "Classificando conversas…" aparece e some quando todos os pares estão resolvidos.
- Sem regressão na aba "Em atendimento" / "Resolvidos / Fechados".
