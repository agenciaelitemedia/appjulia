

## Plano

### 1. Atendimento Humano — listagem completa + novos filtros

**Mudança na hook `useInactiveLeads.ts`:**
- Aceitar `agentCodes: string[]` (multi) em vez de `selectedAgentCode?: string`.
- Mudar `selectedPeriod` default de `'last7days'` para um novo valor `'all'` (sem filtro de período).
- Adicionar filtro `stageIds: number[]` (multi-select de etapas do funil).
- Quando `selectedPeriod === 'all'`, pular o filtro de data.
- Quando `stageIds.length > 0`, filtrar leads por `lead.stage_id`.

**Mudança em `HumanSupportPage.tsx`:**
- Trocar `useState<string | null>` por `useState<string[]>` para múltiplos agentes.
- Carregar todos os agentes do usuário por padrão (igual CRM Júlia).
- Substituir `<AgentSearchSelect>` pelo mesmo padrão multi-select com Popover + Checkbox usado em `CRMFilters.tsx` (extrair como pequeno componente reutilizável `AgentMultiSelectPopover` em `src/components/agents/`).
- Buscar etapas do funil via `useCRMStages()` (já existe em `useCRMData.ts`) e passar para a lista.

**Mudança em `InactiveLeadsList.tsx`:**
- Adicionar prop `stages`, `stageIdsFilter`, `onStageIdsChange`.
- Adicionar `<Popover>` multi-select de etapas (mesmo estilo do agente, com Checkbox).
- Adicionar opção "Todos" (sem período) na lista `PERIOD_OPTIONS`, deixando-a como default.
- O agentSelect agora aceita o multi-select.

**Resultado:** ao abrir `/atendimento-humano`, lista vem sem nenhum filtro aplicado (todos agentes do usuário, todos os períodos, todas as etapas). Filtros opcionais via UI.

### 2. CRM Júlia — adicionar etapa "Jurídico" no final do funil

**Migration SQL no banco externo** (via edge function migration, já que `crm_atendimento_stages` está no DB externo, não Supabase):
- Inserir nova linha em `crm_atendimento_stages` com `name = 'Jurídico'`, `color` (ex.: `#6366F1` indigo), `position = MAX(position) + 1`, `is_active = true`.
- Como o DB externo não suporta migrations Supabase, usaremos uma chamada `externalDb.raw` única (script idempotente: `INSERT ... WHERE NOT EXISTS`) executada uma vez.

Alternativa mais segura: criar uma action `seed_juridico_stage` em `supabase/functions/db-query/index.ts` que faz o insert idempotente, e disparar uma única vez via botão admin OU via execução manual. **Vou propor: criar a action e chamá-la automaticamente uma vez ao montar o `CRMPage` (com flag em localStorage para não repetir).** Mais simples: executar diretamente via tool `code--exec` chamando a edge function `db-query` na primeira vez.

### Arquivos afetados

- `src/pages/atendimento-humano/hooks/useInactiveLeads.ts` — multi-agent, period 'all', stageIds.
- `src/pages/atendimento-humano/HumanSupportPage.tsx` — multi-agent, carregar stages.
- `src/pages/atendimento-humano/components/InactiveLeadsList.tsx` — multi-select de etapas + opção "Todos".
- `src/components/agents/AgentMultiSelectPopover.tsx` — novo componente reutilizável.
- `supabase/functions/db-query/index.ts` — nova action `seed_juridico_stage` (idempotente).
- Execução única para inserir "Jurídico" no funil.

### Validação
1. `/atendimento-humano` abre listando TODOS os leads inativos sem filtro temporal.
2. Multi-select de agentes funciona (pré-marca todos).
3. Multi-select de etapas filtra a lista corretamente.
4. CRM Júlia mostra coluna "Jurídico" no fim do pipeline.

