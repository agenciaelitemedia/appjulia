

## Reorganização dos filtros da lista do chat

Reestruturar o cabeçalho do `ChatList` movendo o filtro de status atual e criando dois novos filtros em estilo SLA logo abaixo da linha de filtros SLA.

### Mudanças visuais

**Linha do topo (atual com "Todas / Novos / Meus / Outros" + ícones à direita):**
- Remover por completo os botões de texto "Todas / Novos / Meus / Outros".
- Manter apenas os ícones (Métricas, Automações, Canais, SLA) **alinhados à direita**.

**Nova seção de filtros (abaixo da linha SLA, acima do seletor de Fila):**

Linha 1 — **Responsável** (novo filtro):
- `Todos` / `Meus` / `Sem responsáveis`
- Mesmo visual dos pills SLA: `rounded-md`, `text-[10px] font-medium px-2 py-1 h-auto`, borda `border-border`, fundo translúcido quando ativo.
- Cores ativas:
  - Todos → neutro (`bg-foreground/10 text-foreground border-foreground/20`)
  - Meus → azul (`bg-blue-500/15 text-blue-600 border-blue-500/30`)
  - Sem responsáveis → âmbar (`bg-amber-500/20 text-amber-600 border-amber-500/30`)

Linha 2 — **Status da conversa** (substitui o filtro de status atual, agora em pills):
- `Abertos` / `Concluídos` / `Encerrados`
- Mesmo visual dos pills SLA.
- Mapeamento para `conversationStatusFilter` existente:
  - Abertos → `'open'` (inclui pending+open via lógica atual já consolidada como "ativos")
  - Concluídos → `'resolved'`
  - Encerrados → novo valor `'closed'` (já suportado pelo tipo `ConversationFilterStatus`? — se não, adicionar; caso já seja `'all'`, ajustar para usar status `closed` da tabela `conversations`)
- Manter os contadores numéricos em badge colorida ao lado do label (vermelho/azul/cinza), no mesmo padrão visual dos pills SLA.

### Ordem final do cabeçalho do ChatList

```text
[ ícones à direita: Métricas | Automações | Canais | SLA ]
[ busca + filtros (Filter, Sort, Plus) ]
[ filtros IA: Todas | IA ativa | IA inativa | Atendente ]
[ filtros SLA: Todos SLAs | Estourado | Em risco ]   ← já existente
[ filtros Responsável: Todos | Meus | Sem responsáveis ]   ← NOVO
[ filtros Status: Abertos | Concluídos | Encerrados ]      ← NOVO (substitui topo)
[ seletor de Fila ]
[ toggle Individual / Grupos ]
```

### Detalhes técnicos

- Arquivo único: `src/components/chat/ChatList.tsx`.
- Remover o bloco `statusPills.map(...)` e os botões "Todas/Novos/Meus/Outros" do topo.
- Adicionar novo estado local `assigneeFilter: 'all' | 'mine' | 'unassigned'`.
- Aplicar `assigneeFilter` em `visibleContacts` cruzando com `convMetaByContact.get(contact.id)?.assignedTo`:
  - `mine` → `assignedTo === user?.id` (ou `user?.name`, conforme padrão atual de `assigned_to`)
  - `unassigned` → `!assignedTo`
- Mapear o filtro de Status para `conversationStatusFilter` existente do `WhatsAppDataContext`. Verificar se `'closed'` já existe no tipo `ConversationFilterStatus`; se não, estender o tipo e ajustar o filtro de `conversations` no contexto para reconhecer `closed`.
- Contadores: derivar de `conversations.filter(c => c.status === 'open' | 'resolved' | 'closed').length`, mantendo `pendingCount` agregado dentro de "Abertos".
- Sem mudanças de schema.

### Arquivos alterados

- `src/components/chat/ChatList.tsx` — remoção dos pills do topo, novos pills de Responsável e Status.
- (Se necessário) `src/contexts/WhatsAppDataContext.tsx` + `src/types/conversation.ts` — adicionar suporte ao status `'closed'` no `conversationStatusFilter`.

