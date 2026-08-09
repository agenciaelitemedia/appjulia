---
name: X-Julia Calc Skill
description: Skill `calcular` do X-Julia — renda per capita, somas, percentuais, parcelamento e expressões; obrigatória para qualquer conta
type: feature
---
Todo cálculo do X-Julia passa pela skill `calcular` (`_shared/x-julia/calc.ts`). O modelo nunca calcula de cabeça (regra fixa no BASE_RULES do prompt).

Operações: `renda_per_capita` (rendas[] + pessoas, compara com 1/4 e 1/2 do salário mínimo — critério BPC/LOAS), `soma`, `percentual`, `parcelamento` (com juros compostos opcionais) e `expressao` (parser aritmético próprio, sem eval, aceita vírgula decimal, R$, %, ^, parênteses).

Salário mínimo de referência: `XJ_SALARIO_MINIMO_PADRAO = 1518`; pode ser sobrescrito por `salario_minimo` no argumento. Atualizar a constante quando o mínimo vigente mudar.
