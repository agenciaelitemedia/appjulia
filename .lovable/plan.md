## Problema observado

Ao entrar no `/chat`, em alguns casos:
1. A área de mensagens não carrega — fica vazia ou em loading "infinito" e só aparece se sair e voltar.
2. O "autoload" (carregar mais ao rolar para o topo) às vezes não dispara.
3. A lista de conversas pode demorar a aparecer e/ou piscar entre estados vazios.

## Causas identificadas (após análise dos arquivos)

### 1. `loadMessages` é instável e refaz fetch desnecessariamente
Em `WhatsAppDataContext.tsx`, `loadMessages` está em `useCallback([clientId])` (linha 947). Toda vez que `clientId` muda (e ele muda na resolução assíncrona do `effectiveClientId` no boot), a referência muda → o `useEffect` de inicial-load do `ChatMessages.tsx` (`[contactId, loadMessages]`) re-dispara, podendo cancelar o setTimeout do scroll inicial e travar o `isInitialLoad.current` em `false` cedo demais, antes do `IntersectionObserver` iniciar — o `topSentinelRef` já está visível na tela vazia e dispara `handleLoadMore` em loop ou nem dispara dependendo do timing.

### 2. Race condition entre `loadMessages` e o `IntersectionObserver`
O `topSentinel` (`<div className="h-1" />`) começa visível desde o primeiro render. O observer é criado no `useEffect` separado, e como `isInitialLoad.current` é setado para `false` dentro de um `setTimeout(150ms)`, há janelas em que:
- O observer pode disparar `handleLoadMore` antes do load inicial terminar (mesmo com a flag, há corrida).
- Ou nunca dispara porque o sentinel saiu de view enquanto `isInitialLoad` ainda era `true`.

### 3. Quando `loadMessages` retorna `[]`, ele NÃO atualiza o estado
Linhas 941-946 retornam `{ messages: [], hasMore: false }` mas **não chamam `setMessages`**. Se houver uma falha intermitente de rede/RLS, o componente fica preso achando que há "mais" para carregar (`hasMore` virou `false` corretamente), mas o `isLoading` é desligado e o usuário vê tela em branco sem retry. Pior: se o componente re-monta com `contactMessages` vazio, mas existir realtime já tendo populado algumas mensagens, o `setMessages` no `loadMessages` quando há `cachedMessages.length > 0` faz `prev[contactId]` = `chatMessages.reverse()` (offset === 0) — sobrescrevendo qualquer mensagem realtime já recebida.

### 4. Realtime de mensagens fica "preso" se a aba do navegador foi suspensa
Não há reconexão / refetch ao voltar o foco (`visibilitychange`). Se o WebSocket cair durante o uso em background, ao voltar para a aba o usuário vê dados antigos até forçar um refresh.

### 5. Lista de conversas refaz query quando muda só o filtro/aba
- `loadContacts` está em `useCallback([..., contacts.length])` (linha 404) — a referência muda a cada novo contato carregado, causando reexecução do `useEffect` de reset (linha 1924) em alguns cenários. O `contacts.length` na dep é só para calcular offset em append, mas vaza para o reset.
- Tabs (`pending`/`open`/`all`) já não refazem query em `chat_conversations` (cache local), bom — mas `loadContacts` é re-chamado pela mudança de período mesmo quando não é necessário.

### 6. `selectContact` chama `getOrCreateConversation` SEMPRE
Mesmo quando já existe uma conversa ativa em memória — só pula para `resolved/closed`. Para `pending/open` faz uma query desnecessária no DB (`select * from chat_conversations`) toda vez que o usuário clica num contato. Atrasa a abertura da conversa em 200-500ms.

## Plano de correção

### A. Estabilizar `loadMessages` (causa principal do autoload quebrado)
- Remover `clientId` das deps de `loadMessages` (não é usado dentro). Usar `useCallback([])` para que a função tenha referência **estável**.
- Em `ChatMessages.tsx`, remover `loadMessages` das deps do effect inicial — manter só `[contactId]`. Usar `useRef` se precisar invocar.
- Quando `loadMessages` retornar `[]` no offset 0 e o estado para esse contato não existir, **inicializar `messages[contactId] = []`** explicitamente para que o componente saia do `isLoading` com estado consistente.

### B. Corrigir o `IntersectionObserver` (autoload)
Em `ChatMessages.tsx`:
- Substituir o sentinel de `h-1` por `h-px` com `data-loaded={!isInitialLoad}` e só **observar** o sentinel após o load inicial concluir (recriar observer no effect com dep `[hasMore, isLoadingMore, contactMessages.length > 0]`).
- Garantir que o observer só dispare `handleLoadMore` se `contactMessages.length > 0` (evita loop em conversas vazias).
- Adicionar `rootMargin: "200px 0px 0px 0px"` para pré-carregar antes de chegar no topo.
- Corrigir preservação de scroll no append: usar `el.scrollHeight - prevScrollHeight.current` mas ancorar no `requestAnimationFrame` duplo (2 frames) — necessário em listas com imagens/áudio.

### C. Não sobrescrever mensagens realtime no load inicial
Em `loadMessages` (offset === 0), em vez de `chatMessages.reverse()` puro, fazer **merge dedup por id**:
```ts
const incoming = chatMessages.reverse();
const existing = prev[contactId] || [];
const seen = new Set(incoming.map(m => m.id));
const realtimeOnly = existing.filter(m => !seen.has(m.id));
return { ...prev, [contactId]: [...incoming, ...realtimeOnly] };
```

### D. Refetch ao voltar foco (resiliência realtime)
Adicionar listener `visibilitychange` no `WhatsAppDataProvider` para, quando a aba voltar a ficar visível após >30s ocultos:
- Refetch leve da página atual de contatos (sem `setIsLoading(true)` para não piscar — usar o banner "Atualizando…" já existente).
- Refetch das mensagens do contato atualmente selecionado (se houver).
- Re-subscribe nos canais realtime (Supabase já tenta reconectar sozinho, mas garantir um `removeChannel` + recreate evita estado "morto").

### E. `selectContact` instantâneo
- Se já existe conversa `pending`/`open` em memória para o contato, **não fazer await** em `getOrCreateConversation`. Disparar fire-and-forget só para garantir cobertura de cenários edge (criação se não houver).
- Mover o `markAsRead` para fora do try principal (já é, mas garantir que não bloqueia o setSelectedContactId).

### F. Estabilizar `loadContacts` 
- Remover `contacts.length` das deps. Calcular offset via `setContacts(prev => ...)` callback ou via state separado `contactsOffset`.
- Resultado: `loadContacts` vira referência estável; o effect de reset (linha 1914) só dispara quando realmente muda `currentQueueId`, `clientId`, `activeQueueIds` ou `periodFilter`.

### G. Skeleton/loading consistente em `ChatMessages`
- Mostrar skeleton de mensagens (3-4 bubbles) enquanto `isLoading && contactMessages.length === 0` em vez do spinner pequeno atual. Dá a sensação de carregamento mais rápido.
- Adicionar timeout de segurança: se após 8s ainda estiver `isLoading`, mostrar botão "Tentar novamente" que re-invoca `loadMessages`.

### H. Pequena otimização no Realtime
- Filtrar mensagens recebidas por `client_id` (já feito) e dropar atualizações para `contact_id` que não estão na lista atual de contatos visíveis (no UPDATE de `chat_messages`). Reduz CPU em clientes com muitas conversas.

## Arquivos a serem alterados

- `src/contexts/WhatsAppDataContext.tsx`
  - `loadMessages` deps + merge dedup
  - `loadContacts` deps (remover `contacts.length`)
  - `selectContact` (não-bloqueante)
  - novo `useEffect` para `visibilitychange`
- `src/components/chat/ChatMessages.tsx`
  - effect de load inicial com deps corretas
  - IntersectionObserver com `rootMargin` e dependências saudáveis
  - skeleton de bubbles em vez de spinner
  - botão "Tentar novamente" com timeout de 8s
- (sem novas migrations / sem mudanças de DB)

## Resultado esperado

- Entrar no `/chat` sempre carrega as mensagens da conversa selecionada na primeira tentativa.
- Autoload (rolar para cima) sempre dispara ao chegar perto do topo, sem loops.
- Mensagens enviadas por outro device aparecem em tempo real e não somem ao re-abrir a conversa.
- Voltar a aba após estar em background revalida silenciosamente os dados sem piscar a tela.
- Lista de conversas mantém posição/scroll quando muda só de aba (Em Aberto / Em Atendimento).
