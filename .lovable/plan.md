## Objetivo
No `/chat`, definir o filtro de período padrão como **"Todos"**, mantendo carregamento sob demanda (50 por página), com auto-carregamento via scroll e fallback de link "Carregar mais".

## Estado atual (já existente)
- `CONTACTS_PAGE_SIZE = 50` em `WhatsAppDataContext.tsx`
- Paginação server-side via `.range(offset, offset + 49)` no Supabase
- `hasMoreContacts`, `isLoadingMoreContacts`, `loadMoreContacts()` já implementados
- `IntersectionObserver` em `ChatList.tsx` (sentinela `bottomSentinelRef`) já dispara `loadMoreContacts` ao chegar perto do fim
- Filtro padrão atual: `periodFilter = 'last7days'`

## Mudanças

### 1. Padrão "Todos" (`src/contexts/WhatsAppDataContext.tsx`, linha 287)
Trocar:
```ts
const [periodFilter, setPeriodFilter] = useState<ChatPeriodFilter>('last7days');
```
por:
```ts
const [periodFilter, setPeriodFilter] = useState<ChatPeriodFilter>('all');
```
Quando `periodFilter === 'all'`, `getPeriodCutoffISO` já retorna `null` e nenhum `gte('last_message_at', ...)` é aplicado — a query naturalmente percorre todos os contatos, ordenados por `last_message_at desc`, paginando de 50 em 50.

### 2. Link "Carregar mais" como fallback (`src/components/chat/ChatList.tsx`, ~linha 1252-1265)
Logo abaixo do `bottomSentinelRef` (que continua existindo para auto-load), adicionar um botão visível enquanto `hasMoreContacts && !isLoadingMoreContacts`:

```tsx
{hasMoreContacts && !isLoadingMoreContacts && finalVisibleContacts.length > 0 && (
  <div className="flex justify-center py-3">
    <button
      onClick={() => loadMoreContacts()}
      className="text-xs text-primary hover:underline"
    >
      Carregar mais conversas
    </button>
  </div>
)}
```

Isso garante que, mesmo se o `IntersectionObserver` falhar (root sem altura, scroll virtualizado, etc.), o usuário tenha como avançar manualmente. O texto "Fim da lista" já existente continua aparecendo quando `!hasMoreContacts`.

### 3. Sem mudanças adicionais
- Sem alterações em queries/RLS/edge functions
- Sem alterações no design system (usa tokens semânticos existentes: `text-primary`, `text-muted-foreground`)
- Filtros client-side (owner, stage, sla, mode, search) continuam funcionando sobre o conjunto já carregado

## Validação
1. Abrir `/chat`, confirmar que o seletor de período inicia em "Todos".
2. Verificar que apenas ~50 contatos são carregados inicialmente (Network tab: uma única chamada com `range: 0-49`).
3. Rolar a lista — observar nova chamada com `range: 50-99` automaticamente.
4. Confirmar que o link "Carregar mais conversas" aparece no rodapé enquanto há mais a carregar e some quando termina (mostra "Fim da lista").

## Arquivos alterados
- `src/contexts/WhatsAppDataContext.tsx` (1 linha)
- `src/components/chat/ChatList.tsx` (+ ~10 linhas)
