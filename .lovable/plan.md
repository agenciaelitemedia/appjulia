## Objetivo

Na aba **Configurações** de `/admin/telefonia`, ao criar/editar uma configuração de cliente:

1. Trocar o seletor "Provedor" (que hoje é só **api4com / 3C+**) por um seletor com a **lista dos provedores cadastrados na aba Provedores** (ex: `TePABX`, `JuPABX_00`).
2. Ao selecionar um provedor, **auto-preencher** todos os campos (token, domínio API, SIP, WSS, base URL etc.) com os dados daquele provedor — usuário só edita se quiser override.
3. Na **listagem** da aba Configurações, exibir o **nome do provedor** (TePABX, JuPABX_00) no lugar do badge "Api4Com"/"3C+".

Sem alterar nada do que já funciona (webhooks, save, delete, fluxo de busca de cliente, máscaras de token, etc.).

## Mudanças

### 1. Banco — nova coluna `provider_id` em `phone_config`

Migration:
- `ALTER TABLE public.phone_config ADD COLUMN provider_id uuid REFERENCES public.telephony_providers(id) ON DELETE SET NULL;`
- Index `idx_phone_config_provider_id`.

Nada destrutivo: coluna nullable, configurações existentes continuam funcionando (fallback para `provider` + campos inline).

### 2. Hook `useTelefoniaAdmin` (configs)

- Adicionar `provider_id` no tipo `PhoneConfig` (em `types.ts`).
- No `saveConfig`, persistir `provider_id` junto com os demais campos.
- Na query de listagem das configs, fazer um lookup batch em `telephony_providers` (id, name, provider) e anexar `provider_name` ao objeto retornado (igual ao que já faz com `client_name`).

### 3. `ConfigTab.tsx` — formulário Novo/Editar

- Importar `useTelephonyProviders`.
- Substituir o `<Select>` "Provedor" (que hoje tem só "Api4Com" e "3C+") por um Select com `providers.map(p => <SelectItem value={p.id}>{p.name} <Badge>{tipo}</Badge></SelectItem>)`.
- Estado novo: `selectedProviderId`.
- Ao escolher um provider:
  - Setar `provider` ← `p.provider` (api4com|3cplus) — mantém compatibilidade dos campos atuais.
  - Pré-popular: `domain`, `sipDomain`, `token`, `threecToken`, `threecBaseUrl`, `threecWsUrl` a partir do provider.
- Manter os campos editáveis (override por cliente continua possível, exatamente como hoje).
- No `openEdit(cfg)`, inicializar `selectedProviderId = cfg.provider_id`.
- No `handleSave`, incluir `provider_id: selectedProviderId` no payload.
- `isFormValid()`: passa a exigir `selectedProviderId` (em vez de checar token/domain manualmente — mas mantém check para garantir que os campos derivados não estão vazios).

### 4. `ConfigTab.tsx` — Tabela de configurações

- Renomear coluna "Provedor" para mostrar:
  - `cfg.provider_name` (do provider vinculado) — ex: **TePABX**, **JuPABX_00**.
  - Fallback: `PROVIDER_LABELS[cfg.provider]` quando `provider_id` for nulo (configs legadas).
- Badge variant continua diferenciando por tipo (`api4com` vs `3cplus`).

### 5. Não mexer

- `ProvidersTab`, `ProviderDialog`, `useTelephonyProviders`: ficam intactos.
- Webhooks, deleção, busca de cliente: intactos.
- Edge functions de discagem (que leem `phone_config` por `cod_agent`/`client_id`): intactas — continuam lendo os mesmos campos inline.

## Pós-implementação

Após o merge, o usuário fará a **edição manual** das configurações já cadastradas para vincular cada uma ao provedor correspondente (TePABX, JuPABX_00, etc.), conforme combinado.

## Arquivos tocados

- `supabase/migrations/<novo>.sql` (add column)
- `src/pages/admin/telefonia/types.ts` (campo `provider_id` no `PhoneConfig`)
- `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts` (persistir + enriquecer com `provider_name`)
- `src/pages/admin/telefonia/components/ConfigTab.tsx` (seletor, auto-fill, badge com nome)
