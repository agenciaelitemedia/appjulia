# Módulo de Disparos — Frontend (Fase 3)

O backend já existe (`dsp_*` no banco + edge functions `dsp-campaign-prepare`, `dsp-campaign-worker`, `dsp-campaign-control`, `dsp-optout-scan`). Falta a camada visível: um módulo único no menu, em rota `/disparos`, organizado em abas.

## O que o usuário vai ver

Rota `/disparos` com abas:

1. **Campanhas** — lista de campanhas (status, canal, progresso, criada em), botão criar/editar, ações Iniciar / Pausar / Retomar / Cancelar (com confirmação; cancelar em dupla confirmação).
2. **Simulação** — escolhe a campanha, roda a prévia sem enviar nada e mostra o relatório: total do público, duplicados, suprimidos, inválidos, fora de janela, bloqueados por limite de frequência, filas que seriam usadas e duração estimada. Nada é enfileirado nesse modo.
3. **Monitoramento** — acompanhamento ao vivo: enviados/entregues/lidos/respondidos/falhas/opt-outs por campanha, estado de cada fila (contadores da janela, falhas consecutivas, cooldown/circuit breaker acionado e motivo), fila de mensagens pendentes com `available_at` (próximo timer) e tentativas por item.
4. **Logs** — eventos por campanha e por fila, com filtro por campanha, fila, tipo de evento e período.
5. **Supressão** — lista de descadastros/telefones inválidos, busca, inclusão e remoção manual.
6. **Configurações** — por fila/instância: quantidade máxima por minuto/hora/dia, destinatários únicos/dia, intervalo mínimo e máximo entre mensagens (jitter), tamanho do bloco e pausa entre blocos, janela de horário permitida e dias da semana, rampa diária (%), falhas consecutivas até cooldown, duração do cooldown, e limite de frequência por contato (24h / 7 dias). Aviso visual reforçado quando a fila é da API não oficial.

Menu: item **Disparos** no grupo `AGENTES DA JULIA`, auto-registrado (padrão `useEnsure*Module`), code `campaigns_dispatch`.

## Guardrails (regras aplicadas antes de qualquer envio não oficial)

A UI nunca envia mensagem direto. Toda ordem passa pelas edge functions, que continuam sendo a única autoridade sobre limites. O que muda nesta fase:

- **Validação na API do módulo**: `dsp-campaign-control` valida, no `start`/`resume`, que a campanha tem ao menos uma fila selecionada, que cada fila tem registro em `dsp_channel_limits` (cria default seguro se faltar), que a janela de horário é coerente, que há conteúdo/variantes e que nenhuma fila está em cooldown. Falha com motivo legível em vez de iniciar.
- **Guardrail duplo no worker**: antes de chamar `uazapi-proxy`, revalida limites, janela, jitter, bloco/pausa e rotação com os valores atuais do banco (não com os lidos no enfileiramento). Se qualquer regra falhar, o item volta para a fila com novo `available_at` sem consumir tentativa.
- **Rotação obrigatória** para canal não oficial: se só houver uma fila elegível e o volume passar do limite diário dela, o start é bloqueado com aviso ("volume acima da capacidade das filas selecionadas").
- **Modo simulação**: `dsp-campaign-prepare` ganha `dry_run`, que roda elegibilidade + supressão + frequência e devolve o relatório sem gravar `dsp_recipients`/`dsp_message_queue`.

## Detalhes técnicos

Novos arquivos, todos dentro de `src/modules/disparos/`:

- `module.ts` — metadados e itens de menu (code `campaigns_dispatch`, rota `/disparos`, ícone `Send`, grupo `AGENTES DA JULIA`).
- `extend/` — única porta de entrada para recursos da Julia: `db.ts` (`supabase`, `externalDb`), `auth.ts` (`useAuth`, `isOwner`, `resolveEffectiveClientId`), `queues.ts` (filas + status de conexão), `chat.ts` (contatos, tags, variáveis), `phone.ts` (normalização E.164), `useEnsureDisparosModule.ts`.
- `hooks/` — `useDspCampaigns`, `useDspCampaignControl`, `useDspSimulation`, `useDspMonitor`, `useDspLogs`, `useDspSuppression`, `useDspChannelLimits`.
- `pages/DisparosPage.tsx` — casca com as 6 abas (aba na querystring para deep-link).
- `components/` — um componente por aba mais o diálogo de campanha e o editor de limites por fila.

Alterações fora da pasta: apenas o lazy import e a rota protegida em `App.tsx` (`<ProtectedRoute module="campaigns_dispatch">`), e ajustes nas edge functions `dsp-campaign-prepare` (`dry_run`) e `dsp-campaign-control` (validações de start/resume).

Monitoramento usa React Query com polling curto (10s) nas abas de monitoramento/logs; sem realtime nesta fase. Toda leitura filtra por `client_id` efetivo.
