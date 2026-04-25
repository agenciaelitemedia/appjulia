## Objetivo
Reorganizar o conteúdo da aba **Detalhes** do `DealDetailsSheet` (sidebar de detalhes do card no CRM Builder) seguindo a nova ordem solicitada e adicionar edição inline para Responsável, Descrição e Valor.

## Nova ordem (de cima para baixo, após o título)

1. **Vínculos** — `<DealLinksSection>` (Chat / Julia / fila / stage). Mover para o topo.
2. **Contato** — nome + telefone (+ email se existir), como já é renderizado.
3. **Responsável** — badge ocupando a linha inteira, com botão de editar inline (input + salvar/cancelar). Atualiza via `updateDeal({ assigned_to })`.
4. **Prioridade + Tempo na fase** — uma linha própria, ocupando toda a largura (grid 2 colunas full-width como já existe, mas reposicionada). Prioridade continua como badge colorido (sem edição aqui — já é editável pelo card).
5. **Tags** — se houver (mantém renderização atual).
6. **Descrição** — se houver, com botão de editar inline (Textarea + salvar/cancelar). Se vazia, mostrar botão "Adicionar descrição". Atualiza via `updateDeal({ description })`.
7. **Valor** — caixa destacada existente, com ícone de lápis para editar inline (Input numérico + salvar/cancelar). Atualiza via `updateDeal({ value })`.
8. **Datas (Criado / Atualizado)** — rodapé do conteúdo (mantém formatação atual).

> Observação: o bloco "Previsão de Fechamento" (`expected_close_date`) não foi listado pelo usuário, mas existe hoje. Vou mantê-lo logo antes das datas (rodapé) para não perder informação. Caso queira removê-lo, basta avisar.

## Mudanças técnicas — `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

- Reordenar os blocos JSX dentro do `<TabsContent value="details">` conforme a nova ordem.
- Adicionar 3 estados locais de edição:
  - `editingAssignee` + `assigneeDraft`
  - `editingDescription` + `descriptionDraft`
  - `editingValue` + `valueDraft`
- Receber nova prop `onUpdate: (data: Partial<CRMDealFormData>) => Promise<boolean>` (ligada ao `updateDeal` já existente em `useCRMDeals`).
- Cada campo editável segue o padrão já usado no projeto (ícone de lápis pequeno → input/textarea inline → botões check/x), com `Enter` salva e `Esc` cancela quando aplicável.
- Adicionar bloco novo de **Responsável** (badge full-width estilo prioridade, com avatar/User icon + nome ou "Não atribuído" + botão editar).

## Mudanças em `BoardPage.tsx`
- Passar `onUpdate={(data) => updateDeal(selectedDeal.id, data)}` para o `DealDetailsSheet`.

## Não muda
- Footer de ações (Editar/Ganho/Perdido/Arquivar) permanece como está.
- Aba **Atividade** permanece intocada.
- `DealCard` (board) não é alterado.