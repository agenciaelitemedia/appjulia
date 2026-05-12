## Objetivo

Mostrar nos cards do CRM Builder **quem criou** e **quem atualizou** (além das datas que já existem), registrar essa autoria também no **histórico do card**, e cobrir eventos hoje sem registro de atividade — incluindo a criação do card a partir do **chat** (que hoje não gera histórico nem grava o autor).

---

## 1. Banco de dados (uma migration)

`crm_deals`:
- Adicionar coluna `updated_by text` (a `created_by` já existe).
- Backfill: preencher `created_by` (quando NULL) usando o primeiro evento `created` em `crm_deal_history` daquele deal; preencher `updated_by` com o `changed_by` do evento mais recente.

`crm_deal_history`:
- Ampliar o `action_check` para incluir `'archived'` (arquivamento hoje não tem histórico).
- Os demais eventos (`created`, `moved`, `updated`, `won`, `lost`, `note_added`) continuam usados.

Nenhuma alteração de RLS — políticas atuais cobrem.

---

## 2. Front-end — `useCRMDeals.ts` (núcleo das gravações)

Em todas as escritas, propagar o nome do usuário logado (`userName`, já recebido pelo hook):

- **`createDeal`**: incluir `created_by: userName` no INSERT. Já grava history `created` com `changed_by` (ok).
- **`updateDeal`**: incluir `updated_by: userName` no UPDATE. History `updated` já é gravado com `changes` — passar a serializar **somente os campos realmente alterados** (diff) para o timeline ficar legível.
- **`moveDeal`**: ao gravar a linha do card movido, incluir `updated_by: userName`. History `moved` já é registrado.
- **`setDealStatus(won|lost)`**: incluir `updated_by: userName`. History já é registrado.
- **`archiveDeal`**: incluir `updated_by: userName` **e** passar a registrar history com `action: 'archived'` + `changed_by: userName` (hoje não grava nada).

---

## 3. Criação de card a partir do chat

Dois pontos de criação que hoje não preenchem autoria nem histórico:

- `src/components/chat/CreateCrmCardSheet.tsx` (handleCreate, ~linha 220)
- `src/components/chat/CreateCrmLeadDialog.tsx` (handleCreate, ~linha 108)

Em ambos:
1. Obter `user?.name` do `AuthContext`.
2. Adicionar `created_by: user?.name` no INSERT em `crm_deals`.
3. Após o insert (com `.select().single()`), inserir em `crm_deal_history`:
   - `action: 'created'`
   - `to_pipeline_id: selectedPipeline`
   - `changed_by: user?.name`
   - `notes: 'Card criado a partir do chat'`
   - `changes: { source: 'chat', conversation_id }`

Assim o card criado pelo chat aparece no timeline com a mesma estrutura visual dos demais.

---

## 4. UI dos cards

`src/pages/crm-builder/components/deals/DealCard.tsx` (rodapé, linhas 522–539):
- Linha "Criado": exibir `Criado por <nome> em <data>` (fallback "—" quando ausente).
- Linha "Atualizado": exibir `Atualizado por <nome> em <data>` (fallback no `created_by` se `updated_by` for nulo).

`src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` (linhas 1003–1006):
- Mesma alteração nas linhas "Criado em" / "Atualizado em".

---

## 5. Timeline de atividade

`src/pages/crm-builder/components/deals/DealActivityTimeline.tsx`:
- Adicionar entrada em `ACTION_CONFIG` para `'archived'` (ícone `Archive`, cor neutra, label "Card arquivado").
- A coluna `changes` já é renderizada via `describeChange`; cobrir o caso de `priority` (já existe) e garantir suporte a `due_date` quando vier `null` (limpeza).
- Nenhuma mudança visual estrutural — apenas mais eventos passam a aparecer agora que estão sendo gravados.

---

## 6. Tipos TypeScript

`src/pages/crm-builder/types.ts`:
- `CRMDeal`: adicionar `updated_by?: string`.
- `DealHistoryAction`: adicionar `'archived'`.

---

## Resumo dos eventos cobertos depois da mudança

| Evento                    | Hoje   | Depois |
|---------------------------|--------|--------|
| Criação manual            | ✅     | ✅ + `created_by` no card |
| Criação via chat          | ❌     | ✅ + `created_by` |
| Edição (campos)           | ✅     | ✅ + `updated_by` + diff |
| Mudança de prioridade     | ✅ (via update) | ✅ + `updated_by` |
| Movimentação entre etapas | ✅     | ✅ + `updated_by` |
| Movimentação entre boards | ✅     | ✅ (sem alterar) |
| Marcar ganho/perdido      | ✅     | ✅ + `updated_by` |
| Arquivar / excluir        | ❌     | ✅ (`archived`) + `updated_by` |
| Notas                     | ✅     | ✅ (sem alterar) |
