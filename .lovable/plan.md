

## Objetivo
Tornar a "API Oficial Meta (WABA)" um **provedor sempre disponível** (não exige registro prévio em Configurações → Provedores). A vinculação da conta Meta do cliente (Embedded Signup) passa a acontecer **dentro do wizard de criação da fila**. UaZapi, Instagram e WebChat continuam funcionando exatamente como hoje.

## Diagnóstico
- Hoje, no Wizard (Step 2), o WABA exige um registro em `queue_providers` com `provider_type='waba'` contendo `waba_business_id` + `waba_token`. Sem isso, o usuário precisa ir em Configurações.
- O App ID/Secret da Meta já são globais (configurados em Configurações + envs `VITE_META_APP_ID`/`VITE_META_CONFIG_ID`). Logo, o "provedor WABA" não precisa de registro por cliente — basta o usuário fazer Embedded Signup uma vez **no momento da fila**, e os tokens (`waba_business_id` + `waba_token` + `waba_number_id`) ficam armazenados **na própria fila** (`queues.waba_id` / `queues.waba_token` / `queues.waba_number_id` — colunas que já existem).
- O `WabaEmbeddedSignupButton` já retorna `{ accessToken, wabaBusinessId, phoneNumberId }`. A função `waba-admin` action `list_phone_numbers` já existe.

## Mudanças

### 1. Wizard de Nova Fila (`QueueWizardDialog.tsx`)
**Step 2 — caminho WABA passa a ser self-contained:**
- Remover a dependência de `queue_providers` para o tipo `waba`.
- Quando `selectedType === 'waba'`, mostrar diretamente:
  - Estado A (sem token na sessão do wizard): texto explicativo + botão `WabaEmbeddedSignupButton` ("Conectar conta Meta agora").
  - Estado B (após signup): mostrar Business ID conectado + lista de Phone Numbers (`list_phone_numbers`) + botão "Testar conexão" (já existem). Permitir trocar a conta com botão "Reconectar".
- Guardar localmente no state do wizard: `wabaAccessToken`, `wabaBusinessId`, `wabaPhoneNumberId` (sem persistir em `queue_providers`).
- Remover o auto-criar registro em `queue_providers` (`handleQuickCreateWabaProvider`).
- `canGoStep3` para WABA: `!!wabaAccessToken && !!wabaBusinessId && !!wabaPhoneNumberId`.

**Step 3 — submit:**
- Para WABA, popular `formData` direto a partir do state local:
  ```ts
  formData.waba_id = wabaBusinessId;
  formData.waba_token = wabaAccessToken;
  formData.waba_number_id = wabaPhoneNumberId;
  ```
- UaZapi e Instagram continuam usando `selectedProvider` de `queue_providers`. WebChat inalterado.

**Step 1 — card WABA:**
- Trocar a badge de "Provedor configurado / Sem provedor" por uma badge fixa **"Disponível"** (ou "Conecte ao criar"), já que não depende mais de registro prévio.

### 2. Configurações → Provedores de Fila (`ProviderFormDialog.tsx`)
- **Remover a opção `waba` do `providerTypeOptions`** (a configuração de WABA por fila não passa mais por aqui).
- Manter o resto intacto (UaZapi, WebChat, Instagram).
- **Não apagar** registros existentes de `queue_providers` com `provider_type='waba'` — o wizard simplesmente não os usa mais, e ficam ignorados (zero impacto). Os dados já salvos em filas existentes (`queues.waba_*`) continuam funcionando.

### 3. Compatibilidade
- Filas WABA já criadas: continuam funcionando (lêem de `queues.waba_*`, não dependem de `queue_providers`).
- Edge functions (`waba-send`, `meta-webhook`, `waba-admin`): **nenhuma mudança** — já leem credenciais a partir da fila.
- UaZapi, Instagram, WebChat: **nenhuma mudança comportamental**.

## Arquivos a editar
- `src/pages/agente/filas/components/QueueWizardDialog.tsx` — refazer ramo WABA do Step 2; remover `handleQuickCreateWabaProvider`; ajustar badge no Step 1; usar state local no submit.
- `src/pages/configuracoes/components/ProviderFormDialog.tsx` — remover `waba` de `providerTypeOptions`.

## Resultado esperado
- Em **Configurações → Provedores de Fila**, a opção "API Oficial Meta (WABA)" não aparece mais como tipo a cadastrar.
- No **Wizard de Nova Fila**, ao escolher "API Oficial (WABA)", o próprio wizard mostra o botão de Embedded Signup; após login, lista os números, permite testar e cria a fila — tudo em um só fluxo.
- Filas existentes (UaZapi, WABA já criadas, Instagram, WebChat) continuam intactas.

