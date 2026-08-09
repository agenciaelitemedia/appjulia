# X-Julia: recepcionista + subagentes especialistas por caso

## Objetivo
Hoje cada fila tem 1 agente X-Julia e todos os casos jurídicos ficam num catálogo do
escritório. A conversa toda roda num único agente. A mudança: manter **um agente
recepcionista** (recepção + triagem) que, ao identificar o caso, **transfere a sessão para o
agente especialista daquele caso**. Cada especialista é 100% independente (prompt, LLM,
voz, horário, contrato, followups) e atende exatamente **um caso jurídico**.

## 1. Papéis de agente
Cada agente X-Julia passa a ter um papel:

- **Recepcionista (roteador)**: é o que fica vinculado às filas. Faz recepção, colhe o
  primeiro nome, faz a triagem e identifica o caso. Não qualifica nem negocia.
- **Especialista**: não é vinculado a fila; é vinculado a **um caso** da biblioteca.
  Assume a conversa da etapa de qualificação em diante, com prompt e roteiro próprios.

Na lista de agentes (`/x-julia/agentes`) os dois tipos aparecem com badge de papel;
o especialista mostra o caso que atende, e o caso mostra qual agente responde por ele.

## 2. Transferência automática no meio da conversa
Quando o recepcionista chama a skill de identificar caso:

1. o caso é fixado na sessão (como hoje);
2. o motor procura o especialista **ativo** daquele caso;
3. se existir, a sessão passa a ter esse agente (`agent_id`), registra na trilha um evento
   de transferência ("Transferido para o agente X — caso Y") e o mesmo turno já continua
   com o prompt/modelo do especialista, na etapa de qualificação;
4. se não existir especialista, ou ele estiver inativo/fora do horário, o recepcionista
   continua conduzindo normalmente (comportamento atual — nada quebra).

A conversa segue no mesmo WhatsApp/fila: para o lead é uma única conversa contínua.
Followups, contrato, CRM e agenda passam a usar a configuração do especialista, pois tudo
já é resolvido a partir do agente da sessão.

## 3. Efeitos nas telas
- **Agentes**: seletor de papel na criação/edição; para especialista, seletor de caso
  (só casos ainda sem especialista, para garantir 1 caso = 1 agente).
- **Casos jurídicos**: coluna/badge com o agente especialista responsável.
- **Sessões**: mostra o agente atual e o histórico de transferências na trilha; filtro por
  agente continua funcionando.
- **Dashboard**: métricas por agente passam a refletir o agente que efetivamente atendeu.

## 4. Como configurar (depois de implantado)
1. Manter o agente atual como **recepcionista**, ligado às filas.
2. Criar um agente **especialista** por caso (ex.: "Especialista — Salário Maternidade"),
   escolhendo o caso, o prompt, o LLM e a voz de cada um.
3. Ajustar no recepcionista apenas o prompt de recepção/triagem.

## Detalhes técnicos
- Migração:
  - `xj_agents`: `role text not null default 'reception'` (`reception|specialist`) e
    `case_id uuid references xj_legal_cases(id) on delete set null`;
    índice único parcial `(client_id, case_id) where role='specialist' and case_id is not null`
    para garantir um agente por caso.
  - Backfill: agentes existentes ficam `reception` (nenhuma quebra).
- `_shared/x-julia/session.ts`: `findAgentForQueue` passa a exigir `role='reception'`
  (com fallback para qualquer agente vinculado, para não derrubar setups atuais);
  nova `findSpecialistForCase(supabase, clientId, caseId)`.
- `_shared/x-julia/skills.ts` (`identificar_caso`): após fixar o caso, resolve o
  especialista, atualiza `xj_sessions.agent_id`, grava evento `agent_handoff` e sinaliza a
  troca no `XJRunContext` (novo campo `agentSwitched`).
- `_shared/x-julia/runner.ts`: ao detectar `agentSwitched` dentro do laço de skills,
  recarrega `ctx.agent` do banco e **reconstrói as mensagens** (prompt do especialista +
  roteiro/base do caso) antes da próxima rodada do LLM; o restante do turno (envio, TTS,
  followup) usa o novo agente.
- `_shared/x-julia/prompt.ts`: quando o agente é especialista, o catálogo de casos não é
  injetado e o guia de estágio de triagem é substituído por instrução de continuidade
  ("o caso já está definido, não repita a triagem"). Recepcionista ganha instrução de
  parar na triagem e chamar `identificar_caso`.
- Frontend: `AgentEditorPage.tsx` (papel + caso), `AgentsPage.tsx` (badges/coluna),
  `useXJAgents.ts` (campos novos), `CasesPage`/`useXJCases.ts` (agente responsável),
  `SessionDetailPage.tsx` (evento de transferência), `types.ts` do módulo.
- Deploy de `x-julia-engine` no final.
