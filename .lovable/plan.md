## Alterações em `src/pages/wavoip/WavoipPage.tsx`

1. **Remover badge "Webhook não verificado"**
   - No bloco do `Tooltip`/`Badge` de webhook (linhas ~444-462), só renderizar o badge quando `d.webhook_status` estiver definido E for diferente de `'never'`/vazio. Ou seja, quando não configurado, nada aparece.
   - Manter o botão "Copiar URL" como está (só aparece quando `webhook_status && webhook_status !== 'ok'`).

2. **Botão Conectar/Desconectar dinâmico**
   - Quando `connected === true`: mostrar botão "Desconectar" (variant `outline`, ícone `Plug`) que executa desconexão:
     - `wp?.device?.disable?.(device.device_token)` e `wp?.device?.remove?.(device.device_token)`
     - Update em `wavoip_devices`: `connection_status='disconnected'`, `connected_at=null`, `whatsapp_jids=[]`, `whatsapp_jid=null`, `whatsapp_number=null`
     - Recarregar via `load()` e `refreshDevices()`
   - Quando não conectado: manter botão "Conectar" atual chamando `startConnectFlow(d)`.

3. **Dupla confirmação em Desconectar e Liberar**
   - Reutilizar o componente já existente `src/pages/admin/wavoip/components/ConfirmDeleteDialog.tsx` (padrão switch de confirmação da memória `secure-deletion-workflow`).
   - Adicionar dois estados no `WavoipPage`: `disconnectTarget: Device | null` e `releaseTarget: Device | null`.
   - Botão "Desconectar" abre `ConfirmDeleteDialog` com:
     - `title="Desconectar dispositivo"`
     - `description`: explica que a sessão do WhatsApp será encerrada e será necessário novo QR
     - `confirmLabel="Desconectar"`, `toggleLabel="Confirmo que quero desconectar este dispositivo"`
   - Botão "Liberar" (linha 489-491): remover o `confirm()` nativo e abrir `ConfirmDeleteDialog`:
     - `title="Liberar dispositivo"`
     - `description`: explica que o dispositivo volta ao pool do escritório e o vínculo com o usuário é removido
     - `confirmLabel="Liberar"`, `toggleLabel="Confirmo que quero liberar este dispositivo"`
   - `handleRelease` perde o `confirm()` interno; a confirmação passa para o dialog.

Nenhuma outra alteração (visual, lógica de conexão, compartilhamento) é feita.
