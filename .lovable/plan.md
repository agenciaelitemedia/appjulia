# Disparos — criar card no CRM Builder ao disparar

## O que muda para o usuário

No passo 1 da criação/edição da campanha, uma nova opção **"Criar card no CRM Builder"**:

- Desligada por padrão (campanhas atuais continuam iguais).
- Ao ligar, aparece a lista de **painéis** do escritório e, depois de escolher o painel, a lista de **etapas** daquele painel.
- Um seletor opcional de **responsável** do card (padrão: sem responsável).

Quando a mensagem for enviada com sucesso, o lead entra automaticamente como card no painel/etapa escolhidos.

## Regras de criação

Para cada destinatário enviado com sucesso:

1. **Contato**: procura contato do mesmo escritório pelo telefone (comparação pelos últimos 8 dígitos, com as variantes do 9º dígito). Se existir, usa o contato existente; se não, cria um novo contato do escritório com nome e telefone do destinatário.
2. **Card**: cria o card no painel/etapa escolhidos, no fim da coluna, com título = nome do lead (ou telefone), telefone e nome de contato preenchidos, e registro no histórico do card como criado pela campanha.
3. **Sem duplicar**: se já existir card ativo desse telefone no mesmo painel, nada é criado — o card existente é reaproveitado.
4. Tudo sempre filtrado pelo escritório (client_id) da campanha; nunca cruza escritórios.
5. Falha ao criar contato ou card **não** derruba o disparo: o envio continua contando como enviado e o erro fica registrado nos logs da campanha.

## Detalhes técnicos

**Banco** (uma migração, colunas novas em `dsp_campaigns`, todas opcionais):
- `crm_push_enabled boolean not null default false`
- `crm_board_id uuid`, `crm_pipeline_id uuid`
- `crm_assigned_to text`

**Backend** — novo helper `supabase/functions/_shared/dsp-crm-push.ts`:
- `pushRecipientToCrm(admin, campaign, recipient)`.
- Valida que `crm_board_id`/`crm_pipeline_id` pertencem ao `client_id` da campanha e que a etapa é do painel e está ativa; `cod_agent` do card vem do painel.
- Resolve contato em `chat_contacts` via `normalizeBrPhone` + variantes (mesmo padrão de `phoneVariants` já usado no worker); cria com `client_id`, `phone`, `name`, `channel_type` quando não achar.
- Antiduplicidade de card: consulta `crm_deals` por `client_id` + `board_id` + `contact_phone` nas variantes, status ativo.
- Insere em `crm_deals` (`position` = último + 1, `stage_entered_at` = agora, `created_by` = `dsp:<campaign_id>`) e grava `crm_deal_history` com action `created`.

**Worker** — `supabase/functions/dsp-campaign-worker/index.ts`: após o bloco de `send.ok` (linhas 236–258), chamada `await pushRecipientToCrm(...)` dentro de try/catch, só quando `campaign.crm_push_enabled`. Erro é gravado em `dsp_message_events`/log e ignorado.

**Frontend**:
- `src/modules/disparos/types.ts` — novos campos em `DspCampaign`.
- `src/modules/disparos/components/CampaignWizardDialog.tsx` — switch + selects de painel/etapa/responsável no passo 1, persistidos no salvamento; reutiliza `useDspBoards`/`useDspPipelines` de `hooks/useDspAudienceOptions.ts` (já existem e já filtram por client_id).
- `src/modules/disparos/components/CampaignsTab.tsx` — badge "CRM: <painel> / <etapa>" no card da campanha quando ligado.

Nenhuma alteração em envio, limites, supressão, janela ou rotação.
