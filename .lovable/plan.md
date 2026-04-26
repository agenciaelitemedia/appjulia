## Ajuste no rodapé do `DealDetailsSheet.tsx`

Arquivo único: `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` (linhas 683–720).

### Mudanças

1. **Unificar em uma única linha** os três botões: `Perdido`, `Ganho` e `Arquivar Card`.
   - Substituir o `grid grid-cols-2` + botão full-width separado por um único `flex items-center gap-2`.
   - `Perdido` e `Ganho` recebem `flex-1` para dividir o espaço restante igualmente.
   - `Arquivar` vira botão **icon-only** com largura fixa (`size="icon"` ou `h-10 w-10`), alinhado na mesma linha à direita.

2. **Botão Arquivar (icon-only)**:
   - Remover o texto "Arquivar Card".
   - Manter apenas o ícone `Archive` (lixeira/arquivo) — trocar para `Trash2` se a intenção é literal "lixeira"; usarei `Trash2` conforme pedido ("ícone da lixeira").
   - Variante `outline` com cor destrutiva (`border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground`) para harmonizar visualmente com Perdido/Ganho na mesma linha.
   - Adicionar `title="Arquivar card"` e `aria-label="Arquivar card"` para acessibilidade (já que perde o label visual).
   - Continua disparando `setConfirmArchive(true)` — a dupla confirmação via `AlertDialog` permanece intacta.

3. **Condicionais preservadas**:
   - `Perdido`/`Ganho` continuam dependendo de `!hideStatusActions && deal.status === 'open'`.
   - `Arquivar` continua dependendo de `!hideArchiveAction`.
   - Caso apenas um dos blocos esteja visível, ainda funciona: o container flex só renderiza os filhos disponíveis. Se só o arquivar estiver visível, ele aparece sozinho à direita (mantém comportamento OK).

### Estrutura final esperada

```tsx
<div className="flex items-center gap-2">
  {!hideStatusActions && deal.status === 'open' && (
    <>
      <Button variant="outline" className="flex-1 border-destructive ..." onClick={...}>
        <XCircle className="h-4 w-4 mr-2" /> Perdido
      </Button>
      <Button variant="outline" className="flex-1 border-primary ..." onClick={...}>
        <Trophy className="h-4 w-4 mr-2" /> Ganho
      </Button>
    </>
  )}
  {!hideArchiveAction && (
    <Button
      variant="outline"
      size="icon"
      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground shrink-0"
      title="Arquivar card"
      aria-label="Arquivar card"
      onClick={() => setConfirmArchive(true)}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )}
</div>
```

### Imports
- Adicionar `Trash2` ao import do `lucide-react` (manter `Archive` apenas se ainda for usado em outro local do arquivo; caso contrário, remover).

### Não muda
- Modo Chat (`footerExtra`): continua exatamente como está (Fechar / Abrir no CRM).
- `AlertDialog` de confirmação de arquivar (título, descrição contextual e botão "Arquivar Card") permanecem inalterados.
- Bloco de Contato e demais seções não são tocados.