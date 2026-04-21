

## Atualizar filtros de status no /chat

### Mudanças

Remover o filtro "Todos" e definir **Pendentes** como o filtro padrão (selecionado ao abrir a tela). Renomear os demais labels.

| Antes | Depois |
|---|---|
| Todos | _(removido)_ |
| — | **Pendentes** (padrão) |
| Abertos | **Em atendimento** |
| Concluídos | **Resolvidas** |
| Encerrados | **Encerradas** |

### Arquivos a editar

1. **Componente da barra de filtros do chat** (provavelmente `src/pages/chat/components/ConversationList.tsx` ou similar):
   - Remover botão "Todos".
   - Adicionar botão "Pendentes" → `status: 'pending'`.
   - Renomear: `'open'` → "Em atendimento", `'resolved'` → "Resolvidas", `'closed'` → "Encerradas".

2. **Estado inicial do filtro** (onde `ConversationFilters` é inicializado, ex.: hook `useConversations` ou container do `/chat`):
   - Trocar `status: 'all'` por `status: 'pending'` como valor padrão.

Nenhuma mudança de tipo/banco — `pending | open | resolved | closed` já existem em `ConversationFilterStatus` (`src/types/conversation.ts`). É apenas ajuste de UI e default.

### Resultado

A barra de filtros do `/chat` passa a exibir: **Pendentes (padrão) · Em atendimento · Resolvidas · Encerradas**. Ao abrir o módulo, a lista já vem filtrada por Pendentes.

