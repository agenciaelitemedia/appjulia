# Padrões seguros por tipo de API (global) + Canais só como vínculo

Hoje cada canal habilitado carrega sua própria cópia de limites/delays, editável canal por canal. A proposta inverte isso: os limites passam a ser **dois perfis globais do escritório** — um para API oficial (Meta Cloud) e um para API não oficial (UaZapi) — definidos na aba **Configurações** e seguidos automaticamente por todos os canais.

## O que muda para o usuário

**Aba Configurações** deixa de ser só informativa e passa a ter dois cartões editáveis:

- **API não oficial (UaZapi)** e **API oficial (Meta Cloud)**, cada um com: mensagens por minuto/hora/dia, destinatários únicos/dia, intervalo mínimo e máximo entre mensagens, tamanho do bloco, pausa entre blocos, rampa diária, falhas consecutivas, cooldown pós-desconexão, janela de horário e permitir marketing.
- Botões "Salvar" e "Restaurar padrão seguro" por perfil.
- Guardrails mantidos para a API não oficial (>= 5s entre mensagens, pausa de bloco >= 30s, teto de 10/min e 1000/dia) — bloqueiam o salvamento com mensagem clara.
- Aviso de que a mudança vale imediatamente para todos os canais habilitados daquele tipo.

**Aba Canais** vira apenas o vínculo:

- lista das filas do escritório com nome, número, tipo de API e situação;
- botão "Usar em Disparos" / "Remover dos disparos";
- peso de rotação do canal (isso é do canal, não do perfil) e saúde (enviadas hoje/hora/minuto, cooldown, "Liberar canal");
- resumo somente-leitura dos limites herdados do perfil, com atalho para Configurações.

Sem edição de limites por canal.

## Detalhes técnicos

**Banco (migração)**
- Nova tabela `public.dsp_provider_defaults`: `client_id text`, `provider text` (`uazapi` | `meta_cloud`), todos os campos de limite/janela hoje presentes em `dsp_channel_limits`, `created_at/updated_at` + trigger, `unique (client_id, provider)`.
- GRANTs (`authenticated`, `service_role`), RLS habilitada com política no mesmo padrão permissivo das demais tabelas `dsp_*`.
- Seed por escritório na primeira leitura (upsert no app/backend com os defaults seguros atuais).
- `dsp_channel_limits` é preservada, mas passa a servir só como registro de vínculo: `is_enabled`, `default_weight`, `notes`, `provider`. As colunas de limite continuam existindo (compatibilidade) e param de ser lidas pelo motor.

**Backend**
- `_shared/dsp-core.ts`: novo `loadProviderDefaults(admin, clientId, provider)` com cache por execução; `loadChannel` monta `limits` a partir do perfil do provider, sobrepondo apenas `is_enabled`/`default_weight` do vínculo. `canSendNow` e `effectiveDailyLimit` seguem iguais (recebem o objeto resolvido).
- `dsp-campaign-prepare` (capacidade estimada) e `dsp-campaign-control` (guardrail de start/schedule) passam a usar os limites resolvidos pelo perfil, mantendo a exigência de `is_enabled = true`.
- Redeploy de `dsp-campaign-worker`, `dsp-campaign-prepare`, `dsp-campaign-control`, `dsp-campaign-scheduler`.

**Frontend (isolado no módulo)**
- Novo `hooks/useDspProviderDefaults.ts`: leitura/upsert dos dois perfis, reaproveitando `validateLimits` de `useDspLimits.ts`.
- Novo `components/ProviderDefaultsCard.tsx` (formulário de um perfil) usado duas vezes em `SettingsTab.tsx`.
- `ChannelLimitsCard.tsx` reduzido a vínculo + peso + saúde + resumo somente-leitura.
- `useDspChannels.ts`: insere/atualiza apenas `is_enabled`, `default_weight`, `provider` (sem copiar limites).
- `types.ts`: novo `DspProviderDefaults`; limites em `DspChannelLimits` marcados como legado.
- `useDspLimits.ts`: `useSaveDspLimits` deixa de ser usado pela UI de canais (permanece só a validação e `useClearChannelCooldown`).
