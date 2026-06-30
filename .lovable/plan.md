## Diagnóstico

O erro 502 com `wavoip_status_401` acontece porque a função de backend está tentando validar o token do dispositivo em um endpoint HTTP (`/devices/status`) usando `Authorization: Bearer <device_token>`.

Pela documentação da Wavoip, esse token não é para esse tipo de validação server-side. O fluxo correto é:

- O token do dispositivo é usado no SDK/Webphone da Wavoip no navegador.
- O QR Code pode ser exibido pelo link: `https://devices.wavoip.com/{token}/whatsapp/qr-image`.
- O status real vem do SDK/Webphone: `connecting`, `open`, `close`, etc.
- Quando o status vira `open`, o dispositivo está pareado e pode liberar o discador.

## Plano de correção

1. **Trocar “Reconectar” por “Conectar” no `/wavoip`**
   - Alterar o botão para refletir o fluxo correto.
   - Ao clicar, abrir um modal de conexão do dispositivo.
   - Exibir o QR Code Wavoip usando o token do dispositivo.
   - Mostrar status visual: aguardando leitura, conectado, erro ou expirado.

2. **Conectar pelo Webphone/SDK no navegador**
   - Garantir que o webphone seja renderizado antes de iniciar a conexão.
   - Adicionar o token com `window.wavoip.device.add(token, true)`.
   - Habilitar o dispositivo com `window.wavoip.device.enable(token)` quando disponível.
   - Ler o dispositivo via `window.wavoip.device.get()`.
   - Escutar eventos/status do dispositivo quando expostos pelo SDK:
     - `statusChanged`
     - `qrCodeChanged`
     - `contactChanged`
     - `connectionStatusChanged`

3. **Persistir o status correto no banco**
   - Quando o dispositivo estiver `open`, atualizar:
     - `connection_status = 'connected'`
     - `connected_at`
     - `last_seen_at`
     - `whatsapp_jids` / `whatsapp_number` quando o SDK expuser contato.
   - Enquanto estiver `connecting`, manter `connection_status = 'connecting'`.
   - Em erro real do SDK, gravar `connection_status = 'error'` com metadados sem expor token completo.

4. **Remover dependência do endpoint inválido na função atual**
   - Ajustar `wavoip-connect-device` para não chamar mais `/devices/status` com Bearer token.
   - A função passará a preparar/registrar tentativa de conexão e devolver dados seguros para o frontend, como `qr_image_url`, status e device atualizado.
   - Assim o usuário não verá mais 502/401 nessa ação.

5. **Liberar o discador somente com dispositivo pareado**
   - Ajustar `WavoipContext` para sincronizar tokens conectados corretamente.
   - O botão “Abrir discador” continuará bloqueado até existir dispositivo `connected/open`.
   - Após pareamento, atualizar o contexto e inserir o token no webphone para chamadas.

6. **Melhorar mensagens para o usuário**
   - Se o token estiver inválido mesmo no SDK/QR, mostrar orientação clara para substituir o token no admin.
   - Se estiver aguardando leitura, manter modal com QR e opção de atualizar.
   - Se conectar, fechar/confirmar e liberar o discador.

## Arquivos previstos

- `src/pages/wavoip/WavoipPage.tsx`
- `src/contexts/WavoipContext.tsx`
- `supabase/functions/wavoip-connect-device/index.ts`
- Possível novo componente local para modal de conexão QR, se ficar mais limpo.

## Resultado esperado

O fluxo deixa de tentar “validar” o token por um endpoint que retorna 401 e passa a conectar como a Wavoip documenta: exibir QR Code, parear via WhatsApp, detectar status `open` pelo SDK/Webphone e só então liberar o discador.