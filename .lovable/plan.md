

# Paginação, telefone clicável e filtro colapsado no dashboard advogado

## Alterações

### 1. `src/pages/adv/components/AdvContratosCards.tsx`

**Paginação por seção (10 por vez):**
- Adicionar estado `visibleEmCurso` e `visibleAssinados` (iniciam em 10)
- Renderizar apenas `.slice(0, visibleX)` de cada seção
- Botão "Carregar mais" no final de cada seção quando houver mais itens

**Telefone clicável no "Ligue Agora":**
- Tornar o número de telefone um `<button>` que dispara `onCall(contrato)` quando `phoneAvailable`, caso contrário um `<a href="tel:...">` como fallback
- Estilo: texto azul/laranja clicável com underline

### 2. `src/pages/adv/AdvDashboardPage.tsx`

**Filtro sempre colapsado:**
- Mudar `initialDates` para usar sempre `last7days` como padrão (ignorar `getInitialDates` que retorna a última seleção salva)
- Passar prop para `UnifiedFilters` indicando que deve iniciar fechado

**Título dinâmico no filtro:**
- O `UnifiedFilters` já mostra "Filtros" no header do collapsible. Precisamos customizar para mostrar o período ativo no título, ex: "Filtro · 7 Dias"

**Abordagem para o título:** Adicionar nova prop `collapsedLabel` ou `defaultOpen={false}` ao `UnifiedFilters`, e compor o label no `AdvDashboardPage` externamente. Alternativa mais simples: adicionar props `defaultOpen` e `periodLabel` ao `UnifiedFilters`.

### 3. `src/components/filters/UnifiedFilters.tsx`

- Adicionar prop `defaultOpen?: boolean` (default `true` para não quebrar outros usos)
- Usar `defaultOpen` no `useState(defaultOpen ?? true)` para `isOpen`
- Adicionar prop `showPeriodInHeader?: boolean` — quando true e filtro fechado, mostrar label do período ativo ao lado de "Filtros" (ex: "Filtros · 7 Dias")
- Derivar o label do período ativo a partir de `currentQuickPeriod` e do array `quickPeriods`

### 4. `src/components/filters/types.ts`

- Adicionar `defaultOpen?: boolean` e `showPeriodInHeader?: boolean` ao `UnifiedFiltersProps`

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/adv/components/AdvContratosCards.tsx` | Paginação 10/seção + telefone clicável |
| `src/pages/adv/AdvDashboardPage.tsx` | Default 7 dias, filtro fechado, mostrar período no header |
| `src/components/filters/UnifiedFilters.tsx` | Props `defaultOpen` e `showPeriodInHeader` |
| `src/components/filters/types.ts` | Tipos das novas props |

