

# Etapa 5 — Prompt Final (Preview + Salvar)

## O que sera construido

Nova etapa no wizard (step 4, total 5 etapas) que processa o template base substituindo placeholders com os dados informados nas etapas anteriores, exibe o resultado em textarea readonly e salva o prompt gerado no banco.

## Migracao SQL

Adicionar coluna `generated_prompt` (text, nullable) na tabela `generation_agent_prompts` para persistir o prompt final processado.

## Funcao de processamento (`promptDefaults.ts`)

Nova funcao `processFinalPrompt` que recebe o `prompt_text` do template + dados da AI config + casos e faz as substituicoes:

| Placeholder | Fonte |
|---|---|
| `[[NOME_IA]]` | Campo Nome da IA |
| `[[HORARIO_FUNCIONAMENTO]]` | Campo Horario |
| `[[INFORMACOES_ESCRITORIO]]` | Campo Info Escritorio |
| `[[AREAS_ATUACOES]]` | Campo Areas de Atuacao |
| `[[BOAS_VINDAS]]` | Campo Mensagem Boas Vindas |
| `[[CTAS_JURIDICOS]]` | CTAs de todos os casos → formato `\| "cta" \| Nome Caso \|` |
| `[[PALAVRAS_SEMANTICAS]]` | semantic_words de todos os casos concatenados |
| `[[LISTA_CASOS]]` | case_info de todos os casos, renumerando titulos `### X N.` |
| `[[ROTEIROS_CASOS]]` | qualification_script + negotiation_text de todos os casos, renumerando `CASO N:` |

Logica de renumeracao: regex nos titulos `### .+ \d+\.` e `CASO \d+:` substituindo pelo indice sequencial (1, 2, 3...).

## Componente `StepFinalPrompt.tsx`

- Textarea readonly grande (min-h-[500px], font-mono) com o prompt processado
- Botao "Copiar" para clipboard
- Botoes Voltar / Salvar Prompt

## Alteracoes no Wizard

- `STEPS` passa de 4 para 5: `['Agente', 'Template', 'Informacoes', 'Casos', 'Prompt Final']`
- Step 3 (Casos): botao muda de "Salvar" para "Proximo" → vai para step 4
- Step 4 (Prompt Final): ao montar, chama `processFinalPrompt` com template.prompt_text + aiConfig + cases
- Botao "Salvar" no step 4 chama `createPrompt` incluindo o campo `generated_prompt`

## Alteracao no hook `useAgentPrompts`

- `AgentPrompt` interface ganha campo `generated_prompt: string | null`
- `createPrompt` e `updatePrompt` passam o campo `generated_prompt` ao inserir/atualizar

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | `ALTER TABLE generation_agent_prompts ADD COLUMN generated_prompt text` |
| `constants/promptDefaults.ts` | Nova funcao `processFinalPrompt` |
| `components/wizard/StepFinalPrompt.tsx` | Novo componente etapa 5 |
| `components/AgentPromptWizard.tsx` | Adicionar step 5, ajustar stepper e navegacao |
| `components/wizard/StepCaseSelect.tsx` | Trocar "Salvar" por "Proximo" |
| `hooks/useAgentPrompts.ts` | Adicionar `generated_prompt` na interface e CRUD |

