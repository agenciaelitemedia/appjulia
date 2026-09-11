# Filtro por data no painel do CRM Builder

Adicionar um filtro de data ao painel "Filtros" do quadro, no mesmo estilo visual dos filtros de Prioridade e Situação (badges arredondados), e um ícone no botão de limpar filtros.

## O que muda na tela

Dentro do painel de Filtros, acima de "Prioridade", entra um novo bloco **Data**:

1. **Referência da data** — escolha de qual data usar:
   - Data de criação
   - Data de atualização
   - Data de entrega
2. **Período** — badges no mesmo estilo dos outros filtros:
   - Hoje
   - Ontem
   - Mês atual
   - Personalizado
3. Ao escolher **Personalizado**, aparecem dois campos de data (início e fim).

Clicar novamente no badge ativo desliga o filtro de data. O contador de filtros ativos passa a contar o filtro de data, e "Limpar tudo" também o limpa.

O botão **Limpar tudo** ganha um ícone de borracha à esquerda do texto.

## Comportamento

- Sem período selecionado, nada muda: todos os cards aparecem como hoje.
- Cards sem a data escolhida (por exemplo, sem data de entrega) ficam fora do resultado enquanto o filtro de data estiver ativo.
- As datas usam o fuso de São Paulo, igual ao resto do sistema.
- O texto "X de Y cards" continua refletindo o resultado filtrado.

## Detalhes técnicos

- `src/pages/crm-builder/components/filters/BoardFilters.tsx`
  - Estender `BoardFiltersState` com `dateField: 'created_at' | 'updated_at' | 'due_date'` (default `created_at`), `datePeriod: 'today' | 'yesterday' | 'thisMonth' | 'custom' | null`, `dateFrom: string`, `dateTo: string`.
  - Novo bloco de UI: `Select` para a referência + botões-badge para os períodos + dois `Input type="date"` quando `datePeriod === 'custom'`.
  - Cálculo das datas reutilizando `calculatePeriodDates` de `@/hooks/usePersistedPeriod` (`today`, `yesterday`, `thisMonth`).
  - `activeFiltersCount` soma 1 quando há período ativo; `handleClearFilters` reseta os novos campos.
  - Ícone `Eraser` (lucide) no botão "Limpar tudo".
- `src/pages/crm-builder/BoardPage.tsx`
  - Incluir os novos campos no estado inicial de `filters`.
  - No `filteredDeals`, aplicar comparação do campo escolhido contra `dateFrom`/`dateTo` por data (comparando os primeiros 10 caracteres em `YYYY-MM-DD`, coerente com o armazenamento atual), descartando cards sem valor no campo.

Nenhuma mudança de banco, consultas ou lógica de negócio — apenas filtragem no cliente sobre os cards já carregados.
