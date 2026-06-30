## Módulo Wavoip — Chamadas de voz WhatsApp (admin + cliente)

Integração será entregue como um **módulo completo do sistema**, espelhando o padrão de Telefonia: um módulo administrativo (`Wavoip (Admin)`) para o time interno provisionar/gerenciar planos e ativar o serviço por cliente, e um módulo de usuário (`Wavoip` / chamada embutida no chat) para o cliente final efetuar e receber chamadas.

---

### 1. Registro do módulo (padrão Telefonia)

Criar `src/hooks/useEnsureWavoipModule.ts` (espelho de `useEnsureTelefoniaModule.ts`) que registra dois módulos via `externalDb`:

- **`wavoip_admin`** — `name: "Wavoip (Admin)"`, `route: /admin/wavoip`, `menu_group: ADMINISTRATIVO`, icon `PhoneCall`.
- **`wavoip`** — `name: "Wavoip"`, `route: /wavoip`, `menu_group: SISTEMA`, icon `PhoneCall`.

Chamar o hook em `App.tsx` junto aos outros `useEnsure*Module`. Proteção das rotas: `AdminRoute` para `/admin/wavoip`; `ProtectedRoute` com permissão `wavoip:access` para `/wavoip` e botão de chamada no chat.

---

### 2. Backend — schema e edge functions

**Migrations (estilo telefonia):**

- `wavoip_plans` — planos comercializáveis (nome, descrição, preço, limite de dispositivos, ativo).
- `wavoip_orders` — pedidos/assinaturas por cliente (client_id, plan_id, status, period_start/end, provider_payment_ref).
- `wavoip_user_plans` — vínculo plano ↔ cliente ativo (espelha `phone_user_plans`).
- `wavoip_devices` — dispositivos Wavoip provisionados (client_id, queue_id, device_uuid, device_id, token, status, last_seen_at).
- `wavoip_call_logs` — chamadas (client_id, user_id, conversation_id, contact_phone, direction, status, started_at, ended_at, duration_seconds, call_id_wavoip).
- `wavoip_config` (global, 1 linha) — `api_base_url`, flags de operação.

Todas seguindo o padrão de GRANTs e RLS já adotado (acesso por `client_id` para `authenticated`, full para `service_role`).

**Edge Functions:**

- `wavoip-provision-device` — chama `POST /api/wavoip/provision-device` da Wavoip e grava em `wavoip_devices`.
- `wavoip-device-status` — consulta status do dispositivo na Wavoip.
- `wavoip-remove-device` — remove dispositivo via Wavoip e marca como removido.
- `wavoip-log-call` — recebe eventos do front e grava em `wavoip_call_logs`.

Secret necessário: `WAVOIP_API_KEY` (será solicitado após aprovação do plano).

---

### 3. Painel `Wavoip (Admin)` — `/admin/wavoip`

Página `src/pages/admin/wavoip/WavoipAdminPage.tsx` com tabs no padrão `TelefoniaAdminPage`:

- **Clientes** — lista de clientes com toggle "Ativar Wavoip", quantidade de dispositivos provisionados, plano vinculado e ações (ativar/desativar, abrir detalhes).
- **Planos** — CRUD de `wavoip_plans` (mesmo padrão de `PlansTab` da telefonia).
- **Pedidos** — listagem de `wavoip_orders` com filtros por status e cliente.
- **Dispositivos** — visão global de todos `wavoip_devices` com status (ativo/inativo/expirado), botão de re-provisionar e remover.
- **Configuração** — `api_base_url`, link para definir `WAVOIP_API_KEY` (via tela de secrets) e flags globais.
- **Histórico** — `wavoip_call_logs` global, filtros por cliente/usuário/período.

Componentes a criar em `src/pages/admin/wavoip/components/`: `ClientsTab`, `PlansTab`, `OrdersTab`, `DevicesTab`, `ConfigTab`, `HistoryTab`.

---

### 4. Página do usuário `/wavoip`

Página `src/pages/wavoip/WavoipPage.tsx` no padrão `TelefoniaPage` com tabs:

- **Meus Dispositivos** — dispositivos da fila vinculada ao usuário, status online/offline, botão "Provisionar".
- **Discador** — discador standalone usando o webphone Wavoip.
- **Histórico** — chamadas do usuário (`wavoip_call_logs`).
- **Relatórios** — totais por dia, duração média, recebidas/efetuadas.

Bloqueio: se o cliente não tem plano ativo (`wavoip_user_plans`), mostrar tela "Serviço não contratado".

---

### 5. Webphone embutido no chat (entrega da feature ao usuário final)

- Instalar `@wavoip/wavoip-webphone`.
- Criar `src/contexts/WavoipContext.tsx`: inicializa `webphone.render(...)` uma vez, registra dispositivos do cliente via `window.wavoip.device.add(token, true)`, expõe `startCall`, `acceptOffer`, `rejectOffer`, `activeCall`, `offers` e escuta `onOffer`.
- Adicionar `WavoipProvider` em `App.tsx` somente quando o cliente possui plano ativo (lazy gate).
- Em `src/components/chat/ChatHeader.tsx`, adicionar botão "Chamada WA" ao lado do botão "Ligar" atual; clique abre `WavoipCallPanel` (padrão `createPortal` fixed right, igual a `ChatTicketSidePanel`).
- Chamadas recebidas: toast com "Atender / Recusar". Se o número existir em `chat_contacts`, abrir a conversa correspondente ao atender.
- Cada evento de chamada (`started`, `answered`, `ended`, `missed`) chama `wavoip-log-call` para gravar em `wavoip_call_logs`.

---

### 6. Permissões

Adicionar entradas em `src/types/permissions.ts`:

- `wavoip:access` — usar o webphone no chat e acessar `/wavoip`.
- `wavoip:admin` — acessar `/admin/wavoip` (já coberto por `AdminRoute`, mas mantém granularidade).

---

### 7. Fora do escopo inicial

- Chamadas de vídeo (Wavoip Webphone foca em áudio).
- Substituição do SIP/Api4Com/3C+ existente — Wavoip é canal paralelo.
- Cobrança automática (pode ser plugada depois nos mesmos fluxos de `julia_orders`/MercadoPago já usados pela telefonia).

### 8. Pré-requisitos

- `WAVOIP_API_KEY` (solicitado via secret após aprovação).
- Cada fila/cliente com dispositivos provisionados pelo admin antes do uso.

### Technical details

- Webphone: `await webphone.render({ theme: "system", widget: { showWidgetButton: false } })`.
- Registrar dispositivo: `await window.wavoip.device.add(token, true)`.
- Chamada de saída: `await window.wavoip.call.start(phone, { fromTokens: [token], displayName })`.
- Chamada recebida: `window.wavoip.call.onOffer(handler)`.
- Provisionamento via `POST /api/wavoip/provision-device` (dispositivo gratuito).