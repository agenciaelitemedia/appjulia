
# Plano: CRM Customizável de Classe Mundial

## Visão Geral

Criar um sistema de CRM completamente customizável inspirado nos melhores do mercado (Salesforce, HubSpot, Pipedrive, Monday.com), combinando a simplicidade do Trello com a robustez do Salesforce. O sistema permitirá múltiplos boards, pipelines configuráveis, drag-and-drop fluido, campos customizáveis, automações e analytics em tempo real.

---

## Arquitetura de Funcionalidades

### Nível 1: Fundação (MVP)
| Recurso | Inspiração |
|---------|------------|
| Multi-Boards | Monday.com, Notion |
| Pipelines Customizáveis | Pipedrive |
| Drag & Drop Fluido | Trello, Linear |
| Cards com Campos Básicos | HubSpot |

### Nível 2: Diferenciação
| Recurso | Inspiração |
|---------|------------|
| Campos Customizáveis Dinâmicos | Salesforce, Airtable |
| Filtros Avançados Salvos | HubSpot, Notion |
| Automações/Regras | Pipedrive, Zapier |
| Timeline de Atividades | Salesforce |

### Nível 3: Excelência
| Recurso | Inspiração |
|---------|------------|
| Analytics por Board/Pipeline | Pipedrive, Monday.com |
| Importação/Exportação | HubSpot |
| Templates de Board | Notion, Monday.com |
| Histórico Completo | Salesforce |

---

## Modelo de Dados (Lovable Cloud)

### Tabelas Principais

```text
crm_boards
├── id (uuid, PK)
├── cod_agent (text) - Multi-tenancy
├── name (text)
├── description (text)
├── icon (text) - lucide icon name
├── color (text) - hex color
├── position (int) - ordenação
├── is_archived (bool)
├── settings (jsonb) - configurações extras
├── created_at / updated_at
└── created_by (uuid)

crm_pipelines
├── id (uuid, PK)
├── board_id (uuid, FK → crm_boards)
├── cod_agent (text)
├── name (text)
├── color (text)
├── position (int)
├── is_active (bool)
├── win_probability (int) - % para forecasting
└── created_at / updated_at

crm_deals
├── id (uuid, PK)
├── pipeline_id (uuid, FK → crm_pipelines)
├── board_id (uuid, FK → crm_boards)
├── cod_agent (text)
├── title (text)
├── description (text)
├── value (numeric) - valor monetário
├── currency (text, default 'BRL')
├── contact_name (text)
├── contact_phone (text)
├── contact_email (text)
├── priority (enum: low/medium/high/urgent)
├── status (enum: open/won/lost/archived)
├── position (int) - ordenação no pipeline
├── expected_close_date (date)
├── custom_fields (jsonb) - campos dinâmicos
├── tags (text[]) - etiquetas
├── assigned_to (uuid)
├── created_at / updated_at
├── stage_entered_at (timestamptz)
└── created_by (uuid)

crm_deal_history
├── id (uuid, PK)
├── deal_id (uuid, FK → crm_deals)
├── action (enum: created/moved/updated/note_added/won/lost)
├── from_pipeline_id / to_pipeline_id
├── changed_by (text)
├── changed_at (timestamptz)
├── changes (jsonb) - diff de campos
└── notes (text)

crm_custom_fields (Campos Dinâmicos)
├── id (uuid, PK)
├── board_id (uuid, FK)
├── cod_agent (text)
├── field_name (text) - nome interno
├── field_label (text) - label exibido
├── field_type (enum: text/number/date/select/multiselect/checkbox/url/phone/email/currency)
├── options (jsonb) - para select/multiselect
├── is_required (bool)
├── position (int)
├── default_value (text)
└── created_at

crm_saved_filters
├── id (uuid, PK)
├── board_id (uuid, FK)
├── cod_agent (text)
├── name (text)
├── filter_config (jsonb)
├── is_default (bool)
└── created_at

crm_automations
├── id (uuid, PK)
├── board_id (uuid, FK)
├── cod_agent (text)
├── name (text)
├── trigger_type (enum: deal_created/deal_moved/field_changed/time_based)
├── trigger_config (jsonb)
├── action_type (enum: move_deal/update_field/send_notification/webhook)
├── action_config (jsonb)
├── is_active (bool)
└── created_at

crm_board_templates
├── id (uuid, PK)
├── name (text)
├── description (text)
├── pipelines_config (jsonb)
├── custom_fields_config (jsonb)
├── is_system (bool) - templates padrão
└── created_at
```

---

## Estrutura de Arquivos

```text
src/pages/crm-builder/
├── CRMBuilderPage.tsx              # Página principal com lista de boards
├── BoardPage.tsx                   # Página de um board específico
├── types.ts                        # Tipos TypeScript
│
├── components/
│   ├── boards/
│   │   ├── BoardGrid.tsx           # Grid de boards
│   │   ├── BoardCard.tsx           # Card de um board
│   │   ├── CreateBoardDialog.tsx   # Criar board
│   │   ├── BoardSettingsDialog.tsx # Configurações do board
│   │   └── BoardTemplateSelector.tsx
│   │
│   ├── pipeline/
│   │   ├── PipelineContainer.tsx   # Container com DnD
│   │   ├── PipelineColumn.tsx      # Coluna de pipeline
│   │   ├── CreatePipelineDialog.tsx
│   │   ├── EditPipelineDialog.tsx
│   │   └── PipelineHeader.tsx      # Header com contador e ações
│   │
│   ├── deals/
│   │   ├── DealCard.tsx            # Card de deal (draggable)
│   │   ├── DealCardCompact.tsx     # Versão compacta
│   │   ├── CreateDealDialog.tsx
│   │   ├── DealDetailsSheet.tsx    # Sheet lateral com detalhes
│   │   ├── DealActivityTimeline.tsx
│   │   ├── DealCustomFields.tsx    # Renderiza campos dinâmicos
│   │   └── DealQuickActions.tsx
│   │
│   ├── filters/
│   │   ├── BoardFilters.tsx        # Barra de filtros
│   │   ├── SavedFiltersDropdown.tsx
│   │   ├── FilterBuilder.tsx       # Construtor de filtros avançados
│   │   └── SearchInput.tsx
│   │
│   ├── custom-fields/
│   │   ├── CustomFieldsManager.tsx # CRUD de campos
│   │   ├── FieldTypeSelector.tsx
│   │   ├── DynamicFieldRenderer.tsx # Renderiza campo por tipo
│   │   └── FieldOptionsEditor.tsx
│   │
│   ├── automations/
│   │   ├── AutomationsManager.tsx
│   │   ├── CreateAutomationDialog.tsx
│   │   ├── TriggerSelector.tsx
│   │   └── ActionConfigurator.tsx
│   │
│   └── analytics/
│       ├── BoardAnalytics.tsx
│       ├── ConversionFunnel.tsx
│       ├── ValueByPipeline.tsx
│       └── TimeInStageChart.tsx
│
├── hooks/
│   ├── useCRMBoards.ts             # CRUD boards + realtime
│   ├── useCRMPipelines.ts          # CRUD pipelines
│   ├── useCRMDeals.ts              # CRUD deals + drag logic
│   ├── useCRMDragDrop.ts           # Lógica de DnD com dnd-kit
│   ├── useCRMCustomFields.ts
│   ├── useCRMFilters.ts
│   ├── useCRMAutomations.ts
│   └── useCRMAnalytics.ts
│
└── utils/
    ├── dndUtils.ts                 # Helpers para drag-and-drop
    ├── fieldValidation.ts
    └── exportUtils.ts
```

---

## Dependências Necessárias

| Pacote | Uso |
|--------|-----|
| `@dnd-kit/core` | Core do drag-and-drop |
| `@dnd-kit/sortable` | Ordenação de items |
| `@dnd-kit/utilities` | Helpers CSS |
| `@dnd-kit/modifiers` | Modificadores de comportamento |

---

## Detalhes de Implementação

### Fase 1: Fundação (Boards + Pipelines + Deals Básicos)

**1.1 Tabelas no Lovable Cloud**
- Criar 4 tabelas principais: `crm_boards`, `crm_pipelines`, `crm_deals`, `crm_deal_history`
- Habilitar Realtime para atualizações em tempo real
- RLS policies baseadas em `cod_agent`

**1.2 Página de Boards (CRMBuilderPage)**
- Grid responsivo de cards de boards
- Criar/Editar/Arquivar boards
- Cores e ícones customizáveis
- Ordenação via drag-and-drop

**1.3 Página de Board Individual (BoardPage)**
- Header com nome, filtros e ações
- Pipelines como colunas horizontais
- Scroll horizontal suave
- Contador de deals por pipeline

**1.4 Drag & Drop com dnd-kit**
```typescript
// Estrutura do DnD
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  <SortableContext items={pipelines} strategy={horizontalListSortingStrategy}>
    {pipelines.map((pipeline) => (
      <PipelineColumn key={pipeline.id} pipeline={pipeline}>
        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>
      </PipelineColumn>
    ))}
  </SortableContext>
  <DragOverlay>{activeItem && <DealCard deal={activeItem} />}</DragOverlay>
</DndContext>
```

**1.5 Deal Card**
- Design compacto e legível
- Informações essenciais: título, valor, contato
- Badges de prioridade e tags
- Quick actions (editar, mover, deletar)
- Indicador de tempo na fase

---

### Fase 2: Campos Customizáveis

**2.1 Tipos de Campo Suportados**
| Tipo | Componente |
|------|------------|
| text | Input |
| number | Input type=number |
| currency | Input com formatação monetária |
| date | DatePicker |
| select | Select com options |
| multiselect | Multi-select com tags |
| checkbox | Switch |
| url | Input com validação + link |
| phone | Input com máscara |
| email | Input com validação |

**2.2 CustomFieldsManager**
- Listar campos do board
- Criar novo campo com tipo
- Reordenar campos
- Definir obrigatoriedade
- Configurar opções (select/multiselect)

**2.3 DynamicFieldRenderer**
```typescript
function DynamicFieldRenderer({ field, value, onChange }) {
  switch (field.field_type) {
    case 'text': return <Input value={value} onChange={onChange} />;
    case 'currency': return <CurrencyInput value={value} onChange={onChange} />;
    case 'select': return <Select options={field.options} value={value} onChange={onChange} />;
    // ... outros tipos
  }
}
```

---

### Fase 3: Filtros e Busca

**3.1 Filtros Rápidos**
- Busca textual (título, contato, telefone)
- Filtro por pipeline
- Filtro por prioridade
- Filtro por responsável
- Filtro por tags

**3.2 Filtros Avançados (FilterBuilder)**
- Construtor visual de filtros
- Combinar condições (AND/OR)
- Salvar filtros como favoritos
- Compartilhar filtros

**3.3 Busca Global**
- Command+K para busca rápida
- Busca em todos os boards
- Resultados agrupados por board

---

### Fase 4: Automações

**4.1 Triggers Disponíveis**
| Trigger | Descrição |
|---------|-----------|
| deal_created | Quando um deal é criado |
| deal_moved | Quando um deal muda de pipeline |
| field_changed | Quando um campo específico muda |
| time_based | X dias sem movimentação |

**4.2 Actions Disponíveis**
| Action | Descrição |
|--------|-----------|
| move_deal | Mover para outro pipeline |
| update_field | Atualizar campo do deal |
| send_notification | Notificar via WhatsApp |
| webhook | Chamar URL externa |
| assign_to | Atribuir a usuário |

**4.3 Interface de Automações**
- Lista de automações do board
- Ativar/Desativar com switch
- Logs de execução
- Teste de automação

---

### Fase 5: Analytics e Dashboard

**5.1 Métricas por Board**
- Total de deals (abertos/ganhos/perdidos)
- Valor total no pipeline
- Taxa de conversão por pipeline
- Tempo médio em cada fase
- Deals estagnados

**5.2 Gráficos**
- Funil de conversão (Recharts)
- Valor por pipeline (BarChart)
- Evolução temporal (LineChart)
- Distribuição por responsável

**5.3 Board Analytics Page**
- Dashboard com cards de KPIs
- Gráficos interativos
- Filtros de período
- Export para PDF/Excel

---

### Fase 6: Templates e Extras

**6.1 Templates de Board**
| Template | Pipelines Padrão |
|----------|------------------|
| Vendas | Lead → Qualificado → Proposta → Negociação → Fechado |
| Suporte | Novo → Em Análise → Aguardando → Resolvido |
| Recrutamento | Aplicado → Triagem → Entrevista → Proposta → Contratado |
| Jurídico | Entrada → Análise → Documentação → Audiência → Encerrado |

**6.2 Importação/Exportação**
- Importar deals via CSV
- Exportar board para Excel
- Backup de configurações

**6.3 Realtime**
- Sync instantâneo entre usuários
- Indicador de "usuário editando"
- Notificações de mudanças

---

## Rota e Menu

```typescript
// App.tsx
<Route path="/crm-builder" element={<CRMBuilderPage />} />
<Route path="/crm-builder/:boardId" element={<BoardPage />} />
```

Menu lateral com ícone de Kanban ou LayoutDashboard.

---

## Diferenciais Competitivos

| Diferencial | Descrição |
|-------------|-----------|
| **Performance** | Virtualização para 1000+ cards, lazy loading |
| **UX Fluida** | Animações suaves, feedback háptico, atalhos de teclado |
| **Flexibilidade** | Campos 100% customizáveis por board |
| **Inteligência** | Sugestões de automações baseadas em padrões |
| **Integração** | Conectar com WhatsApp, Email, Calendário |
| **Mobile-First** | Touch drag-and-drop, responsive design |
| **Multi-Tenancy** | Isolamento total por cod_agent |

---

## Ordem de Implementação

| # | Etapa | Estimativa |
|---|-------|------------|
| 1 | Criar tabelas no Lovable Cloud | 30min |
| 2 | Instalar @dnd-kit e criar tipos | 15min |
| 3 | BoardGrid + BoardCard + CreateBoardDialog | 2h |
| 4 | PipelineColumn + CreatePipelineDialog | 2h |
| 5 | DealCard + CreateDealDialog + DnD básico | 3h |
| 6 | DealDetailsSheet com timeline | 2h |
| 7 | CustomFieldsManager + DynamicFieldRenderer | 3h |
| 8 | Filtros e busca | 2h |
| 9 | Automações (básico) | 3h |
| 10 | Analytics dashboard | 2h |
| 11 | Templates e polish | 2h |

**Total estimado: 21-25 horas**

---

## Resultado Esperado

Um CRM customizável de nível enterprise que combina:
- **Simplicidade do Trello** - Interface intuitiva
- **Poder do Salesforce** - Campos e automações customizáveis
- **Visual do Pipedrive** - Foco em pipeline visual
- **Flexibilidade do Airtable** - Dados estruturados dinamicamente
- **Colaboração do Monday.com** - Realtime e multi-usuário

O sistema será escalável, performático e totalmente integrado ao ecossistema existente (WhatsApp, Contratos, Julia IA).
