# Espelhamento no CRM Builder — sincronizar, escolher destino e mostrar status

## Situação atual (verificada)

- O toggle "Espelhar no CRM Builder" salva de verdade em `xj_agents.mirror_to_crm_builder` e o motor o respeita: hoje 3 agentes estão com ele ligado e 3 dos 8 cards do CRM X-Julia têm card espelhado (`crm_deals` com autor `x-julia`, `xj_deals.mirrored_deal_id` preenchido).
- Limitações reais de hoje:
  - O espelho só é criado **na criação** do card X-Julia; mudanças de fase, valor, descrição e prioridade não chegam ao card espelhado.
  - O destino é fixo: **quadro mais antigo** do escritório e **primeira fase** dele.
  - Se o espelho falhar, o erro só vai para o log da função — não aparece em lugar nenhum na interface.

## O que será feito

### 1. Sincronizar mudanças
- Quando o card X-Julia é atualizado e já existe `mirrored_deal_id`, atualizar o card espelhado: título, contato, valor, descrição, prioridade.
- Quando a etapa muda, mover o card espelhado para a fase correspondente do quadro de destino e registrar a movimentação no histórico do CRM Builder.
- Mapeamento de fase: usar a fase configurada por etapa quando existir; sem correspondência, manter o card na fase atual (nunca voltar para a primeira).

### 2. Quadro fixo "CRM da Julia"
- Ao ligar o espelho em qualquer agente, o sistema garante a existência de **um único** quadro chamado **CRM da Julia** no escritório (cria na hora se não existir; reaproveita se já existir). Nunca mais de um por escritório.
- Esse quadro nasce com as **9 etapas padrão da Julia** (Novo lead, Triagem, Qualificação, Negociação, Contrato enviado, Assinado, Agendado, Atendimento humano, Encerrado), na mesma ordem e cores do CRM X-Julia.
- Proteções do quadro:
  - Não pode ser arquivado/excluído nem renomeado (ações escondidas na interface e bloqueadas no banco).
  - As etapas da Julia não podem ser renomeadas, reordenadas para fora do padrão nem excluídas.
  - O escritório **pode** criar etapas próprias nesse quadro e editar/excluir apenas as que ele criou.
- Todos os agentes com espelho ligado usam esse mesmo quadro — não há seletor de quadro. A fase do card espelhado passa a acompanhar automaticamente a etapa da sessão (etapa da Julia → etapa correspondente do quadro).

### 3. Mostrar status do espelho
- Cada tentativa de espelho grava um evento na sessão (`crm_mirror`: criado / atualizado / movido / erro, com o motivo).
- Na tela de Sessões (detalhe) aparece o status do espelho com link para o card do CRM Builder quando existir, e o erro quando falhar.

## Detalhes técnicos

- Migration:
  - `crm_boards`: `is_system boolean default false` + `system_key text` com índice único parcial (`system_key = 'julia'` por `client_id`) para garantir um só "CRM da Julia".
  - `crm_pipelines`: `is_system boolean default false` + `stage_key text` (chave da etapa da Julia) para amarrar etapa da sessão → fase do quadro.
  - Trigger de proteção: bloqueia `DELETE`/rename em quadro `is_system`, e `DELETE`/rename/reposição em fases `is_system`.
- `supabase/functions/_shared/x-julia/crm.ts`: novo `ensureJuliaBoard(clientId)` (cria/reaproveita quadro + 9 fases padrão, idempotente), `mirrorToCrmBuilder` usa esse quadro e a fase pela `stage_key`, e `syncMirroredDeal` (chamado no ramo de update de `upsertDeal`) atualiza dados e move a fase, gravando em `crm_deal_history`.
- Frontend CRM Builder: `BoardGrid`/`CreateBoardDialog`/`BoardPage` esconde renomear/arquivar/configurar-nome do quadro do sistema; colunas `is_system` sem editar/excluir, com selo "Etapa da Julia".
- Eventos via `logXJEvent` com `kind: "crm_mirror"`.
- Frontend X-Julia: `AgentEditorPage.tsx` mostra, sob o toggle, apenas o aviso de que o espelho usa o quadro "CRM da Julia" (com link), e `SessionDetailPage.tsx` exibe o status do espelho.
- Deploy de `x-julia-engine` e `x-julia-followup-runner` (compartilham `_shared/x-julia`).