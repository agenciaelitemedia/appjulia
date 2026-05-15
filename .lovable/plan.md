## Por que aconteceu

A data foi salva como `2026-05-15 00:00:00+00` (UTC) no banco. No fuso de Brasília (UTC−3), esse instante corresponde a **14/05 às 21:00**, então `new Date(task.due_date)` + `format(...)` no `TaskCard` exibem "14 mai".

Causa raiz: tratamos uma data "de calendário" (sem hora) como um instante UTC. Ao converter para o fuso local, ela "anda um dia para trás".

## Plano de correção

Ajustar apenas o **frontend** para tratar o `due_date` como data civil (sem fuso), sem precisar mexer no banco.

1. **Helper de parse seguro** em `TaskCard.tsx`: extrair os 10 primeiros caracteres (`YYYY-MM-DD`) do `task.due_date` e construir `new Date(year, month-1, day)` (meia-noite **local**), evitando o deslocamento UTC.
2. **Mesma comparação para o badge**: usar essa data local para decidir verde/amarelo/vermelho (No prazo / Vence hoje / Atrasada).
3. **Formatação**: `format(localDue, "d MMM", { locale: ptBR })` passará a exibir 15/05 corretamente para datas existentes e novas.

Nada muda no fluxo de gravação — o `<input type="date">` continua enviando `YYYY-MM-DD`, e o banco continua aceitando o mesmo formato. As tarefas já cadastradas passarão a mostrar a data correta automaticamente.

### Arquivo afetado
- `src/pages/tarefas/components/TaskCard.tsx` (somente o bloco `dueBadge`)