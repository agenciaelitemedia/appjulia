# CRM de Notificações (nova aba em Notificações e Alertas)

Nova aba `CRM de Notificações` na tela `/notificacoes-alertas`, com o mesmo layout, design e comportamento do CRM da Julia — mas as colunas (etapas) são os próprios alertas, e cada card nasce de um alerta disparado.

## Como vai funcionar

- **Colunas** = os 6 gatilhos do módulo: Cliente parou de responder, Lead qualificado, Lead desqualificado, Contrato em curso, Contrato assinado, Fim de fluxo sem destino. Cada coluna com cor própria e contador, igual ao CRM da Julia.
- **Criação do card**: sempre que um alerta é enviado com sucesso, o card é criado nesse CRM (na coluna do gatilho) com os mesmos dados do card do CRM da Julia: nome, WhatsApp, agente (código + alias), responsável, etapa do CRM da Julia, datas, tempo na fase. Se o mesmo lead receber um novo alerta do mesmo gatilho, o card existente é reaberto/atualizado em vez de duplicar.
- **Ações do card** (as mesmas do CRM da Julia): chamar o chat (painel de chat quando o agente tem fila; diálogo de mensagens quando não tem), ligar por ramal, videochamada (admin/colaborador), status da Julia, contrato, editar nome, ver detalhes.
- **Detalhes do card**: dialog igual ao do CRM da Julia, com uma aba nova **Ações de Recuperação** — campo de texto para registrar o que foi feito com o lead; cada envio entra numa timeline cronológica (autor + data/hora), sem apagar as anteriores.
- **Resolução do card**: botões **Recuperado** e **Perdido**. Ambos tiram o card do quadro (vão para um status resolvido) mas continuam contabilizados nos totalizadores. Também há **Excluir card**, que remove definitivamente do CRM de Notificações (com dupla confirmação, padrão do sistema).
- **Totalizadores**: um card por gatilho + Total, no mesmo formato do CRM da Julia, mais contadores de **Recuperados** e **Perdidos** no período.
- **Filtros**: exatamente o mesmo componente do CRM da Julia (`UnifiedFilters`: período rápido, datas, agentes, busca) mais os filtros de Julia ativa/inativa e Responsável, aplicados sobre os cards de notificação.

## Detalhes técnicos

**Banco (migration)**
- `alert_crm_cards`: `id`, `client_id`, `cod_agent`, `trigger_key`, `lead_phone`, `lead_name`, `business_name`, `owner_name`, `crm_stage_label`, `log_id` (ref ao `alert_notification_logs`), `status` (`open` | `recovered` | `lost`), `resolved_at`, `resolved_by`, `stage_entered_at`, `created_at`, `updated_at` + trigger de `updated_at`. Índice único parcial por (`cod_agent`, `lead_phone`, `trigger_key`) para `status='open'` (evita duplicação).
- `alert_crm_card_actions`: `id`, `card_id` (FK cascade), `action_text`, `created_by_name`, `created_by_id`, `created_at`.
- GRANTs para `authenticated` e `service_role` (+ `anon` não), RLS habilitada com políticas permissivas de leitura/escrita para `authenticated`, no mesmo padrão das outras tabelas do módulo.

**Edge function** — em `alert-notifications-cron`, após o insert de sucesso em `alert_notification_logs`, fazer upsert em `alert_crm_cards` (reabrindo card resolvido apenas se um novo alerta do mesmo gatilho ocorrer). Reaproveita os dados já resolvidos ali (nome, telefone, etapa do CRM, agente).

**Frontend** — tudo dentro de `src/modules/notificacoes-alertas/`:
- `extend/crm.ts`: reexporta os componentes reutilizados do CRM da Julia (`UnifiedFilters`, `CRMLeadCard`, `CRMPipeline`/`CRMPipelineColumn`, `CRMTotalizers`, hooks de agentes/aliases/sessão) — nada de import direto fora do módulo.
- `hooks/useAlertCrmCards.ts`: leitura filtrada (período/agentes/busca/status) + mutations `addAction`, `resolveCard('recovered'|'lost')`, `deleteCard`.
- `components/CrmNotificacoesTab.tsx`: monta totalizadores + filtros + pipeline com as colunas por gatilho.
- `components/AlertCrmCardDetailsDialog.tsx`: espelha o dialog do CRM da Julia com a aba **Ações de Recuperação** e os botões Recuperado / Perdido / Excluir.
- `NotificacoesAlertasPage.tsx`: adiciona a aba `CRM de Notificações`.

Os cards do CRM da Julia recebem os dados via props (`CRMCard`), então o card reutilizado é alimentado com um adaptador que converte `alert_crm_cards` para o formato `CRMCard` — sem alterar nenhum arquivo do CRM da Julia.
