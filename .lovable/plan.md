## Objetivo
Em `/agente/filas`, quando o limite de filas for atingido, o botão "Nova Fila" deve ficar clicável e abrir um popup informando o limite, com um link para adquirir mais filas que redireciona para `/filas/contratar`.

## Estado atual
- `src/pages/agente/filas/FilasPage.tsx` desabilita o botão "Nova Fila" via `disabled={limitReached}` quando o usuário atinge o limite, mostrando apenas um tooltip explicativo.
- Resultado: o usuário não consegue clicar e não tem um caminho claro para contratar mais filas.

## Mudanças (apenas frontend)

### `src/pages/agente/filas/FilasPage.tsx`
1. Remover o `disabled={limitReached}` e o `TooltipProvider/Tooltip` em volta do botão "Nova Fila".
2. Adicionar estado `limitDialogOpen`.
3. Alterar o `onClick` do botão:
   - Se `limitReached` → `setLimitDialogOpen(true)`.
   - Caso contrário → comportamento atual (`setWizardOpen(true)` via `handleNew`).
4. Adicionar um `<AlertDialog>` (shadcn) novo com:
   - **Título:** "Limite de filas atingido"
   - **Descrição:** "Você atingiu o limite de {queueLimit} fila(s) do seu plano. Para adicionar mais filas, adquira filas adicionais."
   - **Cancel:** "Fechar"
   - **Action:** "Contratar mais filas" → usa `useNavigate()` do `react-router-dom` para ir para `/filas/contratar` e fecha o dialog.

### Detalhe técnico
- Importar `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` de `@/components/ui/alert-dialog`.
- Importar `useNavigate` de `react-router-dom`.
- Manter todo o restante da página (cards, wizard, delete/restore) intacto.

## Fora de escopo
- Nenhuma mudança em hooks, edge functions, banco ou na rota `/filas/contratar` (já existe).
