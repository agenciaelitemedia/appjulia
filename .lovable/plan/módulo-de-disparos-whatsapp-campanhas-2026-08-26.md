# Módulo de Disparos WhatsApp (Campanhas)

Novo módulo isolado em `src/modules/disparos/`, com tabelas próprias `dsp_*`, motor de fila persistente e regras anti-bloqueio agressivas para a API não oficial (UaZapi). Fase 1 é operacional: campanha → público → fila → limites → métricas. Consentimento formal, classificação de risco e aprovação de supervisor ficam para a fase 2 (o schema já nasce preparado).

## O que o usuário vai poder fazer

1. Criar campanha: nome, objetivo, canal (Oficial / UaZapi / automático), conteúdo (texto ou template WABA com variáveis), horário permitido e agendamento.
2. Montar público: filtros de contatos do chat (canal, tags, etapa do CRM, última interação), lista de telefones colada ou CSV.
3. Simular antes de enviar: total, duplicados, suprimidos, inválidos, fora de horário, filas usadas e duração estimada.
4. Escolher as filas/instâncias que vão disparar — o sistema distribui (rotação) respeitando o limite individual de cada uma.
5. Rodar, pausar, retomar e cancelar. Ver progresso em tempo real: enviados, entregues, lidos, respondidos, falhas, opt-outs.
6. Configurar por instância os limites de segurança (por minuto/hora/dia, intervalo mínimo, bloco + pausa, falhas consecutivas).
7. Ver a lista de supressão (descadastros, números inválidos) e adicionar/remover manualmente.

## Regras anti-bloqueio (foco UaZapi)

Configuráveis por fila/instância em `dsp_channel_limits`, aplicadas pelo worker antes de cada envio:

- `max_per_minute`, `max_per_hour`, `max_per_day`, `max_unique_recipients_per_day`.
- `min_seconds_between_messages` + jitter aleatório (intervalo mínimo e máximo, sorteado por mensagem).
- Blocos: envia `block_size` mensagens e pausa `block_pause_seconds` (também com jitter).
- Janela de horário permitido (ex. 08:00–20:00) e dias da semana.
- Rampa: limite diário cresce no máximo X% por dia por instância (impede salto abrupto de volume).
- Rotação de números: round-robin entre as filas selecionadas, sempre pulando quem está no limite, desconectada ou em cooldown.
- Rotação de mensagem: várias variantes de texto por campanha, sorteadas por destinatário, para não repetir texto idêntico em massa.
- Circuit breaker: pausa a campanha e marca a instância em cooldown ao detectar desconexão, novo QR, `max_consecutive_failures` atingido, pico de números inválidos ou pico de opt-outs. Retomada só manual.
- Limite de frequência por contato: no máximo 1 mensagem de marketing/24h e 2/7 dias (configurável por cliente).
- Na API Oficial: só template aprovado fora da janela de 24h; respeita `Retry-After`; erro permanente não é retentado.

## Arquitetura

```text
UI (src/modules/disparos)  ->  dsp_campaigns / dsp_recipients
                                        |
                    dsp-campaign-prepare (edge)  -> gera destinatários elegíveis
                                        |
                              dsp_message_queue (fila)
                                        |
          dsp-campaign-worker (edge, pg_cron a cada 1 min, FOR UPDATE SKIP LOCKED)
                       |                                  |
                waba-send (Oficial)              uazapi-proxy (não oficial)
                       |                                  |
                       +------ webhooks existentes -> dsp_message_events -> métricas
```

- Nada de credencial no frontend: worker usa as filas (`queues`) já cadastradas e os proxies existentes.
- Idempotência: `idempotency_key = client_id:campaign_id:contact_phone:variant`, única.
- Retentativas: 1min / 5min / 15min / 1h para timeout e 5xx; número inválido = falha permanente + supressão; canal desconectado = pausa sem gastar tentativa.

## Isolamento e uso da Julia via extends

Todo arquivo do módulo é novo; nenhuma tela existente é alterada. O acesso a recursos da Julia acontece só por `src/modules/disparos/extend/`:

- `extend/db.ts` → `supabase`, `externalDb`
- `extend/auth.ts` → `useAuth`, `isOwner`, `resolveEffectiveClientId`
- `extend/queues.ts` → hooks de filas e status de conexão existentes
- `extend/chat.ts` → contatos, tags, preview de mensagem, variáveis
- `extend/phone.ts` → normalização E.164 / variantes de telefone
- `extend/useEnsureDisparosModule.ts` → auto-registro do módulo (padrão `useEnsure*Module`), code `campaigns_dispatch`, rota `/disparos`, grupo `AGENTES DA JULIA`

Rota protegida em `App.tsx` (`<ProtectedRoute module="campaigns_dispatch">`) — única alteração fora da pasta do módulo, junto do lazy import.

## Detalhes técnicos

Tabelas novas (RLS + GRANT no mesmo migration, `client_id` em todas):

- `dsp_campaigns` — status (`draft|scheduled|preparing|running|paused|completed|cancelled|failed`), canal, categoria, agendamento, janela de horário, contadores, motivo de pausa.
- `dsp_campaign_variants` — variantes de texto/mídia para rotação de mensagem.
- `dsp_campaign_channels` — filas selecionadas + peso na rotação.
- `dsp_recipients` — 1 linha por contato (único `campaign_id + phone_e164`), elegibilidade, motivo de exclusão, variante, fila usada, ids do provedor, timestamps de sent/delivered/read/replied/failed.
- `dsp_message_queue` — prioridade, `available_at`, lock (`locked_by`, `locked_at`), tentativas, `idempotency_key` única.
- `dsp_message_events` — evento bruto do provedor, chave única para dedupe.
- `dsp_suppression` — telefone, motivo, origem; nunca revertido automaticamente.
- `dsp_channel_limits` — limites/jitter/blocos/rampa por fila.
- `dsp_channel_state` — contadores da janela corrente, falhas consecutivas, cooldown.
- `dsp_audit_log`.

Edge functions novas: `dsp-campaign-prepare`, `dsp-campaign-worker` (agendada por pg_cron), `dsp-campaign-control` (start/pause/resume/cancel), `dsp-optout-scan` (varre respostas recebidas em `chat_messages` procurando SAIR/PARAR/CANCELAR/REMOVER/STOP/NÃO QUERO → grava supressão, cancela pendências, **sem responder ao contato**).

Envio reaproveita `waba-send` (com `queue_id`) e `uazapi-proxy`; toda mensagem enviada é persistida em `chat_messages` para aparecer no chat e a resposta cair no atendimento normal.

## Entrega em etapas

1. Migration das tabelas `dsp_*` + pg_cron do worker.
2. `dsp-campaign-prepare` + `dsp-campaign-worker` + `dsp-campaign-control` com todas as regras de limite/rotação/circuit breaker.
3. UI: lista de campanhas, wizard (finalidade → público → conteúdo/variantes → filas → simulação → agendar), painel de monitoramento.
4. Tela de configuração de limites por instância + tela de supressão.
5. `dsp-optout-scan` e métricas (delivery/read/reply/optout/invalid rate).
