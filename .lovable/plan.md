## Mudanças

### 1. Link no topo do painel de detalhes do chamado (no chat)
Arquivo: `src/components/chat/ChatTicketDetailSidePanel.tsx`

Hoje o botão `ExternalLink` no header (linha ~300) abre `/tickets/{id}` em uma nova aba. Mudar para:
- Navegar in-app via `useNavigate()` para `/tickets/{ticket.id}` (a rota já é a página de detalhe do ticket, `TicketDetailPage`), no mesmo tab.
- Fechar o painel lateral ao navegar (`onClose()`).
- Manter o ícone e tooltip.

### 2. Última visualização persistente em `/tickets` (Lista x Kanban)
Arquivo: `src/pages/tickets/TicketsPage.tsx`

- Introduzir uma chave em `localStorage` (`tickets:lastView`) com valores `list | kanban | dashboard | settings`.
- Substituir `<Tabs defaultValue="list">` por um `Tabs` controlado (`value` + `onValueChange`) cujo estado inicial lê o `localStorage`. Fallback para `"list"` quando não houver valor ou quando a aba salva não estiver disponível para o papel atual (ex.: `kanban`/`settings` só existem para `agent`).
- Cada mudança de aba grava no `localStorage`.

### 3. Voltar do detalhe do ticket respeita a última visualização
Arquivo: `src/pages/tickets/TicketDetailPage.tsx`

- As duas chamadas `navigate('/tickets')` (linhas 211 e 222 — botão "voltar" e pós-exclusão) continuam apontando para `/tickets`. Como `TicketsPage` agora restaura a aba a partir do `localStorage`, o usuário volta automaticamente para "Lista" ou "Kanban" conforme a última visualização escolhida.
- Nenhuma mudança adicional necessária na rota.

## Detalhes técnicos

- Chave de storage: `tickets:lastView`.
- Valores válidos: `'list' | 'kanban' | 'dashboard' | 'settings'`.
- Sanitização ao ler: se o valor salvo for `kanban` ou `settings` mas `role !== 'agent'`, cai em `'list'`.
- Sem mudanças de backend, schema, ou contratos de componentes filhos.
- Sem alteração de comportamento para o papel `requester` (continua só com lista).
