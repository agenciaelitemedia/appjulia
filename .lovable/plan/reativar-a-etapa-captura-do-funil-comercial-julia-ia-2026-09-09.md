# Reativar a etapa "Captura" do Funil comercial Julia IA

## O que foi encontrado

A etapa `7289f0a7-8025-452c-a4f1-8dc9ff6e2fe6` é a coluna **"Captura"** do quadro
**"Funil comercial Julia IA"** (escritório 30). Ela está **desativada**, por isso não
aparece no quadro — e junto com ela ficam escondidos 3 cards (1 aberto, 2 arquivados).

Existe uma segunda coluna "Captura" ativa no mesmo quadro, também na primeira posição.

## O que será feito

Reativar a etapa indicada, exatamente como pedido.

Resultado: o quadro passará a mostrar **duas colunas chamadas "Captura"** (a reativada e a
que já estava ativa), e o card aberto volta a aparecer na reativada.

Também vou reposicionar a etapa reativada para a posição 0 e a outra "Captura" para a
posição 1, para que a ordem das colunas fique estável e sem empate.

## Detalhes técnicos

- Atualização de dados em `crm_pipelines`: `is_active = true` para
  `7289f0a7-8025-452c-a4f1-8dc9ff6e2fe6`; ajuste de `position` para desempatar com
  `73b38a25-0e85-4a50-b110-a4c8c945c806`.
- Sem mudança de schema, sem alteração de código, sem mexer em cards.
- Verificação: consultar as etapas do quadro `50365943-5774-4b7b-8406-3023e5c3bdf5`
  e confirmar as duas colunas ativas e a contagem de cards na etapa reativada.
