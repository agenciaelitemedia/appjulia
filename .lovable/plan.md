

# Filtro Julia Ativa/Inativa no CRM

## Problema

Não há como filtrar os cards do pipeline por status da Julia (ativa/inativa). O status é verificado individualmente por card via API em tempo real (hook `useAgentSessionStatus`), então o filtro precisa ser client-side usando o cache do React Query.

## Solução de Usabilidade

Adicionar um **ToggleGroup** compacto com 3 opções (ícone Bot + texto) diretamente no header do CRM, ao lado dos botões "Atualizar":

```text
[🤖 Todas] [🟢 Ativa] [🔴 Inativa]
```

- **Todas** (padrão): mostra todos os cards normalmente
- **Ativa**: mostra apenas cards onde a Julia está ativa (bolinha verde)  
- **Inativa**: mostra apenas cards onde Julia está inativa (bolinha vermelha)

Esse formato é melhor que um Select/Dropdown porque:
- É visível sem clique extra
- Feedback visual imediato com cores
- Padrão familiar de toggle filter

## Implementação Técnica

### 1. Estado no CRMPage.tsx

Adicionar estado `juliaStatusFilter: 'all' | 'active' | 'inactive'` no componente principal.

### 2. Hook utilitário para leitura do cache

Criar função `useJuliaStatusFilter` que recebe a lista de cards e o filtro, e para cada card lê o cache do React Query (`queryClient.getQueryData(['agent-session-status', codAgent, whatsapp])`) para determinar se está ativa/inativa. Cards cujo status ainda não foi carregado no cache são mantidos visíveis (não filtrados).

### 3. ToggleGroup no header

Renderizar o ToggleGroup entre os filtros e o pipeline, usando `ToggleGroup` do shadcn/ui com ícones coloridos.

### 4. Filtro aplicado no `filteredCards`

Encadear o filtro de Julia status após o filtro de busca existente no `useMemo`.

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/crm/CRMPage.tsx` | Adicionar estado `juliaStatusFilter`, ToggleGroup no header, filtro no `filteredCards` usando cache do React Query |

Nenhum arquivo novo necessário — toda a lógica fica no CRMPage.tsx usando o cache já existente de `useAgentSessionStatus`.

