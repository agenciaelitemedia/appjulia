## Refatorar gestão de dispositivos Wavoip

Reorganizar o ciclo de vida do dispositivo Wavoip: cadastro centralizado no admin (pool de tokens livres), alocação automática ao ativar plano de cliente, e UI do dono do escritório só nomeia/conecta.

### 1. Schema (migração)
- `wavoip_devices`: adicionar
  - `friendly_code text` (sufixo XXXX único do nome `WAPhone_XXXX`)
  - `connection_status text default 'disconnected'` (`disconnected | connecting | connected | error`)
  - `connected_at timestamptz`
  - `whatsapp_jids jsonb default '[]'` (números conectados retornados pela API)
- `status` passa a ter semântica clara: `free` (sem `client_id`) | `in_use` (com `client_id`). Backfill: linhas com `client_id` → `in_use`; sem → `free`.
- Constraint opcional: `friendly_code` único.

### 2. Admin `/admin/wavoip` → aba "Dispositivos"
Tornar a aba a única origem de cadastro de tokens:
- Botão "Cadastrar dispositivo" → dialog pede só **token Wavoip**.
- Ao salvar: gera `friendly_code` (4 chars `[A-Z0-9]` únicos no banco, retry em colisão), `device_name = 'WAPhone_' + code`, `status='free'`, sem `client_id`/`user_id`.
- Tabela mostra: Nome, Token (mascarado), Status (`Livre`/`Em uso`), Cliente vinculado, Conexão, Última vez visto, ação remover (bloqueada se `in_use`).

### 3. Admin → ativar cliente (`AddWavoipDialog`)
- Após escolher plano, mostrar seletor múltiplo de **dispositivos livres** (no máximo `plan.max_devices + extra_devices`). Lista vem de `wavoip_devices where status='free'`.
- Validação: precisa selecionar exatamente `max_devices + extra_devices` (ou aceitar até esse limite; vamos exigir o limite cheio para evitar confusão — ajustar conforme feedback).
- Ao confirmar (hook `useActivateWavoipForUser`): cria `wavoip_user_plans` e em transação marca dispositivos selecionados como `status='in_use'`, `client_id=<cliente>`, `user_plan_id=<novo>`.
- Ao desativar plano: dispositivos voltam a `status='free'`, limpam `client_id`/`user_plan_id`/`user_id`/`connection_status`.

### 4. Usuário dono `/wavoip`
- Remover input de token e botão "Provisionar automático".
- Botão "Adicionar dispositivo" → dialog pede só **nome amigável**.
- Lógica: pega o primeiro `wavoip_devices` do `client_id` ainda sem `user_id` (não atribuído a um usuário do escritório), seta `user_id = auth.user.id` e `device_name = <nome digitado>` (mantendo `friendly_code` interno como backup).
- Após salvar, dispara `wavoip-connect-device` (nova edge function) que chama a API Wavoip para conectar o token; persiste `connection_status='connecting'` → `connected` + `whatsapp_jids` retornados, ou `error`.
- Discador só habilita quando existir ao menos um device do usuário com `connection_status='connected'`.
- Lista de dispositivos exibe badge de conexão e os números conectados.

### 5. `WavoipContext`
- `hasActivePlan` continua via `wavoip_user_plans`.
- Tokens injetados no webphone só de devices com `connection_status='connected'` do `client_id`/`user.id`.
- Expor `connectedNumbers: string[]` e `canDial = ready && connectedNumbers.length > 0`. `WavoipCallButton` usa `canDial` para habilitar.

### 6. Edge functions
- Nova `wavoip-connect-device`: recebe `device_id`, busca token, chama API Wavoip de conexão, atualiza `connection_status`, `whatsapp_jids`, `connected_at`, `last_seen_at`.
- `wavoip-provision-device`: mantida apenas para uso interno do admin (opcional cadastrar token novo gerado), não exposta na UI do usuário.

### Detalhes técnicos
- Geração de `friendly_code`: loop client-side com `crypto.getRandomValues` + checagem `select count where friendly_code=?`; em até 5 tentativas. Mover para função SQL `gen_wavoip_friendly_code()` para garantir unicidade atômica.
- Hooks novos: `useFreeWavoipDevices`, `useAssignDevicesToPlan`, `useReleaseDevicesFromPlan`, `useClaimWavoipDevice` (usuário do escritório), `useConnectWavoipDevice`.
- Atualizar `useActivateWavoipForUser` para aceitar `device_ids: string[]` e `useDeactivateWavoipUserPlan`/`useToggleWavoipUserPlanActive` para liberar dispositivos.
- `WavoipDevicesTab.tsx` reescrita conforme item 2.

### Fora de escopo
- Webhook de status de conexão em tempo real (pode ser adicionado depois; por ora consulta sob demanda + botão "Reconectar").
