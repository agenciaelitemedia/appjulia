# Por que o contrato foi gerado sem os 11 dados

## O que aconteceu nesta sessão
Na sessão do Mario (Especialista — Autismo TEA), no mesmo turno de 18:45 o agente chamou
`registrar_dados` (CPF), `mover_estagio` (contrato) e `gerar_contrato` — tudo de uma vez.
Os dados coletados têm apenas `nome_completo` e `cpf_responsavel`; RG, endereço, bairro,
cidade, UF, CEP, nome/CPF/nascimento do filho nunca foram pedidos.

Três causas somadas:

1. **Instrução genérica contradiz o prompt do escritório.** O motor injeta um "Objetivo do
   estágio" fixo para contrato: *"Colete nome completo, CPF e confirmação dos dados e gere o
   contrato"*. Isso autoriza exatamente o atalho que o agente tomou, mesmo com a seção
   CONTRATO do prompt pedindo 11 campos.
2. **As instruções da etapa de contrato só entram no turno seguinte.** Quando o modelo
   decidiu gerar, a sessão ainda estava em negociação; ele mudou de etapa e gerou no mesmo
   turno, então o guia do E6 (Passo 1 literal, Passo 2 um dado por mensagem, Passo 3
   conferência) não estava no prompt daquele turno.
3. **A ferramenta não exige nada.** `gerar_contrato` só requer `nome_completo`; nada verifica
   se os campos obrigatórios do contrato existem nos dados coletados.

## Correção proposta
- **Guia de etapa alinhado**: trocar o texto fixo do estágio "contrato" para "siga
  exatamente a lista de campos definida no prompt do escritório, um por mensagem, confirme
  tudo e só então gere" — sem citar nome/CPF como suficientes.
- **Sem gerar contrato no mesmo turno da troca de etapa**: ao entrar em contrato via
  `mover_estagio`, o turno é reconstruído já com as instruções do E6, e `gerar_contrato`
  chamado no mesmo turno é recusado com orientação de iniciar o Passo 1.
- **Trava de campos obrigatórios**: cada caso jurídico passa a ter a lista de campos
  exigidos para contrato; `gerar_contrato` confere os dados coletados e, se faltar algum,
  responde "faltam: RG, endereço, ..." em vez de gerar. Para o caso TEA, os 11 campos do
  prompt.
- **Regra global no prompt**: nunca chamar `gerar_contrato` antes de listar todos os campos
  e receber um "sim" explícito.

## Detalhes técnicos
- `_shared/x-julia/prompt.ts`: reescrever `STAGE_GUIDE.contrato`; acrescentar em
  `BASE_RULES` a proibição de gerar contrato sem conferência; no estágio contrato, listar os
  campos obrigatórios do caso marcando quais já estão nos slots.
- Migração: `xj_legal_cases.contract_fields jsonb not null default '[]'`
  (`[{key,label,validation}]`), com seed dos 11 campos do caso Autismo (TEA — BPC/LOAS).
- `_shared/x-julia/skills.ts` (`gerar_contrato`): validar `session.slots` contra
  `contract_fields` do caso e devolver as pendências como resultado da skill; registrar no
  `XJRunContext` que a etapa acabou de mudar para contrato, bloqueando geração no mesmo turno.
- `_shared/x-julia/runner.ts`: sinalizar a mudança de etapa dentro do laço de skills (mesmo
  mecanismo do handoff de especialista) e reconstruir as mensagens com o guia do E6.
- Frontend: editor de casos do módulo X-Julia ganha a lista de campos do contrato, para o
  escritório manter a lista sem migração.
- Deploy de `x-julia-engine` no final.