# X-Julia (Extreme Julia) — agente jurídico autônomo

Novo módulo independente em `src/modules/x-julia/`, com motor próprio, tabelas próprias, CRM próprio e skills. Coexiste com os agentes atuais da Julia (nada do fluxo legado é alterado): um lead é atendido pela X-Julia somente quando a fila estiver vinculada a um agente X-Julia.

## 1. O que o agente faz

Especialista em recepção e conversão de lead jurídico, operando em estágios:

```text
recepcao → triagem_caso → qualificacao → (desqualificado)
                              ↓
                        proposta/negociacao
                              ↓
                      contrato_gerado → contrato_assinado
                              ↓
                     (agendamento | atendimento_humano)
```

- **Recepção**: saudação, coleta de nome, canal e origem.
- **Triagem do caso**: identifica a área/caso jurídico usando a biblioteca de Casos Jurídicos já existente (103 casos / 9 categorias) e faz as perguntas de apuração do caso.
- **Qualificação**: aplica critérios configuráveis (documentos, prazo, viabilidade, ticket mínimo). Resultado: qualificado, falta dado, ou desqualificado com motivo.
- **Negociação**: apresenta honorários/plano configurados, trata objeções, registra valor acordado.
- **Contrato**: gera o contrato do template do escritório e envia o link de assinatura.
- **Acompanhamento**: cobra assinatura em cadência até assinar, expirar ou o lead desistir.
- **Handoff humano**: transfere para fila/pessoa quando o lead pede, quando bate regra de escalonamento ou quando a confiança do modelo cai.
- **Agendamento**: reserva horário na agenda interna do escritório e confirma no chat.

Cada turno da conversa: carregar sessão → montar contexto (histórico + caso + CRM) → chamar o modelo com as skills como ferramentas → executar as skills → persistir estado, estágio e movimentação no CRM.

## 2. Estado e memória (novas tabelas, prefixo `xj_`)

- `xj_agents` — agente X-Julia por cliente: persona, tom, prompt base, modelo, limites, horário, política de handoff, provider de contrato.
- `xj_agent_queue_links` — fila ↔ agente X-Julia (é o que “liga” a X-Julia num atendimento).
- `xj_sessions` — sessão viva por contato/conversa: `stage`, `case_type`, `qualification`, `score`, `slots` (JSONB com dados coletados), `paused_reason`, `handoff_at`, `last_customer_message_at`.
- `xj_session_events` — trilha completa: turno do modelo, skill executada, mudança de estágio, custo/tokens.
- `xj_followups` — cobranças agendadas: `run_at`, `attempt`, `template`, `status`. Substitui a dependência do n8n.
- `xj_pipelines` / `xj_deals` / `xj_deal_history` — CRM próprio, com etapas espelhando os estágios e histórico de tempo por etapa.
- `xj_contracts` — contrato do lead: provider, template, valores, `external_id`, status (`draft|sent|signed|expired`), `signed_at`, URL do documento.
- `xj_appointments` + `xj_availability` — agenda interna (janelas por usuário/escritório e horários reservados).
- `xj_skill_configs` — habilita/configura skills por agente.

Todas com `client_id`, `created_at/updated_at` + trigger, RLS habilitada e GRANTs para `authenticated`/`service_role`.

## 3. Skills (ferramentas do modelo)

Cada skill é uma tool com schema validado, executada no servidor e registrada em `xj_session_events`:

| Skill | Efeito |
|---|---|
| `identify_case` | Classifica o caso jurídico e grava em `xj_sessions.case_type` |
| `collect_data` | Preenche slots (nome, CPF, documentos, datas, valores) |
| `qualify_lead` | Marca qualificado/desqualificado com motivo e score |
| `create_deal` / `move_crm_stage` | Cria e move o card em `xj_deals` com histórico |
| `generate_contract` | Renderiza template e cria o contrato via provider |
| `send_contract` | Envia link de assinatura pelo chat |
| `check_contract_status` | Consulta o provider e atualiza `xj_contracts` |
| `schedule_appointment` | Lista horários livres e reserva em `xj_appointments` |
| `handoff_human` | Atribui a conversa a fila/usuário e pausa o agente |
| `schedule_followup` | Cria/reprograma cobrança em `xj_followups` |
| `send_media` | Envia arquivo da Biblioteca (modelo, tabela de honorários) |

Contrato com **provider plugável**: adaptador `zapsign` (reusa as funções ZapSign existentes) + adaptador `internal` (documento próprio com link de assinatura). O agente sempre chama `generate_contract`; o provider vem de `xj_agents`.

Agendamento **interno agora**: agenda própria com janelas de disponibilidade, atrás de um adaptador preparado para receber `google_calendar` depois sem mudar o contrato da skill.

## 4. Integração com o chat

- O webhook de entrada (uazapi/WABA/Instagram/WebChat) continua igual; após gravar a mensagem, se a fila tiver agente X-Julia e a sessão não estiver pausada, dispara `x-julia-engine`.
- **Override humano**: envio manual de atendente pausa a sessão (mesma regra de hoje) e cancela followups pendentes; mensagens de bot/automação não pausam.
- Header do chat com badge de status X-Julia (ativo/pausado/handoff) e botão de ligar/desligar por conversa; painel lateral mostra estágio, caso, score, contrato e agendamento.
- Encerrar/reabrir conversa e transferir fila respeitam a sessão (retoma no mesmo estágio).

## 5. Followup próprio

- Sempre que o agente responde e fica aguardando, agenda o próximo toque em `xj_followups` com a cadência do agente (ex.: 2h, 1d, 3d, 7d — mensagens diferentes por estágio).
- Cron chama `x-julia-followup-runner`: pega os vencidos, gera a mensagem com contexto do estágio e envia pelo canal da fila.
- Resposta do lead cancela os pendentes. Esgotadas as tentativas: move para etapa “sem resposta” e opcionalmente desqualifica.
- Contrato enviado e não assinado tem cadência própria até assinar/expirar.

## 6. Telas do módulo

- `/x-julia` — lista de agentes, status e métricas rápidas.
- `/x-julia/novo` e `/x-julia/:id` — wizard/edição em abas (Persona & Prompt, Casos & Qualificação, Negociação & Contrato, Skills, Followup, Filas, Handoff).
- `/x-julia/crm` — CRM próprio (Kanban por estágio, filtros, card com timeline da sessão, contrato e agendamento).
- `/x-julia/sessoes` — sessões em andamento com ações manuais (pausar, reengajar, forçar handoff).
- `/x-julia/execucoes` — trilha de eventos/skills com custo e latência.
- `/x-julia/agenda` — disponibilidade e agendamentos.

Auto-registro do módulo (padrão `useEnsure*Module`) com códigos `x_julia`, `x_julia_crm`, `x_julia_agenda` e permissões por perfil/usuário; dono do cliente e admin veem tudo.

## 7. Detalhes técnicos

- Pasta independente `src/modules/x-julia/` com `module.ts`, `pages/`, `components/`, `hooks/`, `extend/`. Todo consumo de outros módulos (chat, filas, biblioteca, casos jurídicos, permissões, clientId efetivo) passa por `extend/*`, como em `escritorios` e `flow-builder`.
- Backend: `supabase/functions/x-julia-engine` (turno + loop de skills), `x-julia-followup-runner` (cron), `x-julia-contract` (gerar/consultar via provider), `x-julia-schedule` (disponibilidade/reserva); lógica compartilhada em `supabase/functions/_shared/x-julia/` (`runner.ts`, `skills/*.ts`, `prompt.ts`, `providers/contract/*`, `providers/calendar/*`).
- Modelo via Lovable AI Gateway com tool calling; escolha por feature em `client_ai_model_config` e uso registrado em `ai_usage_logs`, como no resto do sistema.
- Espelhamento opcional no CRM Builder: flag no agente cria/atualiza um `crm_deals` equivalente e grava `custom_fields.links.chat`, para os relatórios atuais continuarem valendo.
- Zero mudança nas tabelas e funções da Julia atual (`sessions`, `crm_deals`, `n8n_execute-*`).
- Envio de mensagem sempre pelo `messaging-factory` existente, respeitando janela e credenciais da fila.

## 8. Ordem de construção

1. Migração das tabelas `xj_*` (RLS + GRANTs) e módulo/rotas/permissões.
2. Motor `x-julia-engine` com prompt por estágio e skills de dados/CRM.
3. CRM X-Julia + integração visual no chat.
4. Followup próprio + cron.
5. Skills de contrato (ZapSign + interno) e acompanhamento até assinatura.
6. Agenda interna + skill de agendamento; handoff humano.
7. Trilha de execuções, métricas e espelhamento opcional no CRM Builder.