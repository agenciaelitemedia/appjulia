# Lista de campos do contrato no bloco "Contrato" do prompt

## O que muda
No editor do agente, aba **Prompt**, dentro do bloco **Contrato** (logo abaixo da caixa de instruções da etapa), aparece a lista dos 12 campos possíveis com uma caixa de marcar em cada um. O que estiver marcado é exatamente o que o agente vai pedir, na ordem da lista, antes de gerar o contrato.

Campos do catálogo (rótulo → chave):

1. Nome Completo → `nome_completo`
2. Seu CPF → `seu_cpf`
3. Número da sua Identidade (RG) → `sua_identidade`
4. Seu endereço completo (Rua/Avenida e Número) → `seu_endereco`
5. Seu Bairro → `seu_bairro`
6. Sua Cidade → `sua_cidade`
7. Seu Estado (UF) → `seu_estado`
8. Seu CEP → `seu_cep`
9. Seu e-mail → `seu_email`
10. Nome do Filho → `nome_filho`
11. CPF do Filho → `cpf_filho`
12. Data de Nascimento do Filho → `nascimento_filho`

Comportamento:
- Marcar/desmarcar salva junto com o agente (botão Salvar já existente).
- A marcação vale para o caso jurídico do agente especialista, que é onde o motor já lê a lista obrigatória.
- Se o agente for recepcionista (sem caso vinculado), o bloco mostra um aviso de que a lista pertence ao especialista do caso, sem caixas de marcar.
- Campos personalizados criados na tela de Casos que não estejam no catálogo continuam funcionando e aparecem no fim da lista, também marcáveis.

## Efeito no atendimento
O motor já usa essa lista: pede um campo por mensagem na ordem, registra cada resposta, lista tudo para conferência e recusa gerar o contrato enquanto faltar algum campo marcado. Nada além da lista marcada passa a ser exigido.

## Detalhes técnicos
- Novo `src/modules/x-julia/lib/contractFieldCatalog.ts`: catálogo dos 12 campos (`key`, `label`, `validation`).
- `src/modules/x-julia/pages/AgentEditorPage.tsx`: `PromptTab` recebe `caseId`, `contractFields` e `onContractFieldsChange`; renderiza o checklist dentro do bloco da etapa `contrato`. A página carrega o caso do agente (`xj_legal_cases` por `agent.case_id`) e, no save, atualiza `contract_fields` do caso preservando ordem do catálogo e os campos extras existentes.
- Sem migração: a coluna `xj_legal_cases.contract_fields` já existe; `CasesPage.tsx` (aba Contrato) continua sendo a edição avançada e permanece sincronizada por ler a mesma coluna.
- Sem alteração no motor (`_shared/x-julia/prompt.ts` e `skills.ts` já consomem `contract_fields`), portanto sem novo deploy de edge function.
