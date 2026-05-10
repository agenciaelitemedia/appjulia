## Problema

O filtro de modo (Todos/Julia/Humano/Sem definição) na lista de chats hoje é puramente client-side: ele só consegue avaliar o subconjunto de conversas/contatos já trazidos do banco pela paginação infinita (`useWhatsAppData`) e pela busca server-side em `ChatList.tsx`. Como a base tem muito mais registros do que está carregado, ao escolher "Julia IA" ou "Humano" o usuário enxerga um número arbitrário de itens — o que está na memória — em vez do total real daquele modo.

A classificação é feita em `getContactMode` / `getConversationMode` cruzando dois lados que **não vêm na query da lista**:

- vínculo `queue → cod_agent` (Supabase, hook `useQueueAgentLinks`);
- flag `agent_sessions.active` por `(whatsapp_number, cod_agent)` (banco externo, hook `useAgentSessionStatusesBatch`).

Por isso não dá pra simplesmente mover a regra para um `WHERE` em `chat_contacts/chat_conversations`. A solução proposta resolve isso projetando o filtro de modo em uma **lista de telefones** que é então aplicada como `IN (...)` nas queries paginadas existentes.

## Estratégia

Quando `modeFilter` for `julia` ou `human`, **mudar a fonte da paginação**: primeiro descobrir o universo completo de telefones que casa com aquele modo (consulta única ao banco externo, sem paginação), depois usar esse conjunto como filtro nas queries de contatos/conversas que já existem. Os totalizadores (badges e rodapé) passam a refletir o universo real, e a paginação carrega apenas itens daquele modo.

Para `all` e `unknown` o comportamento atual continua (sem pré-filtro server-side).

### Passo a passo

1. **Determinar os `cod_agent` do cliente logado.**  
   Reaproveitar `useMyAgents` (`agentsData.myAgents` + `monitoredAgents`) — já em uso em `ChatList.tsx`. Resultado: `clientCodAgents: string[]`.

2. **Novo hook `useModeFilterPhones(modeFilter, clientCodAgents)`.**  
   - `modeFilter === 'julia'`: `SELECT whatsapp_number FROM agent_sessions WHERE cod_agent IN (...) AND active = true`.  
   - `modeFilter === 'human'`: idem com `active = false`.  
   - Retorna `{ phones: string[], expandedPhones: string[], isLoading, exceededLimit }`.  
   - `expandedPhones` aplica `getBrPhoneVariants` em cada telefone (para casar com a forma como `chat_contacts.phone` é gravado), igual ao tratamento já feito em `useAgentSessionStatusesBatch`.  
   - Cap defensivo: se o universo passar de ~5.000 telefones, expor `exceededLimit=true` e o componente usa fallback client-side com aviso. Na prática a base de sessões por cliente fica bem abaixo disso.  
   - `staleTime: 30s`, mesma janela do batch de sessões.

3. **Propagar o filtro de telefones para as queries paginadas.**  
   Em `WhatsAppDataContext.tsx`:
   - Adicionar parâmetro opcional `phoneFilter?: string[] | null` ao contexto (setter exposto no provider).  
   - Nas queries de contatos paginadas (linha ~463, `from('chat_contacts')`) e nas equivalentes de conversas que filtram por contato, aplicar `.in('phone', phoneFilter)` quando o filtro estiver presente.  
   - Resetar a paginação (`offset=0`) sempre que `phoneFilter` mudar — mesmo padrão já usado em `useEffect` que zera `searchPages` quando o termo de busca muda.  
   - O `count` retornado por essa mesma query passa a ser o total real do modo selecionado.

4. **Aplicar também na busca server-side de `ChatList.tsx`.**  
   No `useQuery(['chat-list-search', ...])` (linha 174), quando `phoneFilter` estiver setado, adicionar `.in('phone', phoneFilter)` no `from('chat_contacts')`. A paginação por aba já existente continua igual; só o universo varrido é restringido.

5. **Wire up no `ChatList.tsx`.**  
   - Chamar `useModeFilterPhones(modeFilter, clientCodAgents)`.  
   - Passar o resultado para o contexto via setter (ou via prop nas queries).  
   - Manter `getContactMode`/`getConversationMode` como estão para colorir o badge individual e tratar `unknown`.  
   - Remover (ou condicionar a `unknown`) as filtragens client-side em `filteredContacts`, no laço de `conversations` etc., quando o filtro server-side estiver ativo — caso contrário a lista é filtrada duas vezes e zera enquanto a query ainda não voltou.

6. **Modo `unknown`.**  
   Não cabe em uma única consulta server-side eficiente (é o complemento de Julia ∪ Humano em todo o `chat_contacts`). Mantemos o comportamento client-side atual para esse caso (limitado ao que já foi paginado), e exibimos um pequeno hint no rodapé indicando que o total mostrado é parcial. Aceitável porque "Sem definição" é mais inspecional do que operacional.

7. **Estados de carregamento.**  
   - Enquanto `useModeFilterPhones` está fetchando, exibir o mesmo skeleton já usado pela busca (`isSearchFetching`).  
   - Se `phones.length === 0`, lista vazia imediata com mensagem "Nenhuma conversa neste modo".

## Detalhes técnicos

- **Fonte da verdade do `active`**: `agent_sessions` (banco externo via `externalDb`). Reusar `externalDb.getSessionStatusesBatch` ou criar `externalDb.getSessionPhonesByActive(codAgents, active)` — preferível o segundo porque evita trazer pares e devolve direto o array de telefones distintos.
- **Variantes de telefone**: usar `getBrPhoneVariants` (`src/lib/phoneVariants.ts`), que já é o padrão do projeto para resolver as 4 formas (com/sem 55, com/sem 9º dígito).
- **Cast bigint**: `cod_agent` continua sendo `bigint` no banco externo; passar como string no `IN`, igual ao padrão existente.
- **Cache**: `react-query` por `[modeFilter, clientCodAgents.join(',')]`; invalidar quando o batch de sessões já existente também invalida (mesma janela de 30 s).
- **Tabs (activeTab/conversationStatusFilter) e aba ativa**: a paginação per-tab introduzida na iteração anterior continua funcionando; o filtro de modo é ortogonal e simplesmente reduz o universo de cada aba.

## Fora de escopo

- Mover a query da lista para uma view materializada com `cod_agent`/`active` denormalizados.
- Resolver `unknown` server-side.
- Backfill de `agent_sessions` históricas com `cod_agent` divergente (já listado no plano anterior).

## Pergunta antes de implementar

Comportamento ao trocar para Julia/Humano e haver muitos telefones (acima do cap de 5.000):

- (a) **Fallback automático para client-side** com um aviso discreto "exibindo apenas amostra carregada". (recomendado)
- (b) **Bloquear o filtro** com mensagem "muitos registros — refine por fila/etapa".
- (c) **Sem cap**: mandar `IN` gigante mesmo (risco de query lenta / URL grande no PostgREST).
