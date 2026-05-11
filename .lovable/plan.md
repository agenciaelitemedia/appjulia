## Objetivo
Fazer a lista do chat mostrar a etapa correta da Júlia já no primeiro carregamento visual, sem depender do clique no lead e sem causar reordenação/"pulo" perceptível da lista.

## O que vou alterar
1. **Unificar a base de contatos usada para carregar etapas**
   - Ajustar `ChatList.tsx` para montar o batch de `useCRMStageByPhone` com a mesma base usada para renderizar a lista final, incluindo os contatos vindos de `useChatContactsByIds`.
   - Isso elimina o buraco atual em que um lead aparece na lista, mas não entra no carregamento de etapa por ainda não existir em `contacts/filteredContacts`.

2. **Separar estado “ainda carregando etapa” de “sem etapa”**
   - Enquanto o mapa de etapas da Júlia ainda estiver carregando para aquele item, evitar mostrar imediatamente o texto final "Sem etapa".
   - A linha da Júlia vai manter comportamento estável na primeira pintura, evitando o falso negativo visual.

3. **Preservar lookup correto por telefone + agente com fallback seguro**
   - Manter a busca prioritária por chave composta (`telefone|codAgent`) e fallback por telefone quando necessário.
   - Aplicar isso sem depender do clique no contato para que a etapa já venha resolvida na lista virtualizada.

4. **Validar o ponto do “pulo” da lista**
   - Revisar o item virtualizado para garantir que a atualização da etapa não provoque mudança desnecessária de altura/re-medida ao selecionar o lead.
   - Se preciso, estabilizar a renderização da faixa Júlia para reduzir reflow visual.

## Arquivos alvo
- `src/components/chat/ChatList.tsx`
- `src/components/chat/ChatContactItem.tsx`
- possivelmente `src/hooks/useCRMStageByPhone.ts` se eu precisar ajustar o estado de carregamento por item

## Resultado esperado
- Leads da Júlia já aparecem com a etapa correta ao entrar na lista.
- Clicar no lead não será mais o gatilho para a etapa “corrigir”.
- A lista não deve mais “andar” ou reorganizar visualmente por causa desse carregamento.

## Detalhes técnicos
- Hoje o problema nasce porque `displayContacts/finalVisibleContacts` pode incluir contatos de `missingContactIds -> useChatContactsByIds`, mas `allPhoneAgentPairs` é derivado apenas de `filteredContacts`.
- Ao clicar, `selectContact()` hidrata esse contato dentro de `contacts`, e só então ele passa a participar do batch de etapa.
- A correção será alinhar a fonte de dados do batch de etapas com a fonte real da renderização da lista, removendo a divergência entre “contato visível” e “contato elegível para lookup de etapa”.

```text
Hoje:
lista visível = filteredContacts + fetchedMissing
batch etapa = filteredContacts

Depois:
lista visível = base única
batch etapa = mesma base única
```
