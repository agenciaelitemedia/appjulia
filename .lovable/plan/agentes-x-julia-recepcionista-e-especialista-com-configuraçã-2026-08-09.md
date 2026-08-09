# Agentes X-Julia: recepcionista e especialista com configuração própria

## Problema
Hoje o cadastro e a tela de configuração são idênticos para os dois papéis: as mesmas 7 abas,
os mesmos campos, o mesmo prompt em branco. O usuário precisa saber de cabeça o que vale para
recepcionista (filas, ativação, triagem) e o que vale para especialista (caso, qualificação,
negociação, contrato, followups). Além disso o escritório 405 tem só 1 caso ("Novo caso") e um
especialista ligado a ele — não há exemplo real configurado.

## 1. Criação guiada por papel
O diálogo "Novo agente" passa a começar pela escolha do papel, com dois cartões explicando a
função de cada um (recepcionista = atende filas e faz triagem; especialista = cuida de 1 caso).

- Recepcionista: nome + mensagem de abertura; já nasce com prompt de recepção/triagem pronto,
  ativação padrão e vínculo de filas sugerido.
- Especialista: nome + caso jurídico (só casos ainda sem especialista) + honorários/observação;
  já nasce com prompt de qualificação/negociação do caso, followups desligados e contrato interno.
- Nome sugerido automaticamente ("Recepção — <escritório>", "Especialista — <caso>").

## 2. Configuração diferente por papel
O editor deixa de mostrar tudo para todos:

| Aba | Recepcionista | Especialista |
|---|---|---|
| Geral | sim (sem campo de caso) | sim + caso fixado e resumo do caso |
| Prompt | estágios recepção/triagem | estágios qualificação → agendamento |
| Ativação (frases, campanha, horário) | sim | oculta (herda a sessão já ativa) |
| LLM & Voz | sim | sim |
| Filas | sim | oculta (não recebe lead direto) |
| Followups | sim (só pré-triagem) | sim (por caso) |
| Contrato | oculta | sim |

Complementos:
- Banner no topo do editor explicando o papel e o que ele faz no fluxo, com link para o outro lado
  do handoff (recepcionista → lista de especialistas; especialista → recepcionista do escritório).
- Aviso quando o especialista não tem caso vinculado ou o caso está inativo, e quando o
  recepcionista não tem nenhuma fila vinculada (nesses casos ele não atende).
- Botão "Aplicar modelo de prompt do papel" para reescrever o prompt base a partir do template.

## 3. Estrutura pronta (escritório 405)
Serão criados, sem apagar nada do que existe:
- Casos jurídicos: **Autismo (TEA — BPC/LOAS)** e **Auxílio-acidente (INSS)**, cada um com resumo,
  critérios de qualificação/desqualificação, documentos necessários e roteiro de perguntas.
- Agente **Recepção — X-Julia** (recepcionista), com prompt de acolhimento/triagem, ligado às filas
  que o recepcionista atual já usa.
- Agentes **Especialista — Autismo (TEA)** e **Especialista — Auxílio-acidente**, cada um vinculado
  ao seu caso, com prompt próprio de qualificação e negociação.
- O agente "X-Julia" especialista atual (ligado a "Novo caso") é mantido como está.

## Detalhes técnicos
- Novo `src/modules/x-julia/lib/agentRolePresets.ts`: templates de `system_prompt` e `stage_prompts`
  por papel + defaults (activation, contract, followups) usados na criação e no botão de modelo.
- `useXJAgents.ts`: `create` aplica o preset do papel (prompt, stage_prompts, activation, contrato);
  novo hook `useXJSpecialistByCase` para mostrar/filtrar casos já ocupados.
- `AgentsPage.tsx`: diálogo em 2 passos (papel → dados), cards agrupados por papel
  (Recepcionistas / Especialistas por caso) com aviso de configuração incompleta.
- `AgentEditorPage.tsx`: `roleView` derivado de `form.role` controla quais `TabsTrigger`/`TabsContent`
  renderizam; `SpecialistCaseSelect` filtra casos já com especialista (exceto o próprio);
  `XJRoleBanner` novo componente com o resumo do papel e os avisos.
- Migração de dados (seed) em SQL: insere `xj_legal_cases` (2), `xj_case_questions` dos roteiros,
  `xj_agents` (3) e `xj_agent_queue_links` do recepcionista, tudo com `client_id='405'`,
  idempotente (`where not exists` por nome).
- Motor não muda: o handoff por `role`/`case_id` já está implementado em `session.ts`/`skills.ts`.
