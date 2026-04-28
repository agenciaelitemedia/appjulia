## Mudanças no `/chat`

### 1. Renomear aba "Aguardando Atendimento" → "Em Abertos"

Arquivo: `src/components/chat/ChatList.tsx` (linha 692)

```tsx
{ value: 'pending', label: 'Em Abertos', count: pendingConvCount },
{ value: 'open',    label: 'Em Atendimento', count: openConvCount },
```

### 2. Corrigir contadores das abas para refletir os filtros

**Problema atual:** `pendingConvCount` e `openConvCount` vêm de `WhatsAppDataContext.loadConvCounts()`, que faz uma query direta no banco filtrando apenas por `client_id` e `queue_id`. Eles **ignoram** todos os filtros aplicados no `ChatList` (período, responsável, etapa CRM, SLA, modo IA/Humano, Individual/Grupos, busca).

**Solução:** Calcular as contagens localmente em `ChatList.tsx` a partir do mesmo `visibleContacts` (que já reflete todos os filtros) cruzando com `conversations` para identificar o `status` (`pending`/`open`) de cada contato visível.

Implementação em `src/components/chat/ChatList.tsx`:

- Construir um `Map<contact_id, status>` a partir de `conversations` (priorizando a conversa mais recente por contato — mesma lógica já usada em `convMetaByContact`).
- Aplicar também o filtro de aba Individual/Grupos (`matchesActiveTab`) e o filtro de busca (`searchQuery`) sobre `visibleContacts`, gerando `tabFilteredContacts`.
- Derivar:
  ```ts
  const pendingConvCount = tabFilteredContacts.filter(c => statusByContact.get(c.id) === 'pending').length;
  const openConvCount    = tabFilteredContacts.filter(c => statusByContact.get(c.id) === 'open').length;
  ```
- Remover o consumo de `pendingConvCount` / `openConvCount` vindos do `useWhatsAppData()` (passam a ser locais e dinâmicos).

**Importante:** Como `loadConversations` no contexto só carrega conversas do grupo atual (`active` quando o filtro é `pending`/`open`), os contadores derivados localmente já contemplam ambos os status quando a aba ativa é uma das duas (a query usa `.in('status', ['pending', 'open'])`). Isso preserva o comportamento sem precisar de fetch adicional.

### Resumo de arquivos editados

- `src/components/chat/ChatList.tsx` — renomear label e calcular contadores localmente em cima de `visibleContacts` + `conversations`.
