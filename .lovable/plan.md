

# Analise: O Que Falta Implementar no CRM Builder

## Status Atual (Fase 1 Completa)

O CRM Builder tem as funcionalidades fundamentais implementadas e funcionando:

```text
IMPLEMENTADO                              ARQUIVOS CRIADOS
----------------------------------------------------------------------------------------
Tabelas no Supabase                       crm_boards, crm_pipelines, crm_deals, crm_deal_history
Tipos TypeScript                          src/pages/crm-builder/types.ts
Hook de Boards                            hooks/useCRMBoards.ts (CRUD + Realtime)
Hook de Pipelines                         hooks/useCRMPipelines.ts (CRUD + Realtime + Reorder)
Hook de Deals                             hooks/useCRMDeals.ts (CRUD + DnD + Historico + Realtime)
Grid de Boards                            components/boards/BoardGrid.tsx
Card de Board                             components/boards/BoardCard.tsx
Dialog Criar Board                        components/boards/CreateBoardDialog.tsx
Coluna de Pipeline                        components/pipeline/PipelineColumn.tsx (com DnD)
Dialog Criar Pipeline                     components/pipeline/CreatePipelineDialog.tsx
Card de Deal                              components/deals/DealCard.tsx (com DnD + prioridade + tempo)
Dialog Criar/Editar Deal                  components/deals/CreateDealDialog.tsx
Pagina Lista de Boards                    CRMBuilderPage.tsx
Pagina Kanban do Board                    BoardPage.tsx (DnD completo com dnd-kit)
Rotas                                     /crm-builder e /crm-builder/:boardId
Icone no iconMap                          Kanban adicionado
```

---

## O Que Ainda Falta Implementar

### Fase 2: Campos Customizaveis (Prioridade Alta)

| Componente | Descricao | Estimativa |
|------------|-----------|------------|
| `crm_custom_fields` | Tabela no Supabase para campos dinamicos | 15min |
| `useCRMCustomFields.ts` | Hook para CRUD de campos customizaveis | 45min |
| `CustomFieldsManager.tsx` | Tela para gerenciar campos do board | 1h |
| `DynamicFieldRenderer.tsx` | Renderiza campo por tipo (text, date, select, etc.) | 45min |
| `FieldTypeSelector.tsx` | Seletor de tipo ao criar campo | 30min |
| Integracao no CreateDealDialog | Exibir campos customizaveis ao criar/editar deal | 45min |

**Subtotal: ~4h**

---

### Fase 3: Detalhes do Deal + Timeline (Prioridade Alta)

| Componente | Descricao | Estimativa |
|------------|-----------|------------|
| `DealDetailsSheet.tsx` | Sheet lateral com detalhes completos do deal | 1.5h |
| `DealActivityTimeline.tsx` | Timeline de movimentacoes e alteracoes | 1h |
| `useCRMDealHistory.ts` | Hook para buscar historico do deal | 30min |
| Integracao DealCard onClick | Abrir sheet de detalhes ao clicar no card | 15min |

**Subtotal: ~3.5h**

---

### Fase 4: Filtros e Busca (Prioridade Media)

| Componente | Descricao | Estimativa |
|------------|-----------|------------|
| `crm_saved_filters` | Tabela no Supabase para filtros salvos | 15min |
| `useCRMFilters.ts` | Hook para filtrar deals | 45min |
| `BoardFilters.tsx` | Barra de filtros no topo do board | 1h |
| `FilterBuilder.tsx` | Construtor de filtros avancados | 1.5h |
| `SavedFiltersDropdown.tsx` | Dropdown com filtros salvos | 45min |
| Busca textual | Input de busca por titulo/contato/telefone | 30min |

**Subtotal: ~5h**

---

### Fase 5: Automacoes (Prioridade Media)

| Componente | Descricao | Estimativa |
|------------|-----------|------------|
| `crm_automations` | Tabela no Supabase | 15min |
| `useCRMAutomations.ts` | Hook para CRUD de automacoes | 45min |
| `AutomationsManager.tsx` | Listagem de automacoes do board | 1h |
| `CreateAutomationDialog.tsx` | Dialog para criar/editar automacao | 1.5h |
| `TriggerSelector.tsx` | Seletor de gatilho (deal_moved, field_changed, etc.) | 45min |
| `ActionConfigurator.tsx` | Configurador de acao (move, update, notify) | 1h |
| Edge Function `crm-automation-runner` | Executa automacoes baseadas em triggers | 2h |

**Subtotal: ~7h**

---

### Fase 6: Analytics e Dashboard (Prioridade Media)

| Componente | Descricao | Estimativa |
|------------|-----------|------------|
| `useCRMAnalytics.ts` | Hook para calcular metricas | 1h |
| `BoardAnalytics.tsx` | Pagina de analytics do board | 1.5h |
| `ConversionFunnel.tsx` | Grafico de funil com Recharts | 45min |
| `ValueByPipeline.tsx` | BarChart de valor por pipeline | 30min |
| `TimeInStageChart.tsx` | Tempo medio em cada etapa | 30min |
| Rota `/crm-builder/:boardId/analytics` | Nova rota para analytics | 15min |

**Subtotal: ~4.5h**

---

### Fase 7: Templates e Extras (Prioridade Baixa)

| Componente | Descricao | Estimativa |
|------------|-----------|------------|
| `crm_board_templates` | Tabela de templates | 15min |
| `BoardTemplateSelector.tsx` | Seletor de template ao criar board | 1h |
| Templates padrao | Vendas, Suporte, Recrutamento, Juridico | 30min |
| `BoardSettingsDialog.tsx` | Configuracoes avancadas do board | 1h |
| Import/Export CSV | Importar e exportar deals | 2h |

**Subtotal: ~5h**

---

### Melhorias de UX (Prioridade Baixa)

| Melhoria | Descricao | Estimativa |
|----------|-----------|------------|
| Virtualizacao de Cards | react-virtual para 1000+ deals | 1.5h |
| Atalhos de teclado | Cmd+K para busca, Esc para fechar | 45min |
| Touch DnD | Ajustar DnD para mobile/tablet | 1h |
| Indicador "Editando" | Mostrar quem esta editando em tempo real | 1h |
| Animacoes de transicao | Framer Motion para UX premium | 1h |

**Subtotal: ~5h**

---

## Resumo do Que Falta

| Fase | Descricao | Estimativa | Prioridade |
|------|-----------|------------|------------|
| 2 | Campos Customizaveis | 4h | Alta |
| 3 | Detalhes do Deal + Timeline | 3.5h | Alta |
| 4 | Filtros e Busca | 5h | Media |
| 5 | Automacoes | 7h | Media |
| 6 | Analytics | 4.5h | Media |
| 7 | Templates e Extras | 5h | Baixa |
| -- | Melhorias de UX | 5h | Baixa |

**Total Restante: ~34 horas**

---

## Recomendacao de Proximos Passos

### Opcao A: Completar as Fases de Alta Prioridade

1. **DealDetailsSheet + Timeline** - Permite visualizar detalhes completos e historico do deal
2. **Campos Customizaveis** - Diferencial competitivo, permite personalizar por tipo de negocio

### Opcao B: Foco em Usabilidade

1. **Filtros e Busca** - Essencial para boards com muitos deals
2. **Analytics Basico** - Metricas de conversao e valor

### Opcao C: Funcionalidades Premium

1. **Automacoes** - Regras de movimentacao automatica
2. **Templates** - Acelera adocao de novos usuarios

---

## Arquivos a Serem Criados nas Proximas Fases

```text
src/pages/crm-builder/
├── components/
│   ├── deals/
│   │   ├── DealDetailsSheet.tsx          # FALTA
│   │   └── DealActivityTimeline.tsx      # FALTA
│   ├── filters/
│   │   ├── BoardFilters.tsx              # FALTA
│   │   ├── FilterBuilder.tsx             # FALTA
│   │   ├── SavedFiltersDropdown.tsx      # FALTA
│   │   └── SearchInput.tsx               # FALTA
│   ├── custom-fields/
│   │   ├── CustomFieldsManager.tsx       # FALTA
│   │   ├── DynamicFieldRenderer.tsx      # FALTA
│   │   ├── FieldTypeSelector.tsx         # FALTA
│   │   └── FieldOptionsEditor.tsx        # FALTA
│   ├── automations/
│   │   ├── AutomationsManager.tsx        # FALTA
│   │   ├── CreateAutomationDialog.tsx    # FALTA
│   │   ├── TriggerSelector.tsx           # FALTA
│   │   └── ActionConfigurator.tsx        # FALTA
│   ├── analytics/
│   │   ├── BoardAnalytics.tsx            # FALTA
│   │   ├── ConversionFunnel.tsx          # FALTA
│   │   ├── ValueByPipeline.tsx           # FALTA
│   │   └── TimeInStageChart.tsx          # FALTA
│   └── boards/
│       ├── BoardSettingsDialog.tsx       # FALTA
│       └── BoardTemplateSelector.tsx     # FALTA
├── hooks/
│   ├── useCRMDealHistory.ts              # FALTA
│   ├── useCRMCustomFields.ts             # FALTA
│   ├── useCRMFilters.ts                  # FALTA
│   ├── useCRMAutomations.ts              # FALTA
│   └── useCRMAnalytics.ts                # FALTA
└── utils/
    ├── dndUtils.ts                       # FALTA (utilitarios DnD)
    ├── fieldValidation.ts                # FALTA
    └── exportUtils.ts                    # FALTA
```

---

## Tabelas Supabase a Criar

```sql
-- Campos Customizaveis
crm_custom_fields (id, board_id, cod_agent, field_name, field_label, field_type, options, is_required, position)

-- Filtros Salvos
crm_saved_filters (id, board_id, cod_agent, name, filter_config, is_default)

-- Automacoes
crm_automations (id, board_id, cod_agent, name, trigger_type, trigger_config, action_type, action_config, is_active)

-- Templates
crm_board_templates (id, name, description, pipelines_config, custom_fields_config, is_system)
```

