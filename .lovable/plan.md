## Problema

As abas **"Em Abertos"** e **"Em Atendimento"** mostram contadores que **zeram** quando a aba oposta está ativa.

**Causa**: o `WhatsAppDataContext` aplica `conversationStatusFilter` dentro de `filteredContacts` (linhas 1459–1463). Quando o usuário clica em "Em Atendimento", `filteredContacts` passa a conter apenas conversas `open`, então o `pendingConvCount` calculado em `ChatList.tsx` sobre `visibleContacts` (que deriva de `filteredContacts`) sempre dá 0 — e vice-versa.

## Comportamento desejado

Os contadores das abas devem:
- **Sempre** refletir os filtros ativos (busca, período, SLA, dono, modo IA, etapa, fila, Individual/Grupos).
- **Nunca** depender de qual aba (`pending`/`open`) está selecionada — ambos badges sempre exibem seu valor real.

## Solução

Calcular os contadores a partir de uma **base que ignora `conversationStatusFilter`**, mas aplica todos os outros filtros.

### Mudanças em `src/components/chat/ChatList.tsx`

1. **Importar `contacts`** do contexto (já está importado) e criar um `baseContactsForCounts` paralelo a `visibleContacts`, partindo de `contacts` (não de `filteredContacts`) e aplicando manualmente:
   - filtro Individual/Grupos (via `matchesActiveTab`)
   - filtro de busca (`deferredSearch` em nome/telefone)
   - filtro snoozed (replicar a lógica do contexto: esconder snoozed quando nenhum filtro de status é aplicado a contagem)
   - filtros existentes em `visibleContacts`: `ownerFilter`, `periodFilter`, `stageIds`, `slaFilter`, `modeFilter`
   - filtro de fila (já vem de `filteredContacts` via contexto através de `selectedQueue`; precisaremos garantir que `contacts` também respeite a fila — verificar; se sim manter, se não, replicar)

2. **Refatorar o `useMemo` dos contadores** para iterar sobre `baseContactsForCounts` em vez de `visibleContacts`, contando `pending` e `open` num único loop via `statusByContact`.

3. **Manter `visibleContacts` intacto** para a renderização da lista (continua respeitando `conversationStatusFilter` via contexto).

### Estratégia de implementação simplificada

Para evitar duplicar toda a lógica de filtros, extrair uma função `applyClientFilters(list)` que recebe uma lista de contatos e aplica: owner, period, stage, sla, mode, tab (Individual/Grupos), busca. Essa função é usada duas vezes:

```ts
const applyClientFilters = React.useCallback((list: ChatContact[]) => {
  // owner, period, stage, sla, mode, tab, search filters...
}, [/* deps */]);

// Lista renderizada (com status filter aplicado via filteredContacts do contexto)
const visibleContacts = React.useMemo(
  () => applyClientFilters(filteredContacts),
  [filteredContacts, applyClientFilters]
);

// Base para contadores (sem status filter)
const baseForCounts = React.useMemo(() => {
  // partir de `contacts` filtrando snoozed + Individual/Grupos + fila
  const base = contacts.filter(/* tab + snoozed + queue */);
  return applyClientFilters(base);
}, [contacts, conversations, applyClientFilters, selectedQueue]);

const { pendingConvCount, openConvCount } = React.useMemo(() => {
  let pending = 0, open = 0;
  for (const c of baseForCounts) {
    const s = statusByContact.get(c.id);
    if (s === 'pending') pending++;
    else if (s === 'open') open++;
  }
  return { pendingConvCount: pending, openConvCount: open };
}, [baseForCounts, statusByContact]);
```

### Resultado

- Trocar entre as abas "Em Abertos" / "Em Atendimento" não zera mais o contador da aba oposta.
- Aplicar/remover qualquer filtro (busca, período, SLA, dono, etapa, modo IA) atualiza ambos contadores simultaneamente.
- A lista renderizada continua estritamente filtrada pela aba ativa.

### Arquivos editados
- `src/components/chat/ChatList.tsx`
