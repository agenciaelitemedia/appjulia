## Problema

O badge de conexão do dispositivo em `/wavoip` (e o `devicesCount`/`connectedNumbers` usados pelo discador global) leem apenas o campo `wavoip_devices.connection_status` do banco. Esse campo só é atualizado nos cliques de Conectar/Desconectar. Se o WhatsApp do celular perder o vínculo, o Wavoip cair, ou o dispositivo for desconectado por outro lado, o banco continua `connected` e a fila "Flavia 01" aparece conectada indevidamente.

## Solução

Refletir o status real do SDK Wavoip (`wp.device.get()`, campo `status`) tanto na UI quanto no banco, com reconciliação contínua.

### 1. Monitor de status em tempo real (`WavoipContext.tsx`)

- Após o webphone estar pronto, iniciar um `setInterval` (a cada 10s) que:
  - Lê `wp.device.get()` → lista de `{ token, status, ... }`.
  - Para cada dispositivo em `userDevicesRef.current`, mapeia `status` do SDK para `connection_status`:
    - `open` → `connected`
    - `close` / `closed` / ausente → `disconnected`
    - `waiting_qr` / `connecting` → `connecting`
    - `error` / `external_integration_error` / `waiting_payment` → `error`
  - Se o valor do SDK diferir do valor no ref/banco, faz `update` em `wavoip_devices` (`connection_status`, `last_seen_at`, e limpa `connected_at` quando não estiver `open`) e chama `loadPlanAndDevices()` para reatualizar `devicesCount`, `connectedNumbers`, `devices` e `userDevicesRef`.
- Também escutar eventos do SDK que indicam mudança de estado (`device:status`, `device:closed`, `device:opened` — o que existir; usar try/catch por evento) e disparar a mesma reconciliação imediatamente, sem esperar o intervalo.
- Ao desmontar (mudança de user/client), limpar o intervalo.

### 2. UI da página `/wavoip` (`WavoipPage.tsx`)

- Manter um `Map<deviceId, sdkStatus>` em state, alimentado pelo mesmo polling do webphone já disponível (o `ensureWebphone` do contexto).
- Derivar o `connected` do badge a partir do SDK quando disponível; cair no `d.connection_status` só quando o SDK ainda não tiver resposta para aquele token.
- Isso garante que, mesmo antes do banco refletir, a UI já mostre "desconectado" assim que o SDK reportar.
- O botão "Desconectar" (visível só para o owner) continua igual; o botão "Conectar" volta a aparecer automaticamente quando o status real for `disconnected`.

### 3. Discador global

- Como `devicesCount`/`connectedNumbers`/`canDial` são recalculados dentro de `loadPlanAndDevices` (que já filtra por `connection_status = 'connected'`), o passo 1 já basta: assim que o monitor gravar `disconnected`, a próxima reconciliação remove o número dos disponíveis e o discador é bloqueado.

## Detalhes técnicos

- Arquivos alterados: `src/contexts/WavoipContext.tsx`, `src/pages/wavoip/WavoipPage.tsx`.
- Sem migração de banco — apenas `UPDATE` via cliente Supabase nas colunas já existentes (`connection_status`, `connected_at`, `last_seen_at`).
- Intervalo de 10s é conservador para não sobrecarregar; reduzir para 5s se necessário.
- Todas as chamadas ao SDK ficam em `try/catch` porque o Webphone pode ainda não estar pronto.
