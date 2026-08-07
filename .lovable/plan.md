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

- **Entrada por CTA de campanha**: o atendimento começa por gatilho de CTA (anúncio/campanha ads). O CTA identifica campanha, caso jurídico provável e roteiro inicial; sem CTA reconhecido o agente faz a triagem aberta.
- **Recepção**: saudação personalizada pela campanha de origem, coleta de nome e confirmação do interesse.
- **Triagem do caso**: usa a **lista de casos jurídicos própria do módulo** (`xj_legal_cases`, independente do módulo atual) com roteiro de perguntas, fluxo de qualificação e base de conhecimento por caso.
- **Qualificação**: aplica critérios configuráveis (documentos, prazo, viabilidade, ticket mínimo) apoiado na base de conhecimento do caso. Resultado: qualificado, falta dado, ou desqualificado com motivo.
- **Negociação**: apresenta honorários/plano configurados, trata objeções, registra valor acordado.
- **Contrato**: gera o contrato pelo **template do caso** (cada caso jurídico tem o seu, com fallback no template do escritório) e envia o link de assinatura.
- **Acompanhamento**: cobra assinatura em cadência até assinar, expirar ou o lead desistir.
- **Handoff humano**: transfere para fila/pessoa quando o lead pede, quando bate regra de escalonamento ou quando a confiança do modelo cai.
- **Agendamento**: reserva horário na agenda interna do escritório e confirma no chat.

Cada turno da conversa: carregar sessão → montar contexto (histórico + caso + CRM) → chamar o modelo com as skills como ferramentas → executar as skills → persistir estado, estágio e movimentação no CRM.

## 2. Estado e memória (novas tabelas, prefixo `xj_`)

- `xj_agents` — agente X-Julia por escritório/cliente: persona, tom, **prompt próprio do escritório** (system prompt + blocos por estágio), provider/modelo de LLM, provider de voz, limites, horário, política de handoff, provider de contrato.
- `xj_prompt_versions` — histórico versionado do prompt de cada escritório, com rollback.
- `xj_legal_cases` / `xj_case_questions` / `xj_case_knowledge` — **biblioteca de casos exclusiva do módulo**: caso, categoria, roteiro de perguntas, critérios de qualificação, arquivos/textos de base de conhecimento e template de contrato do caso.
- `xj_cta_triggers` — CTAs das campanhas ads: palavra-chave/padrão da mensagem, `campaign_id`, caso jurídico alvo, prompt/abertura específica e agente que assume.
- `xj_agent_queue_links` — fila ↔ agente X-Julia (é o que “liga” a X-Julia num atendimento).
- `xj_sessions` — sessão viva por contato/conversa: `stage`, `case_type`, `qualification`, `score`, `slots` (JSONB com dados coletados), `paused_reason`, `handoff_at`, `last_customer_message_at`.
- `xj_session_events` — trilha completa: turno do modelo, skill executada, mudança de estágio, custo/tokens.
- `xj_followup_cadences` / `xj_followup_steps` — cadência configurável por agente/caso/estágio: ordem, atraso, canal e **conteúdo do passo** (texto, áudio, vídeo, imagem, documento, link) ou `generated` (mensagem criada pelo modelo a partir do histórico da conversa).
- `xj_followups` — execuções agendadas: `run_at`, `attempt`, `step_id`, `status`. Substitui a dependência do n8n.
- `xj_pipelines` / `xj_deals` / `xj_deal_history` — CRM próprio, com etapas espelhando os estágios e histórico de tempo por etapa.
- `xj_contracts` — contrato do lead: provider, template, valores, `external_id`, status (`draft|sent|signed|expired`), `signed_at`, URL do documento.
- `xj_appointments` + `xj_availability` — agenda interna (janelas por usuário/escritório e horários reservados).
- `xj_skill_configs` — habilita/configura skills por agente.

Todas com `client_id`, `created_at/updated_at` + trigger, RLS habilitada e GRANTs para `authenticated`/`service_role`.

## 3. Skills (ferramentas do modelo)

Cada skill é uma tool com schema validado, executada no servidor e registrada em `xj_session_events`:

| Skill | Efeito |
|---|---|
| `identify_case` | Classifica o caso na biblioteca do módulo e grava em `xj_sessions.case_type` |
| `search_knowledge` | Consulta a base de conhecimento do caso para entender e qualificar |
| `read_document` | Lê PDF/imagem/planilha recebida, extrai dados e devolve ao fluxo |
| `collect_data` | Preenche slots (nome, CPF, documentos, datas, valores) |
| `qualify_lead` | Marca qualificado/desqualificado com motivo e score |
| `create_deal` / `move_crm_stage` | Cria e move o card em `xj_deals` com histórico |
| `generate_contract` | Renderiza o template do caso e cria o contrato via provider |
| `send_contract` | Envia link de assinatura pelo chat |
| `check_contract_status` | Consulta o provider e atualiza `xj_contracts` |
| `schedule_appointment` | Lista horários livres e reserva em `xj_appointments` |
| `handoff_human` | Atribui a conversa a fila/usuário e pausa o agente |
| `schedule_followup` | Cria/reprograma a cadência em `xj_followups` |
| `send_voice_reply` | Responde em áudio (TTS) quando o lead fala por áudio ou o agente está em modo voz |
| `send_media` | Envia arquivo da Biblioteca (modelo, tabela de honorários) |

Contrato com **provider plugável**: adaptador `zapsign` (reusa as funções ZapSign existentes) + adaptador `internal` (documento próprio com link de assinatura). O agente sempre chama `generate_contract`; o provider vem de `xj_agents`.

Agendamento **interno agora**: agenda própria com janelas de disponibilidade, atrás de um adaptador preparado para receber `google_calendar` depois sem mudar o contrato da skill.

## 3.1 Modelos de LLM e voz (multi-provider)

- Camada `providers/llm/*` com adaptadores para **Lovable AI Gateway, OpenAI, Anthropic (Claude), Google Gemini, OpenRouter, DeepSeek, xAI (Grok) e LLM API**. O agente escolhe provider + modelo em `xj_agents`; troca de modelo não muda o resto do motor (mesma interface de chat + tool calling).
- Chaves de provedores externos guardadas como secrets do backend (nunca no frontend); Lovable AI funciona sem chave. Fallback automático para o gateway se o provider escolhido falhar.
- Uso, custo e latência registrados por turno em `xj_session_events` (e em `ai_usage_logs`).
- **Áudio**: entrada transcrita (STT) e resposta falada com adaptadores `providers/voice/*` para **ElevenLabs** e **Voicemaker** (voz, velocidade e idioma configuráveis por agente). O áudio gerado vai ao chat como mensagem de voz pelo canal da fila.
- **Documentos**: PDF, imagem, DOCX/XLSX e áudio recebidos são processados (extração/OCR/transcrição) e viram contexto da sessão — o agente **nunca para** ao receber anexo: reconhece, resume o que entendeu, valida contra os requisitos do caso e segue o fluxo (ou pede o que faltou).

## 4. Integração com o chat

- O webhook de entrada (uazapi/WABA/Instagram/WebChat) continua igual; após gravar a mensagem, se a fila tiver agente X-Julia e a sessão não estiver pausada, dispara `x-julia-engine`.
- **Override humano**: envio manual de atendente pausa a sessão (mesma regra de hoje) e cancela followups pendentes; mensagens de bot/automação não pausam.
- Header do chat com badge de status X-Julia (ativo/pausado/handoff) e botão de ligar/desligar por conversa; painel lateral mostra estágio, caso, score, contrato e agendamento.
- Encerrar/reabrir conversa e transferir fila respeitam a sessão (retoma no mesmo estágio).

## 5. Followup próprio e configurável

- Cadência montada na tela do agente: número de toques, atraso de cada um (minutos/horas/dias), estágio em que se aplica e conteúdo do passo.
- Cada passo pode ser **conteúdo fixo** (texto, áudio, vídeo, imagem, documento ou link — arquivos da Biblioteca ou upload próprio) ou **gerado por IA** a partir do histórico da conversa, do caso e do estágio.
- Cron chama `x-julia-followup-runner`: pega os vencidos, resolve o conteúdo (fixo ou gerado) e envia pelo canal da fila.
- Resposta do lead cancela os pendentes. Esgotadas as tentativas: move para etapa “sem resposta” e opcionalmente desqualifica.
- Contrato enviado e não assinado tem cadência própria até assinar/expirar.

## 6. Telas do módulo

- `/x-julia` — lista de agentes, status e métricas rápidas.
- `/x-julia/novo` e `/x-julia/:id` — wizard/edição em abas (Persona & Prompt, Modelo & Voz, Casos & Qualificação, CTAs de Campanha, Negociação & Contrato, Skills, Followup, Filas, Handoff).
- `/x-julia/casos` — biblioteca de casos do módulo: roteiro de perguntas, critérios, base de conhecimento (upload de arquivos/textos) e template de contrato por caso.
- `/x-julia/followup` — editor de cadências com preview de cada passo (texto/áudio/vídeo/imagem/link ou “gerado por IA”).
- `/x-julia/crm` — CRM próprio (Kanban por estágio, filtros, card com timeline da sessão, contrato e agendamento).
- `/x-julia/sessoes` — sessões em andamento com ações manuais (pausar, reengajar, forçar handoff).
- `/x-julia/execucoes` — trilha de eventos/skills com custo e latência.
- `/x-julia/agenda` — disponibilidade e agendamentos.

Auto-registro do módulo (padrão `useEnsure*Module`) com códigos `x_julia`, `x_julia_crm`, `x_julia_agenda` e permissões por perfil/usuário; dono do cliente e admin veem tudo.

## 7. Detalhes técnicos

- Pasta 100% independente `src/modules/x-julia/` com `module.ts`, `pages/`, `components/`, `hooks/`, `extend/`. Nenhum import direto de outro módulo: todo recurso externo necessário (chat, filas, biblioteca de mídia, permissões, clientId efetivo, campanhas ads, banco) entra por um arquivo em `extend/` que reexporta/adapta o recurso — mesmo padrão de `escritorios` e `flow-builder`. A lista de casos jurídicos é própria (não usa a do módulo atual).
- Backend: `supabase/functions/x-julia-engine` (turno + loop de skills), `x-julia-followup-runner` (cron), `x-julia-contract`, `x-julia-schedule`, `x-julia-voice` (TTS/STT), `x-julia-ingest-document`; lógica compartilhada em `supabase/functions/_shared/x-julia/` (`runner.ts`, `skills/*.ts`, `prompt.ts`, `providers/llm/*`, `providers/voice/*`, `providers/contract/*`, `providers/calendar/*`).
- Prompt final montado por camadas: prompt do escritório + caso identificado + base de conhecimento + estágio + estado da sessão, versionado em `xj_prompt_versions`.
- Espelhamento opcional no CRM Builder: flag no agente cria/atualiza um `crm_deals` equivalente e grava `custom_fields.links.chat`, para os relatórios atuais continuarem valendo.
- Zero mudança nas tabelas e funções da Julia atual (`sessions`, `crm_deals`, `n8n_execute-*`).
- Envio de mensagem sempre pelo `messaging-factory` existente, respeitando janela e credenciais da fila.

## 8. Ordem de construção

1. Migração das tabelas `xj_*` (RLS + GRANTs) e módulo/rotas/permissões.
2. Biblioteca de casos do módulo (roteiro, critérios, base de conhecimento, template de contrato) e prompt por escritório com versionamento.
3. Motor `x-julia-engine` multi-provider (LLM adaptadores) com prompt por estágio e skills de dados/CRM.
4. CTAs de campanha, CRM X-Julia e integração visual no chat.
5. Áudio (STT + TTS ElevenLabs/Voicemaker) e ingestão de documentos sem interromper o fluxo.
6. Followup configurável (cadências, mídias e passos gerados por IA) + cron.
7. Contrato por caso (ZapSign + interno) e acompanhamento até assinatura.
8. Agenda interna + agendamento; handoff humano.
9. Trilha de execuções, métricas e espelhamento opcional no CRM Builder.