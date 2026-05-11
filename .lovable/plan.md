## Objetivo
Corrigir os casos em que conversas com vínculo da Julia ainda aparecem como “Sem etapa” no chat, mesmo quando existe etapa no CRM correspondente.

## O que foi identificado
- Para o exemplo informado (`5584996154035`, fila `MKT São Paulo`), a fila está vinculada ao agente `202604004`.
- A conversa usa esse vínculo da fila corretamente.
- Porém, a consulta ao CRM externo não retornou card para esse telefone nesse agente.
- Além disso, a `ChatList` ainda tem pontos usando a chave antiga por telefone simples (`stageByPhone.get(norm)`) em filtros internos, mesmo após a refatoração para `(telefone + codAgent)`.

## Plano
1. Ajustar toda a `ChatList` para usar consistentemente a chave composta `telefone|codAgent` em todos os filtros e totalizadores.
2. Fortalecer a resolução de etapa no hook `useCRMStageByPhone` para cobrir variações de telefone mais robustas e manter coerência com os outros fluxos Julia do sistema.
3. Validar o caso real informado e confirmar se ele falha por bug de frontend ou por ausência/inconsistência do card na base externa.
4. Se o card realmente não existir para o agente da fila, preservar o fallback “Sem etapa” apenas nesse cenário real; se existir em outro formato, corrigir a normalização para capturá-lo.

## Arquivos previstos
- `src/components/chat/ChatList.tsx`
- `src/hooks/useCRMStageByPhone.ts`
- Possivelmente `src/lib/phoneVariants.ts` se a cobertura de variações precisar ser ampliada

## Detalhes técnicos
- Substituir usos restantes de:
  - `stageByPhone.get(norm)`
- Por buscas com chave composta:
  - ```${normPhone}|${agentCodAgent}```
- Revisar estes pontos na lista:
  - filtros de etapa
  - totalizadores
  - modo de busca
  - lista visível pendente/aberta
- Se necessário, ampliar `getBrPhoneVariants` para aceitar também formatos legados sem `55`, sem `9`, ou ambos, sem quebrar os fluxos já existentes.

## Resultado esperado
- Conversas Julia sempre mostrarão a etapa correta quando existir card para o agente da fila.
- “Sem etapa” só aparecerá quando realmente não houver card correspondente no CRM externo para aquele agente.
- Filtros e contadores por etapa deixarão de usar a chave antiga e ficarão coerentes com o badge exibido.