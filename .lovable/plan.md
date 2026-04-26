## Objetivo

Traduzir para o português **somente os textos visíveis** ao usuário no módulo `/crm-builder`. Identificadores internos (`value` de `<SelectItem>`, chaves de objetos, tipos TypeScript, nomes de campos no banco — `priority`, `status`, `won`, `lost`, `board`, `pipeline`, `deal` etc.) **permanecerão inalterados** para preservar o funcionamento da aplicação.

## Termos identificados e tradução proposta

| Original (UI) | Tradução |
|---|---|
| CRM Builder (título da página) | Construtor de CRM |
| Board / Boards | Quadro / Quadros |
| Deal / Deals | Card / Cards |
| Pipeline (quando exposto) | Etapa |
| Status (label de filtro) | Situação |

## Arquivos e mudanças exatas

### 1. `src/pages/crm-builder/CRMBuilderPage.tsx`
- L93: `"CRM Builder"` → `"Construtor de CRM"`
- L153: `"Arquivar Board"` → `"Arquivar Quadro"`
- L155: `'arquivar o board "..."'` → `'arquivar o quadro "..."'`
- L156: `"Todos os deals serão mantidos, mas o board não aparecerá mais na listagem."` → `"Todos os cards serão mantidos, mas o quadro não aparecerá mais na listagem."`
- L174: `"Auditoria do CRM Builder"` → `"Auditoria do Construtor de CRM"`

### 2. `src/pages/crm-builder/components/boards/CreateBoardDialog.tsx`
- L114: `"Editar Board" / "Novo Board"` → `"Editar Quadro" / "Novo Quadro"`
- L118-119: `"Atualize as informações do seu board." / "Crie um novo board para organizar seus negócios."` → `"Atualize as informações do seu quadro." / "Crie um novo quadro para organizar seus cards."`
- L141: `placeholder "Uma breve descrição do board..."` → `"Uma breve descrição do quadro..."`

### 3. `src/pages/crm-builder/components/boards/BoardGrid.tsx`
- L58: `"Novo Board"` → `"Novo Quadro"`

### 4. `src/pages/crm-builder/components/deals/DealActivityTimeline.tsx`
- L35: `label: 'Deal criado'` → `label: 'Card criado'` (a chave `created` permanece)
- L116: `placeholder "Escreva uma nota sobre este deal..."` → `"Escreva uma nota sobre este card..."`

### 5. `src/pages/crm-builder/components/audit/AuditLogPanel.tsx`
- L82: `<SelectItem value="board">Board</SelectItem>` → `>Quadro</SelectItem>` (mantém `value="board"`)

### 6. `src/pages/crm-builder/components/filters/BoardFilters.tsx`
- L175: `<Label>Status</Label>` → `<Label>Situação</Label>` (mantém os `value`s `open|won|lost|archived`)

## O que NÃO será alterado (intencional)

- **Identificadores em código**: tipos `CRMDeal`, `DealPriority`, `DealStatus`, props como `onWon`, `onLost`, hooks `useCRMBoards`, nomes de tabelas/colunas (`crm_deals`, `priority`, `status`, `pipeline_id`, `board_id`).
- **Atributos `value` dos `<SelectItem>`** (ex.: `value="board"`, `value="created"`) — apenas o texto visível muda.
- **`PRIORITY_CONFIG` e `STATUS_CONFIG`**: já estão com `label` em português ("Baixa", "Aberto", "Ganho" etc.) — nada a mudar.
- **Labels já traduzidos** ("Editar Card", "Novo Card", "Nova Etapa", "Prioridade", "Tags", "Tempo na Etapa", "Conversa do card", "Auditoria", "Automações", "Movido", "Atualizado", "Marcado como ganho/perdido" etc.) — permanecem.
- **Tags/labels técnicas** como "Tags" (já é um termo amplamente usado em PT-BR no contexto de aplicações) — manter.

## Resultado esperado

O usuário verá somente termos em português na navegação, diálogos, filtros, abas e timeline do CRM Builder, sem qualquer mudança estrutural no código (props, tipos, valores armazenados, queries continuam idênticos).
