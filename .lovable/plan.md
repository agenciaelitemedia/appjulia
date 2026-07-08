# Corrigir filtro Julia ativa/inativa (CRM da Julia)

## Causa raiz

Em `src/pages/crm/CRMPage.tsx`, o filtro por status Julia (`juliaStatusFilter`) usa `queryClient.getQueryData(['agent-session-status', codAgent, whatsapp])` para decidir se cada card é "Julia ativa" ou "Atendimento humano".

Esse cache é populado **de forma preguiçosa por cada card individual** (via `useAgentSessionStatus` dentro do componente do card, um por um, conforme renderizam). No primeiro clique quase nenhum card tem status cacheado ainda, então a regra de fallback "se não está no cache, mantém visível" faz **os dois filtros mostrarem cards demais**. A cada re-render mais status chegam ao cache e as contagens vão convergindo — daí precisar clicar 4-5 vezes.

Além disso a lógica atual não trata pares com dois formatos de telefone (12 vs 13 dígitos), o que também pode causar divergência.

## Solução

Trocar o filtro por dados vindos de uma consulta em **lote** que já existe: `useAgentSessionStatusesBatch`. Ela busca o status de todos os pares `(whatsapp, cod_agent)` de uma vez, com normalização de variantes de telefone.

### Passos

1. **`src/pages/crm/CRMPage.tsx`**
   - Importar `useAgentSessionStatusesBatch` de `@/hooks/useAgentSessionStatusesBatch`.
   - Montar `pairs` a partir de `cards` (whatsapp_number + cod_agent, deduplicados).
   - Chamar o hook e obter `statusMap` (`Map<"digits:codAgent", boolean>`).
   - No `filteredCards`, substituir o lookup por `queryClient.getQueryData(...)` por uma consulta ao `statusMap`. Se o batch ainda está carregando (`isLoading`), manter o comportamento atual (não filtrar) para não "piscar" contagem; assim que resolver, o filtro fica correto de primeira.
   - Remover o uso de `queryClient` só para esse propósito (mantém para o refresh).

2. **Não mexer** no componente do card nem em `useAgentSessionStatus` — continua funcionando para o indicador visual em tempo real por card. O batch fica dedicado ao filtro/contagem.

### Detalhe técnico da chave do map

O batch indexa por `${digits}:${codAgent}` já expandido nas variantes BR. No filtro basta:

```ts
const digits = String(card.whatsapp_number || '').replace(/\D/g, '');
const key = `${digits}:${card.cod_agent}`;
const isActive = statusMap?.get(key) ?? false;
```

Cards sem par válido (sem whatsapp ou sem cod_agent) tratamos como `inactive`.

## Resultado esperado

Ao entrar na página, assim que o batch resolve (uma única query), clicar em "Julia" e "Atendimento humano" mostra as contagens corretas já **no primeiro clique**, e a soma bate com o total.
