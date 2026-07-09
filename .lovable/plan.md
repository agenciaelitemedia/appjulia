## Problema

O membro da equipe recebeu permissão para o dispositivo (via `wavoip_device_members`), mas no painel dele o Wavoip aparece como "não habilitado" e não é possível discar.

## Causa

Em `src/contexts/WavoipContext.tsx` (função `loadPlanAndDevices`), a query de dispositivos filtra apenas pelos dispositivos onde o usuário é o **dono**:

```ts
.from('wavoip_devices')
.eq('client_id', clientId)
.eq('app_user_id', user?.id ?? -1)   // <-- exclui compartilhados
.eq('connection_status', 'connected');
```

Resultado para o membro compartilhado:
- `devicesCount = 0`
- `connectedNumbers = []`
- `userDevicesRef` vazio → `canDial` falso → widget/discador ficam desabilitados

A página `/wavoip` já considera compartilhados (via `wavoip_device_members`), mas o **contexto global** (usado pelo sidebar/discador em qualquer tela) não.

## Correção

Ajustar `loadPlanAndDevices` em `src/contexts/WavoipContext.tsx` para incluir também os dispositivos onde o usuário é membro compartilhado:

1. Buscar `device_id`s em `wavoip_device_members` onde `app_user_id = user.id`.
2. Alterar a query de `wavoip_devices` para trazer dispositivos onde `app_user_id = user.id` **OU** `id IN (shared_ids)`, mantendo `client_id` e `connection_status = 'connected'`.
   - Usar `.or('app_user_id.eq.<id>,id.in.(<ids>)')` (com fallback quando a lista de compartilhados estiver vazia).
3. Manter todo o restante do fluxo (tokens, `connectedNumbers`, `userDevicesRef`, `setDevices`) igual.

## Fora do escopo

- Nenhuma alteração de RLS/GRANT (já corrigidos anteriormente).
- Nenhuma mudança na página `/wavoip` nem no `ShareDeviceDialog`.
- Sem mudanças na lógica de plano (`hasActivePlan` continua por `client_id`).

## Verificação

- Logar como o membro que recebeu permissão: o dispositivo compartilhado aparece no discador, `canDial` fica verdadeiro e o widget abre normalmente.
- Logar como dono: comportamento inalterado.
