# Data e hora atual para os agentes (skill `data_hora`)

Hoje o prompt do X-Julia não informa a data/hora atual em nenhum lugar. O modelo "adivinha" o dia, então erra ao dizer "amanhã", calcular prazos ou montar a data de um agendamento (`agendar` recebe um ISO inventado pelo modelo).

A correção tem duas camadas: uma âncora fixa no prompt (sempre presente) e uma skill que o agente chama para fazer contas com datas.

## 1. Âncora de tempo no prompt

Em todo turno, o bloco de sistema passa a incluir, no fuso de Brasília:

- data e hora agora (ex.: `domingo, 09/08/2026 11:29 (America/Sao_Paulo)`);
- referências prontas de `hoje`, `amanhã` e `depois de amanhã` com dia da semana;
- regra explícita: nunca supor a data; usar essa âncora ou a skill; ao falar de prazos, dizer dia da semana + data.

Isso já resolve a maioria dos erros (saudação fora de hora, "amanhã" errado, mês/ano trocado).

## 2. Nova skill `data_hora`

Ferramenta que o agente pode chamar quando precisa de precisão:

- entrada opcional `expressao` (ex.: `hoje+3d`, `proxima segunda`, `+2 semanas`, `fim do mes`) e `formato` (`data`, `data_hora`, `iso`);
- saída: data/hora resolvida em BRT, dia da semana, ISO com fuso `-03:00` e diferença em dias em relação a hoje;
- também informa se o momento cai dentro do horário de atendimento configurado do agente (reaproveitando o utilitário de business hours), útil para não marcar fora do expediente.

O cálculo é feito em código (não pelo modelo), sempre em `America/Sao_Paulo`, com fuso explícito na saída para não repetir o problema conhecido de hora gravada sem `-03:00`.

## 3. Agendamento mais seguro

- A descrição de `agendar` passa a exigir ISO com fuso e a instruir que a data venha de `data_hora` ou de `consultar_agenda`, nunca deduzida.
- `agendar` valida a data: rejeita datas no passado e além de 90 dias, respondendo ao agente para pedir o horário de novo em vez de gravar algo errado.
- `consultar_agenda` devolve os horários com dia da semana e data completa.

## Detalhes técnicos

- `supabase/functions/_shared/x-julia/prompt.ts`: novo bloco de âncora temporal em `buildXJMessages` + regra em `BASE_RULES`.
- Novo helper `supabase/functions/_shared/x-julia/datetime.ts`: `nowBRT()`, `formatBRT()`, `resolveExpression()` (parser de expressões relativas em pt-BR), com offset `-03:00` fixo.
- `supabase/functions/_shared/x-julia/skills.ts`: entrada `data_hora` em `XJ_TOOLS` + `case "data_hora"` em `runXJSkill`; ajustes em `agendar`/`consultar_agenda`.
- Deploy da `x-julia-engine` (o módulo `_shared` é empacotado com ela).
- Sem mudança de schema e sem alteração no chat/UI.