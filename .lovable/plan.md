## Contexto e viabilidade

Hoje as **conversas** (não as mensagens — o termo "1000 mensagens" no pedido se refere aos itens da lista do chat) são carregadas assim:

- Aba **Em aberto** (`pending`+`open`): página de **500** + auto-loop **infinito** até esgotar.
- Abas **Resolvidas** / **Fechadas**: página de 500, cap de **10 páginas (5.000)**, lazy ao ativar a aba.

### Sua proposta vs. realidade

| Item | Hoje | Proposta | Avaliação |
|---|---|---|---|
| Carga inicial | 500 | 1.000 | ✅ Viável. 1k linhas de `chat_conversations` (~50 colunas leves) ≈ 600KB-1MB JSON. Render é o gargalo, não o fetch. |
| Total memória | ilimitado (active) | sob demanda | ✅ Reduz pico e DOM. |
| Bloco "carregar mais" | 500 | 100 | ✅ Bom para UX (rápido), mas excessivo em RTT se usuário rolar muito. Recomendo **200**. |
| 2k clientes simultâneos | — | — | ✅ A query é por `client_id` + `queue_id` indexados; cada cliente vê só seus dados. Sem efeito cruzado. |

### Risco real no browser do cliente

O custo NÃO está em armazenar 1.000 objetos (memória ínfima ~1MB), e sim:

1. **Render da lista** — hoje a `ChatList` não é virtualizada; renderiza todos os itens visíveis no DOM. 1.000 linhas × ~10 nós = ~10k nós DOM ⇒ scroll trava em máquinas fracas.
2. **Classificação Julia/Humano** — para cada conversa dispara `useAgentSessionStatusesBatch` (já corrigido recentemente para chunks). Mais conversas = mais pares de sessão para resolver antes do filtro estabilizar.
3. **Hidratação de contatos faltantes** — `useChatContactsByIds` faz `IN (...)`. 1.000 ids num único IN é pesado; já usa cache mas precisa fragmentar.

## Plano

### 1. Reduzir página inicial e introduzir "load more" real
- `CONVERSATIONS_PAGE_SIZE = 1000` (era 500) — usado só como **primeira página**.
- Novo: `CONVERSATIONS_NEXT_PAGE_SIZE = 200` para páginas subsequentes.
- Refatorar `loadConversationsPage` para receber `pageSize` e `loadMoreConversations` para usar o tamanho menor.
- **Desativar o auto-loop infinito** da aba `active`. Carrega 1.000 e para. Próximas páginas só por scroll/botão.
- Aplicar mesma regra para `resolved`/`closed` (1k inicial, depois 200).

### 2. Auto-load por scroll (já existe parcialmente)
- A `ChatList` tem `IntersectionObserver` que chama `loadMoreConversations`. Garantir que dispara com `rootMargin` de ~400px para pré-carregar antes do usuário ver o fim.
- Mostrar skeleton de 3 linhas no rodapé enquanto carrega.

### 3. Virtualização da lista (chave para performance)
- Adicionar `@tanstack/react-virtual` (já comum em projetos React) na `ChatList` para renderizar só os ~20 itens visíveis. Sem isso, 1.000 itens no DOM degradam scroll mesmo com fetch otimizado.
- Mantém o filtro tri-state e o sentinel para infinite scroll.

### 4. Fragmentar hidratação de contatos
- `useChatContactsByIds`: dividir `ids` em chunks de 200 e fazer queries paralelas via `useQueries`. Evita query `IN` gigante e melhora cache (chunk estável).

### 5. Telemetria leve
- Logar tempo de fetch da página inicial e contagem total de conversas em memória no console (apenas em dev). Ajuda a validar que o limite de 1k é suficiente para 95% dos usuários.

### Arquivos afetados
- `src/contexts/WhatsAppDataContext.tsx` — constantes, `loadConversationsPage`, `runConvAutoLoad`, bootstrap effect.
- `src/components/chat/ChatList.tsx` — virtualização, sentinel, skeleton.
- `src/hooks/useChatContactsByIds.ts` — chunking via `useQueries`.
- `package.json` — adicionar `@tanstack/react-virtual`.

### Não muda
- Mensagens dentro da conversa (já paginadas em 50 e funcionando).
- Realtime, tri-state filter, banner de classificação.

### Resposta direta às suas dúvidas
- **2k clientes** — sem problema; cada um só puxa as próprias filas/conversas.
- **1000 no browser** — tranquilo em memória; **só fica pesado sem virtualização**. Por isso o item 3 é obrigatório.
- **Bloco de 100** — funcional, mas 200 reduz pela metade os RTTs em listas longas com a mesma percepção de fluidez. Posso usar 100 se preferir.
