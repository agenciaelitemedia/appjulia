## Objetivo
Reformular o fluxo de ativação Wavoip para clientes: o plano define modelo de dispositivo + provedor, e a ativação cria o dispositivo automaticamente via API Wavoip (`/v2/sales/buy-device` + `/devices/:id`), vinculando ao cliente.

## Limpeza inicial (dados)
- Truncar `wavoip_devices`, `wavoip_user_plans` e (via cascade/manual) `wavoip_orders`. Preservar `wavoip_plans` e `wavoip_providers`.

## Alterações de schema (migration)
1. `wavoip_plans`:
   - `provider_id uuid REFERENCES wavoip_providers(id) ON DELETE RESTRICT` (obrigatório em novos planos).
   - Manter `device_model` mas passar a derivá-lo do `wavoip_providers.type` do provedor selecionado (`wavoip_free` → `free`, `wavoip_multicanal` → `paid`).
2. `wavoip_devices`:
   - `wavoip_device_id bigint` (id retornado pela API Wavoip).
   - `wavoip_raw jsonb` (retorno completo de `/devices/:device_id`).
   - `provider_id uuid REFERENCES wavoip_providers(id)`.
   - Manter `device_name`, `device_token`, `client_id`, `user_plan_id`.

## Backend — nova edge function `wavoip-device-provision`
Ação única: cria dispositivo na Wavoip a partir de `{ provider_id, plan_id, client_id, device_name, channels }`.
Fluxo:
1. Carrega provedor (JWT via `get_token`, refresca se preciso).
2. Determina body:
   - Free (`type = wavoip_free`): `{ type: "FREE", name: "JU_<clientId>_<device_name>" }` (Wavoip Free aceita name; se ignorado, apenas ok).
   - Paid (`type = wavoip_multicanal`): `{ type: "PAID", deviceProps: [{ name: "JU_<clientId>_<device_name>", channels, count: 1 }] }`.
3. `POST {api_base}/v2/sales/buy-device` com `Authorization: Bearer <token>` → extrai `data.deviceId`.
4. `GET {api_base}/devices/{deviceId}` → pega `result[0]` (contém `token`, `phone`, `id_server`, etc.).
5. Insere em `wavoip_devices`: `provider_id`, `client_id`, `user_plan_id`, `device_name`, `device_token = result.token`, `wavoip_device_id = result.id`, `wavoip_raw = result`, `status = 'in_use'`.
6. Retorna o device criado. Timeouts com AbortController e mensagens de erro claras (mesmo padrão do `wavoip-providers`).

## Backend — ajustar edge function existente
`wavoip-connect-device` (usada para conectar/QR) deve continuar funcionando lendo `device_token` gravado nesse fluxo — validar que já usa `device_token`.

## Frontend

### `WavoipPlansTab.tsx`
- Adicionar dropdown **Provedor** (query `wavoip_providers` ativos) — obrigatório.
- Remover input livre de `device_model`; passa a ser derivado do provedor (badge visual "Free"/"Pago").
- Enviar `provider_id` no upsert.

### `useWavoipAdmin.ts`
- Estender `WavoipPlan` com `provider_id` e `provider` (join).
- Novo mutation `useProvisionWavoipDevice` que chama `wavoip-device-provision`.
- Ajustar `useActivateWavoipForUser`: após criar `wavoip_user_plans`, para cada dispositivo solicitado chamar `wavoip-device-provision` em loop (não usa mais `assign_wavoip_devices_to_plan` do pool). Se qualquer criação falhar, faz rollback (desativa user_plan) e mostra erro.

### `AddWavoipDialog.tsx`
- Remover seleção de dispositivos do pool.
- Após escolher plano, mostrar **N campos "Nome do dispositivo"** (N = `plan.max_devices + extra_devices`), todos obrigatórios.
- Também exibir o provedor do plano (read-only) para transparência.
- Botão "Confirmar" habilita só quando todos os nomes estão preenchidos.
- Ao confirmar: cria user_plan → provisiona cada device (nome informado + `channels = 1` para free, `channels = extra_devices > 0 ? …` — assumir `channels = 1` por dispositivo já que cada nome = 1 dispositivo).

### `WavoipDevicesTab.tsx`
- Tornar cadastro manual opcional/oculto (a criação agora é automática pelo fluxo de cliente). Manter a tabela em modo read-only mostrando `provider`, `client_id`, `device_name`, `wavoip_device_id`, `device_token` truncado, `connection_status`.

## Validação final
1. Cadastrar plano Free apontando provedor free; cadastrar plano Paid apontando provedor multicanal.
2. Ativar Wavoip para um cliente com 2 dispositivos → confirmar que 2 chamadas a `/v2/sales/buy-device` ocorreram e 2 linhas apareceram em `wavoip_devices` com `wavoip_raw` populado e `device_token` preenchido.
3. Testar `wavoip-connect-device` (QR) e realizar chamada de teste com o token gravado.

## Detalhes técnicos
- `channels` no Paid representa canais simultâneos por dispositivo — mantido em `1` (cada linha da UI = 1 dispositivo). Se no futuro quisermos multi-canal por dispositivo, adiciona um input adicional por linha.
- Nome enviado ao Wavoip: `JU_<clientId>_<nomeInformado>`; na tabela local grava-se apenas `nomeInformado` em `device_name`.
- Nunca expor `password`/`token` do provedor ao frontend — toda comunicação passa por edge function com service role.
- Migration com GRANTs padrão nas colunas novas via `ALTER TABLE` (não recria tabelas).