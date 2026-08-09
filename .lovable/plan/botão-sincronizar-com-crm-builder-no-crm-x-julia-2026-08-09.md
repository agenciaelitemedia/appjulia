# Botão "Sincronizar com CRM Builder" no CRM X-Julia

Adicionar, no topo da página `/x-julia/crm`, um botão que cria o quadro "CRM da Julia" no Construtor de CRM e sincroniza todos os cards existentes do CRM X-Julia para ele, usando exatamente os mesmos critérios já definidos no espelhamento automático dos agentes.

## Comportamento

- Botão "Sincronizar com CRM Builder" ao lado do título, visível só para quem pode editar (mesma permissão `x_julia_crm` já usada na página) e desabilitado enquanto roda.
- Ao clicar:
  1. Garante o quadro único e protegido "CRM da Julia" do escritório, com as 9 etapas padrão (Novo lead → Encerrado) — reaproveita o quadro existente, nunca duplica.
  2. Para cada card do CRM X-Julia do escritório: se ainda não tem espelho, cria o card no quadro; se já tem, atualiza título, nome, telefone, valor e move para a etapa equivalente (com registro no histórico do quadro).
  3. Grava o vínculo do espelho no card da Julia para que as atualizações seguintes continuem no mesmo card (sem duplicar).
- Toast final com o resumo: quantos criados, quantos atualizados, quantos movidos.
- Após concluir, mostra um link "Abrir quadro no CRM Builder".

## Detalhes técnicos

- Nova action `crm_sync_builder` na edge function `x-julia-admin` (payload `{ client_id }`), rodando com service role para poder escrever em `crm_boards`, `crm_pipelines`, `crm_deals` e `crm_deal_history`.
- Reaproveita a lógica existente em `supabase/functions/_shared/x-julia/crm.ts`: `ensureJuliaBoard` já é exportada; expor `mirrorToCrmBuilder`/`syncMirroredDeal` (ou extrair uma função `syncDealToBuilder` reutilizada por ambos) para evitar duplicação de regras. Idempotência preservada: match por `xj_deals.mirrored_deal_id` e, se o espelho referenciado não existir mais, recria.
- Etapa do espelho resolvida por `stage_key` (mesmo mapa `DEFAULT_PIPELINES`), sem depender de nome de coluna.
- Não altera as regras atuais do espelhamento automático nem o toggle `mirror_to_crm_builder` do agente — o botão é uma sincronização manual/backfill.
- Frontend: novo hook `useXJSyncCrmBuilder` em `src/modules/x-julia/hooks/useXJCrm.ts` chamando `supabase.functions.invoke('x-julia-admin', { body: { action: 'crm_sync_builder', data: { client_id } } })`, invalidando `['x-julia','deals']` ao final; botão renderizado em `src/modules/x-julia/pages/CrmPage.tsx` via prop de ações do `XJLayout` (ou header local da página, conforme o layout aceitar).
