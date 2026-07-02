## Correção dos erros de build em `src/components/chat/ContactDetailPanel.tsx`

Duas tags JSX ficaram sem fechamento, o que cascateou todos os erros TS17008/TS1003/TS1381/TS17015/TS1382 reportados.

### 1) Linha ~498 — `<div>` do bloco "Etapa da Julia" nunca fecha

O wrapper `<div className="flex items-center justify-between">` aberto na linha 482 termina o conteúdo condicional do stage na 498, mas a IIFE de Prioridade começa na 499 sem que a div do stage tenha sido fechada. Adicionar `</div>` imediatamente após a linha 498 (antes do `{(() => { ... })()}` da prioridade).

### 2) Linha ~620 — `<h5>` do bloco "Conversas" nunca fecha

O `<h5>` aberto na 619 contém o ícone e o texto "Conversas", mas o bloco condicional `isLoadingHistory` começa na 621 sem `</h5>` antes. Adicionar `</h5>` imediatamente após "Conversas" (fim da linha 620), antes do `{isLoadingHistory ? ...}`.

### Depois

Nenhuma outra mudança. Os demais erros (fragmento `</>` na 545, etc.) desaparecem sozinhos porque são consequência das duas tags acima.

Após a aprovação e a correção, retomo o consolidado dos agentes de performance (DB, frontend, backend, UX) — o de UX já concluiu e o de DB também; falta apenas frontend e backend.