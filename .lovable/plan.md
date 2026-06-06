## Causa

Em `/chat`, a aba "Individuais" decide se um contato é grupo com base no mapa `isGroupByContactId` (`src/components/chat/ChatList.tsx`, linhas 619–623), que é construído **apenas** a partir de `contacts` (paginação local de `WhatsAppDataContext`).

Quando uma conversa pertence a um contato que ainda **não foi carregado** pela paginação local (caso comum: o cliente 30 tem 91 grupos e ~1.000 contatos, e os grupos costumam ficar fora das primeiras páginas), o lookup retorna `undefined`. No filtro:

```ts
if (activeTab === 'individual') return !isGroup;  // !undefined === true
```

Logo o contato é tratado como individual, entra em `missingContactIds`, é hidratado por `useChatContactsByIds` (linha 924) e aparece na lista — mesmo sendo um grupo (`is_group=true` no banco).

A mesma falha ocorre na linha 627 quando `showGroupsTab=false` (cliente sem permissão de grupos): grupos não loadados ainda passam pelo filtro e aparecem misturados.

## Correção

Em `src/components/chat/ChatList.tsx`:

1. Construir `isGroupByContactId` a partir da **união** de `contacts` + `hydratedConvContacts` (já disponível na linha 369) + `fetchedMissing` (linha 924), assim todo `contact_id` referenciado por uma conversa tem seu `is_group` real conhecido antes do filtro decidir.

2. Ajustar `matchesActiveTab` para tratar `undefined` (contato ainda não hidratado) de forma conservadora:
   - Se `activeTab === 'individual'` ou `showGroupsTab === false`: **excluir** contatos com `is_group` desconhecido até que a hidratação chegue (evita o flash de grupo na aba errada).
   - Se `activeTab === 'groups'`: manter a regra atual (`is_group === true`).

3. Aplicar o mesmo critério no bloco `visibleContacts` (linhas 816–913), que já chama `matchesActiveTab` — nenhuma mudança extra ali, basta o mapa estar completo.

## Detalhes técnicos

- Dependências do `useMemo` de `isGroupByContactId` passam a incluir `hydratedConvContacts` e `fetchedMissing`.
- Como `fetchedMissing` é derivado de `missingContactIds` (que por sua vez depende de `visibleContacts`), há um ciclo de hidratação esperado: 1º render esconde grupos desconhecidos da aba individual, 2º render (após hidratação) confirma e mantém só individuais. Sem loops infinitos porque o mapa só cresce.
- Nenhuma mudança no backend, no schema, nem na sincronização UaZapi — `is_group` continua sendo a fonte de verdade.
- Nenhuma alteração visual além da lista deixar de exibir grupos na aba "Individuais".

## Verificação

- Abrir `/chat` no cliente 30 (que tem 91 grupos), aba "Individuais": nenhum contato com `is_group=true` deve aparecer; aba "Grupos": todos os 91 devem aparecer normalmente.
- Cliente sem `allowGroups`: lista mostra somente individuais mesmo durante a paginação inicial.
