## Objetivo

Permitir vincular cada dispositivo Wavoip a uma ou mais filas. Ao abrir o diálogo de ligação Wavoip a partir do chat, o dispositivo pré-selecionado será aquele vinculado à fila da conversa (quando existir).

## Alterações

### 1. Banco (nova tabela `wavoip_device_queues`)

Tabela N:N entre `wavoip_devices` e `queues`:

- `device_id uuid` → `wavoip_devices.id` (ON DELETE CASCADE)
- `queue_id uuid` → `queues.id` (ON DELETE CASCADE)
- `client_id bigint` (para RLS/scoping)
- `created_at`, `created_by bigint`
- PK composta `(device_id, queue_id)`
- Índices em `queue_id` e `device_id`
- RLS: `authenticated` pode ler/escrever quando o dispositivo pertencer ao mesmo `client_id`; `service_role` full
- GRANTs padrão para `authenticated` e `service_role`

### 2. `/wavoip` — vínculo com filas na UI

Em `src/pages/wavoip/WavoipPage.tsx`:

- **Dialog "Adicionar dispositivo"**: adicionar campo multi-seleção "Filas vinculadas" (usando filas ativas do client). Ao criar o dispositivo, gravar em `wavoip_device_queues`.
- **Novo botão "Filas" em cada card de dispositivo** (ao lado de renomear/compartilhar, restrito ao owner): abre um dialog `DeviceQueuesDialog` para editar as filas vinculadas.
- Mostrar badge `Fila: <nome>` (ou "N filas") no card do dispositivo.

Novo componente `src/pages/wavoip/components/DeviceQueuesDialog.tsx` com multi-select shadcn (checkbox list) das filas do client. Salva via upsert/delete diff em `wavoip_device_queues`.

Novo hook `src/pages/wavoip/hooks/useWavoipDeviceQueues.ts`:
- `useDeviceQueues(deviceId)` → lista de queue_ids do dispositivo
- `useAllDeviceQueueLinks(clientId)` → mapa `queueId → deviceId[]` (para o dialog do chat)
- mutations `linkDeviceQueues`, `unlinkDeviceQueue`

### 3. Chat — pré-seleção do dispositivo pela fila

Em `src/components/chat/WavoipCallDialog.tsx`:
- Aceitar nova prop opcional `queueId?: string | null`.
- Consultar `wavoip_device_queues` (via `useAllDeviceQueueLinks` ou query pontual) para descobrir os `device_id` vinculados à `queueId`.
- Ao abrir o diálogo, se algum dispositivo **conectado** estiver vinculado à fila, pré-selecioná-lo (em vez do primeiro conectado). Caso contrário, manter o comportamento atual (primeiro conectado).
- Mostrar uma linha discreta acima do select do tipo: "Sugerido pela fila <nome>" quando aplicável.

Em `src/components/chat/WavoipCallButton.tsx`:
- Aceitar `queueId?: string | null` e repassar ao dialog.

Em `src/components/chat/ChatHeader.tsx`:
- Passar `queueId={selectedConversation?.queue_id}` no `<WavoipCallButton>`.

## Escopo intencionalmente fora

- Nenhuma mudança no comportamento de discagem em si (SDK Wavoip, roteamento, chamadas).
- Nenhuma alteração em `wavoip_device_members` — vínculo com fila é ortogonal ao compartilhamento com usuários.
- Sem impacto no admin (`/admin/wavoip`) — vínculo é gerido pelo owner do dispositivo.
