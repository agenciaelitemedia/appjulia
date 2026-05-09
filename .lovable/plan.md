
# Reorganização do card da lista de conversas (/chat)

## Objetivo

Renderizar primeiro o **card base** (rápido, com dados já disponíveis) e enriquecer progressivamente com:
1. Linha **Julia** (cod_agent · nome do agente · etapa CRM Julia) — quando houver vínculo com agente IA
2. Linha **CRM Builder** (ícone CRM · Quadro · Etapa) — quando a conversa estiver vinculada a um card do CRM Builder

Hoje o componente já renderiza tudo num único bloco. Vamos separar visualmente e reordenar para que o cliente identifique cada vínculo de forma clara, sem quebrar nada.

## Layout final do card

```text
┌──────────────────────────────────────────────────────────┐
│ [avatar]  🟢 Nome do contato            há 14 horas      │
│           Preview da última mensagem            [3]      │
│                                                          │
│  [Fila][Atribuído][SLA][CRM?]                  🚩 Prio   │
│  ─────────────────────────────────────────────────────   │  ← separador sutil
│  🤖 #2026040 · MKT São Paulo               [Entrada]     │  ← só se vínculo Julia
│  ─────────────────────────────────────────────────────   │
│  ▦ Comercial · Qualificação                              │  ← só se vínculo CRM Builder
└──────────────────────────────────────────────────────────┘
```

- Pílula `CRM` na linha de badges **continua existindo** (indicador rápido de vínculo).
- As novas linhas só aparecem quando os dados existem; card base permanece compacto.

## Mudanças

### 1. `src/hooks/useCRMBuilderLinkedConversations.ts`
Hoje retorna `Set<conversation_id>`. Vamos enriquecer para retornar também o quadro/etapa:

- Trocar `select('custom_fields')` por `select('custom_fields, board_id, pipeline_id, crm_boards(name,color), crm_pipelines(name,color)')` (uma única query, mesmo custo de rede).
- Retornar `Map<conversation_id, { boardName, boardColor, pipelineName, pipelineColor }>`.
- Manter `staleTime: 60_000` (já existe). Sem polling.
- Compatibilidade: criar helper `hasCrmCard = map.has(id)` para preservar a prop booleana atual.

### 2. `src/components/chat/ChatContactItem.tsx`
- Adicionar prop opcional `crmBuilderLink?: { boardName, boardColor, pipelineName, pipelineColor }`.
- **Reordenar JSX** sem alterar lógica de SLA/JuliaStatus/PriorityBadge:
  - Bloco A (sempre): avatar + nome + tempo + preview + unread + linha de badges (fila/atribuído/SLA/CRM/prioridade).
  - Bloco B (condicional, com `border-t border-border/40 pt-1 mt-1`): linha Julia atual (`#codAgent · alias` + badge da etapa Julia à direita), prefixada por ícone `Bot` discreto.
  - Bloco C (condicional, com `border-t border-border/40 pt-1 mt-1`): linha CRM Builder — ícone `Kanban` + texto truncado `{boardName} · {pipelineName}` com cor de fundo derivada do `boardColor` (chip suave).
- Manter `React.memo`. Tudo lazy: blocos B/C só renderizam se props chegarem.

### 3. `src/components/chat/ChatList.tsx`
- Renomear destructuring: `const { data: crmBuilderMap } = useCRMBuilderLinkedConversations();`
- No render do `ChatContactItem` (linha ~1242):
  - `hasCrmCard={conv?.id ? crmBuilderMap?.has(conv.id) : false}` (mantém pílula).
  - `crmBuilderLink={conv?.id ? crmBuilderMap?.get(conv.id) : undefined}` (nova linha).

## Performance / UX

- **Sem novas queries**: a chamada do hook já existe; só adicionamos colunas no `select`.
- **Renderização progressiva natural**: React Query devolve `undefined` enquanto carrega, então o card base já aparece e a linha CRM "desce" assim que o map resolver. Mesma estratégia que a linha Julia (`stageByPhone`, `aliasMap`, `sessionActiveMap`).
- **Virtualização preservada** (`useVirtualizer` continua medindo via `measureElement`, então a altura variável dos cards é absorvida sem flicker).
- **Sem mudanças em `WhatsAppDataContext`**, hooks de SLA, presença ou na ordenação.

## Riscos / não-mexer

- Não alterar `JuliaStatusBadge`, `SlaBadge`, `PriorityBadge`, lógica de envelopes ou seleção.
- Não alterar tipos de `ChatContact` / `ChatConversation`.
- Manter pílula `CRM` na linha de badges (alguns usuários já a usam como atalho visual).
- Confirmar nomes das tabelas `crm_boards` / `crm_pipelines` na query (são as usadas em `useCRMDealHistory.ts`).
