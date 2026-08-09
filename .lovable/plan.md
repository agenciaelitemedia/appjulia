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

### 2. Escolher quadro e fase
- Na aba **Geral** do agente, ao ligar o espelho, aparecem dois seletores: **Quadro de destino** e **Fase inicial** (carregados dos quadros/fases do escritório).
- Um mapa opcional etapa → fase (as 9 etapas do X-Julia) para quem quer o espelho acompanhando o funil; o que não for mapeado usa a fase inicial.
- Sem configuração, o comportamento atual (quadro mais antigo + primeira fase) continua valendo como padrão.

### 3. Mostrar status do espelho
- Cada tentativa de espelho grava um evento na sessão (`crm_mirror`: criado / atualizado / movido / erro, com o motivo).
- Na tela de Sessões (detalhe) aparece o status do espelho com link para o card do CRM Builder quando existir, e o erro quando falhar.

## Detalhes técnicos

- Migration: colunas em `xj_agents` — `mirror_board_id uuid`, `mirror_pipeline_id uuid`, `mirror_stage_map jsonb default '{}'`. GRANTs seguem o padrão já usado na tabela.
- `supabase/functions/_shared/x-julia/crm.ts`: `mirrorToCrmBuilder` passa a resolver destino pela config do agente (fallback atual), e ganha `syncMirroredDeal` chamado no ramo de update de `upsertDeal` (incluindo insert em `crm_deal_history` quando a fase muda).
- `supabase/functions/_shared/x-julia/types.ts`: novos campos em `XJAgent`.
- Eventos via `logXJEvent` com `kind: "crm_mirror"`.
- Frontend: `AgentEditorPage.tsx` (seletores + mapa de etapas, só visíveis com o toggle ligado) e `SessionDetailPage.tsx` (bloco de status do espelho). Hooks de leitura de quadros/fases reaproveitados do CRM Builder.
- Deploy de `x-julia-engine` e `x-julia-followup-runner` (compartilham `_shared/x-julia`).