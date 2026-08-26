# Canais de Disparo — tela dedicada

Hoje toda fila ativa do escritório aparece dentro de "Configurações" e é implicitamente elegível para disparo. A proposta cria uma tela própria de **Canais**, onde cada fila é explicitamente habilitada (opt-in) como canal de disparo, com peso de rotação, saúde e limites anti-bloqueio.

## O que muda para o usuário

Nova aba **Canais** no módulo Disparos (antes de Configurações):

1. **Lista de canais disponíveis** — todas as filas do escritório, com nome, número, tipo (API oficial / não oficial) e situação da conexão.
2. **Habilitar para disparo** — botão "Usar em Disparos". Enquanto a fila não é habilitada, ela não pode ser usada em nenhuma campanha.
3. **Cartão do canal habilitado** com:
   - peso de rotação (quanto mais alto, mais mensagens recebe);
   - saúde: saudável / em cooldown / desconectado, com contadores da janela (enviadas hoje/hora/minuto) e botão "Liberar canal" quando estiver em cooldown;
   - limites e delays (por minuto/hora/dia, intervalo mínimo e máximo, tamanho de bloco, pausa entre blocos, rampa diária, cooldown pós-desconexão, janela de horário, permitir marketing) — os mesmos campos que hoje ficam em Configurações, com os guardrails da API não oficial;
   - "Restaurar padrão seguro" e "Remover dos disparos".
4. **Alerta de risco** para filas não oficiais, reforçando os mínimos obrigatórios (>= 5s entre mensagens, pausa de bloco >= 30s, teto de 10/min e 1000/dia).

A aba **Configurações** deixa de listar limites por fila e passa a ser só o ajuste geral do módulo (padrões sugeridos para novos canais, janela padrão, categoria padrão e link para a tela de Canais).

No **assistente de campanha**, o seletor de canais passa a mostrar apenas canais habilitados; se nenhum estiver habilitado, exibe aviso com atalho para a aba Canais. O start/agendamento continua bloqueado quando nenhum canal válido/saudável estiver disponível.

## Detalhes técnicos

**Banco (migração)** — em `public.dsp_channel_limits`:
- `is_enabled boolean not null default true` (opt-in explícito; registros existentes continuam habilitados);
- `default_weight integer not null default 1`;
- `notes text null`.
GRANTs/RLS já existentes permanecem; nenhuma tabela nova.

**Backend**
- `supabase/functions/_shared/dsp-core.ts`: a seleção/rotação de canais passa a exigir `is_enabled = true` e usa `default_weight` como peso base quando a campanha não define peso próprio.
- `dsp-campaign-prepare` e `dsp-campaign-control`: a validação de canais (capacidade estimada e guardrail de start/schedule) considera apenas canais habilitados; mensagem de erro clara quando a fila escolhida não está habilitada.
- Redeploy das funções afetadas.

**Frontend (arquivos do módulo, isolados)**
- Novo `src/modules/disparos/components/ChannelsTab.tsx` (lista + cartões) e `src/modules/disparos/components/ChannelLimitsCard.tsx` (extraído de `SettingsTab.tsx`, sem duplicar lógica).
- Novo `src/modules/disparos/hooks/useDspChannels.ts`: habilitar/desabilitar canal, salvar peso, reaproveitando `useSaveDspLimits`, `useClearChannelCooldown`, `useDspChannelLimits` e `useDspChannelStates`.
- `SettingsTab.tsx`: reduzido às configurações gerais.
- `DisparosPage.tsx`: registra a aba "Canais" (ícone Radio/Antenna) com o mesmo gate de permissão de edição.
- `CampaignWizardDialog.tsx`: filtra canais habilitados e mostra o estado vazio com atalho.
- `types.ts`: novos campos em `DspChannelLimits`.

Sem alterações na tela de filas (`/agente/filas`) — a habilitação é feita a partir do módulo Disparos.
